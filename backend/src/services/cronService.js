const cron = require('node-cron');
const Sentry = require('@sentry/node');
const prisma = require('../lib/prisma');
const { sendExpiryAlert, sendWorkerExpiryAlert } = require('./emailService');

const TARGET_DAYS_UNTIL_EXPIRY = [90, 60, 30, 14, 7, 3, 1, 0];
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Calculates the exact number of days remaining between the current date
 * (set to midnight UTC) and the target expiry date (also normalized to midnight UTC).
 */
const getDaysDiff = (targetDateString) => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const targetDate = new Date(targetDateString);
    targetDate.setUTCHours(0, 0, 0, 0);

    const diffTime = targetDate.getTime() - today.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Retry failed alerts from the dead letter queue
 */
const retryFailedAlerts = async () => {
    console.log('[Cron Service] Starting failed alert retry process...');

    try {
        const failedAlerts = await prisma.failedAlert.findMany({
            where: {
                status: { in: ['PENDING', 'RETRYING'] },
                retryCount: { lt: MAX_RETRY_ATTEMPTS }
            },
            include: {
                worker: true,
                complianceDocument: { include: { documentType: true } },
                agency: true
            }
        });

        console.log(`[Cron Service] Found ${failedAlerts.length} failed alerts to retry.`);

        let retriedCount = 0;
        let resolvedCount = 0;

        for (const failedAlert of failedAlerts) {
            try {
                const fullWorkerName = `${failedAlert.worker.firstName} ${failedAlert.worker.lastName}`;
                
                // Update status to RETRYING
                await prisma.failedAlert.update({
                    where: { id: failedAlert.id },
                    data: { 
                        status: 'RETRYING',
                        retryCount: { increment: 1 },
                        lastRetryAt: new Date()
                    }
                });

                // Attempt to send the email again
                await sendExpiryAlert(
                    failedAlert.agency.email,
                    fullWorkerName,
                    failedAlert.complianceDocument.documentType.name,
                    failedAlert.complianceDocument.expiryDate,
                    failedAlert.daysUntilExpiry
                );

                // Success! Mark as resolved and create ExpiryAlert record
                await prisma.failedAlert.update({
                    where: { id: failedAlert.id },
                    data: {
                        status: 'RESOLVED',
                        resolvedAt: new Date()
                    }
                });

                // Try to create the successful alert record
                try {
                    const alertDateToday = new Date();
                    alertDateToday.setUTCHours(0, 0, 0, 0);  // Normalize to UTC midnight

                    await prisma.expiryAlert.create({
                        data: {
                            agencyId: failedAlert.agencyId,
                            workerId: failedAlert.workerId,
                            complianceDocumentId: failedAlert.complianceDocumentId,
                            alertDate: new Date(),
                            alertDateOnly: alertDateToday,  // Normalized date for dedup constraint
                            daysUntilExpiry: failedAlert.daysUntilExpiry,
                            isSent: true,
                            sentAt: new Date()
                        }
                    });
                } catch (alertErr) {
                    // P2002: alert already exists (benign - don't retry)
                    if (alertErr.code === 'P2002') {
                        console.log(`[Cron Service] alert already exists for doc ${failedAlert.complianceDocumentId}, marking failed alert as resolved`);
                    } else {
                        // Re-throw non-dedup errors
                        throw alertErr;
                    }
                }

                console.log(`[Cron Service] SUCCESS: Resolved failed alert ${failedAlert.id} for ${fullWorkerName}`);
                resolvedCount++;
            } catch (err) {
                console.error(`[Cron Service] FAILED: Retry attempt ${failedAlert.retryCount + 1} failed for alert ${failedAlert.id}:`, err.message);

                // Log to Sentry
                Sentry.captureException(err, {
                    tags: {
                        agencyId: failedAlert.agencyId,
                        workerId: failedAlert.workerId,
                        context: 'cron-alert-retry-failure'
                    },
                    extra: {
                        failedAlertId: failedAlert.id,
                        retryCount: failedAlert.retryCount
                    }
                });

                // Check if max retries reached
                if (failedAlert.retryCount + 1 >= MAX_RETRY_ATTEMPTS) {
                    await prisma.failedAlert.update({
                        where: { id: failedAlert.id },
                        data: {
                            status: 'FAILED_PERMANENTLY',
                            errorMessage: err.message,
                            errorDetails: err.stack
                        }
                    });
                    console.error(`[Cron Service] ALERT: Alert ${failedAlert.id} has failed permanently after ${MAX_RETRY_ATTEMPTS} attempts.`);
                } else {
                    await prisma.failedAlert.update({
                        where: { id: failedAlert.id },
                        data: {
                            status: 'PENDING',
                            errorMessage: err.message
                        }
                    });
                }
            }
            retriedCount++;
        }

        console.log(`[Cron Service] Retry process complete. Retried: ${retriedCount}, Resolved: ${resolvedCount}`);
        return { retriedCount, resolvedCount };
    } catch (err) {
        console.error('[Cron Service] Error during failed alert retry process:', err);
        // Log to Sentry
        Sentry.captureException(err, {
            tags: {
                context: 'cron-retry-process-error'
            }
        });
        throw err;
    }
};

/**
 * Executes a manual sweep of all ComplianceDocuments, triggering alerts.
 */
const checkExpiriesAndAlert = async () => {
    console.log('[Cron Service] Starting daily document expiry check...');

    try {
        // Find all documents that have an expiry date setup, regardless of verification status
        const activeDocuments = await prisma.complianceDocument.findMany({
            where: {
                expiryDate: { not: null }
            },
            include: {
                worker: true,
                documentType: true,
                agency: true
            }
        });

        console.log(`[Cron Service] Found ${activeDocuments.length} total documents with expiry dates.`);

        // Loop through everything to find warning milestones natively
        let alertsSent = 0;
        const triggeredDocuments = [];

        for (const doc of activeDocuments) {
            const daysRemaining = getDaysDiff(doc.expiryDate);

            // Check if this document hits one of our target milestones
            if (!TARGET_DAYS_UNTIL_EXPIRY.includes(daysRemaining)) continue;

            // Check if an alert was ALREADY sent today for this exact document
            // Dedup at database level: the unique constraint on (complianceDocumentId, daysUntilExpiry, alertDateOnly)
            // ensures at most one alert per (document, threshold, day). If two cron runs race, the loser catches P2002.
            const fullWorkerName = `${doc.worker.firstName} ${doc.worker.lastName}`;
            const alertDateToday = new Date();
            alertDateToday.setUTCHours(0, 0, 0, 0);  // Normalize to UTC midnight

            try {
                // Send coordinator notification email
                await sendExpiryAlert(
                    doc.agency.email,
                    fullWorkerName,
                    doc.documentType.name,
                    doc.expiryDate,
                    daysRemaining
                );

                // NEW: Send worker notification email at each milestone
                try {
                    await sendWorkerExpiryAlert(
                        doc.worker.email,
                        doc.worker.firstName,
                        doc.documentType.name,
                        doc.expiryDate,
                        daysRemaining
                    );
                } catch (workerEmailErr) {
                    console.warn(`[Cron Service] Failed to send worker alert for ${fullWorkerName}:`, workerEmailErr.message);
                    Sentry.captureException(workerEmailErr, {
                        tags: { documentId: doc.id, context: 'worker-expiry-alert' }
                    });
                    // Don't fail coordinator alert if worker email fails
                }

                // Email sent successfully. Now record the alert in the database.
                try {
                    await prisma.expiryAlert.create({
                        data: {
                            agencyId: doc.agencyId,
                            workerId: doc.workerId,
                            complianceDocumentId: doc.id,
                            alertDate: new Date(),
                            alertDateOnly: alertDateToday,  // Normalized date for dedup constraint
                            daysUntilExpiry: daysRemaining,
                            isSent: true,
                            sentAt: new Date()
                        }
                    });
                } catch (err) {
                    // P2002: unique constraint violation (alert already exists for today)
                    // This is benign when running concurrently - just log and skip.
                    if (err.code === 'P2002') {
                        console.log(`[Cron Service] alert already exists for doc ${doc.id}, daysUntilExpiry ${daysRemaining}, day ${alertDateToday.toISOString().split('T')[0]} — skipping`);
                        continue;
                    }
                    // Any other database error is re-thrown for the outer catch block
                    throw err;
                }

                // Write audit log records for both coordinator and worker alerts
                await prisma.auditLog.create({
                    data: {
                        agencyId: doc.agencyId,
                        action: 'alert.expiry_warning_sent',
                        entity: 'ComplianceDocument',
                        entityId: doc.id,
                        metadata: {
                            workerName: fullWorkerName,
                            documentType: doc.documentType.name,
                            daysRemaining: daysRemaining,
                            recipient: doc.agency.email,
                            recipientType: 'coordinator'
                        }
                    }
                });

                // Audit log for worker alert
                await prisma.auditLog.create({
                    data: {
                        agencyId: doc.agencyId,
                        userId: null,
                        action: 'alert.worker_expiry_warning_sent',
                        entity: 'ComplianceDocument',
                        entityId: doc.id,
                        metadata: {
                            workerName: fullWorkerName,
                            documentType: doc.documentType.name,
                            daysRemaining: daysRemaining,
                            recipient: doc.worker.email
                        }
                    }
                });

                console.log(`[Cron Service] SUCCESS: Sent ${daysRemaining}-day expiry warning for ${fullWorkerName}'s ${doc.documentType.name}. Expiry date: ${doc.expiryDate}`);
                alertsSent++;
                triggeredDocuments.push({
                    documentId: doc.id,
                    workerName: fullWorkerName,
                    documentType: doc.documentType.name,
                    daysRemaining,
                    status: "Sent"
                });
            } catch (err) {
                console.error(`[Cron Service] FAILED: Could not process alert step for doc ${doc.id} (${fullWorkerName}'s ${doc.documentType.name}). Expiry date: ${doc.expiryDate}:`, err);

                // Log to Sentry
                Sentry.captureException(err, {
                    tags: {
                        agencyId: doc.agencyId,
                        workerId: doc.workerId,
                        context: 'cron-expiry-alert-failure'
                    },
                    extra: {
                        documentId: doc.id,
                        daysRemaining
                    }
                });

                // Add to dead letter queue (FailedAlert)
                try {
                    await prisma.failedAlert.create({
                        data: {
                            agencyId: doc.agencyId,
                            workerId: doc.workerId,
                            complianceDocumentId: doc.id,
                            alertDate: new Date(),
                            daysUntilExpiry: daysRemaining,
                            retryCount: 0,
                            maxRetries: MAX_RETRY_ATTEMPTS,
                            errorMessage: err.message,
                            errorDetails: err.stack,
                            status: 'PENDING'
                        }
                    });
                    console.log(`[Cron Service] Added failed alert to dead letter queue for doc ${doc.id}`);
                } catch (dlqErr) {
                    console.error(`[Cron Service] CRITICAL: Failed to add to dead letter queue:`, dlqErr);
                    // Log DLQ failure to Sentry too
                    Sentry.captureException(dlqErr, {
                        tags: {
                            agencyId: doc.agencyId,
                            context: 'cron-dlq-failure'
                        }
                    });
                }

                triggeredDocuments.push({
                    documentId: doc.id,
                    workerName: fullWorkerName,
                    documentType: doc.documentType.name,
                    daysRemaining,
                    status: "Failed",
                    error: err.message
                });
            }
        }

        console.log(`[Cron Service] Completed expiry check. Triggered ${triggeredDocuments.length} items. Sent ${alertsSent} new emails.`);
        return { alertsSent, triggeredDocuments };
    } catch (err) {
        console.error('[Cron Service] Global error executing expiry check sweep:', err);
        // Log to Sentry
        Sentry.captureException(err, {
            tags: {
                context: 'cron-expiry-check-global-error'
            }
        });
        throw err;
    }
};

/**
 * Maps the cronService to specific intervals. Default is 8:00 AM server time.
 */
const initCronJobs = () => {
    // 0 8 * * * = "At 08:00 every day"
    cron.schedule('0 8 * * *', checkExpiriesAndAlert);
    console.log('[Cron Service] Initialized daily background expiry sweep (08:00 AM)');
    
    // Retry failed alerts every hour
    cron.schedule('0 * * * *', retryFailedAlerts);
    console.log('[Cron Service] Initialized hourly failed alert retry process');
};

module.exports = {
    initCronJobs,
    checkExpiriesAndAlert,
    retryFailedAlerts
};
