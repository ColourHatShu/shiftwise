const cron = require('node-cron');
const prisma = require('../lib/prisma');
const { sendExpiryAlert } = require('./emailService');

const TARGET_DAYS_UNTIL_EXPIRY = [30, 14, 7];
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

                await prisma.expiryAlert.create({
                    data: {
                        agencyId: failedAlert.agencyId,
                        workerId: failedAlert.workerId,
                        complianceDocumentId: failedAlert.complianceDocumentId,
                        alertDate: new Date(),
                        daysUntilExpiry: failedAlert.daysUntilExpiry,
                        isSent: true,
                        sentAt: new Date()
                    }
                });

                console.log(`[Cron Service] SUCCESS: Resolved failed alert ${failedAlert.id} for ${fullWorkerName}`);
                resolvedCount++;
            } catch (err) {
                console.error(`[Cron Service] FAILED: Retry attempt ${failedAlert.retryCount + 1} failed for alert ${failedAlert.id}:`, err.message);
                
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

            // We now trigger alerts for ANY document expiring in 30 days or less
            if (daysRemaining > 30 || daysRemaining < 0) continue;

            // Check if an alert was ALREADY sent today for this exact document
            // To prevent accidental duplicate spam if checking manually or server restarts
            const todayStart = new Date();
            todayStart.setUTCHours(0, 0, 0, 0);
            const todayEnd = new Date();
            todayEnd.setUTCHours(23, 59, 59, 999);

            const duplicateAlert = await prisma.expiryAlert.findFirst({
                where: {
                    complianceDocumentId: doc.id,
                    daysUntilExpiry: daysRemaining,
                    createdAt: {
                        gte: todayStart,
                        lte: todayEnd,
                    }
                }
            });

            if (duplicateAlert) {
                console.log(`[Cron Service] Already triggered ${daysRemaining}-day alert for doc ${doc.id} today. Skipping.`);
                continue;
            }

            // Fire the HTML email
            const fullWorkerName = `${doc.worker.firstName} ${doc.worker.lastName}`;
            try {
                await sendExpiryAlert(
                    doc.agency.email,
                    fullWorkerName,
                    doc.documentType.name,
                    doc.expiryDate,
                    daysRemaining
                );

                // Setup foreign key tracker showing an email was requested for this threshold
                await prisma.expiryAlert.create({
                    data: {
                        agencyId: doc.agencyId,
                        workerId: doc.workerId,
                        complianceDocumentId: doc.id,
                        alertDate: new Date(),
                        daysUntilExpiry: daysRemaining,
                        isSent: true,
                        sentAt: new Date()
                    }
                });

                // Write identical audit log record dynamically for compliance
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
                            recipient: doc.agency.email
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
