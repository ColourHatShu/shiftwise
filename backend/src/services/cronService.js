const cron = require('node-cron');
const Sentry = require('@sentry/node');
const prisma = require('../lib/prisma');
const { sendExpiryAlert, sendWorkerExpiryAlert } = require('./emailService');

const log = require('../lib/logger').child({ service: 'cron' });

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
    log.info('Starting failed alert retry process');

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

        log.info({ count: failedAlerts.length }, 'Found failed alerts to retry');

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
                        log.info({ documentId: failedAlert.complianceDocumentId }, 'Alert already exists; marking failed alert resolved');
                    } else {
                        // Re-throw non-dedup errors
                        throw alertErr;
                    }
                }

                log.info({ failedAlertId: failedAlert.id, worker: fullWorkerName }, 'Resolved failed alert');
                resolvedCount++;
            } catch (err) {
                log.error({ err, failedAlertId: failedAlert.id, attempt: failedAlert.retryCount + 1 }, 'Retry attempt failed');

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
                    log.error({ failedAlertId: failedAlert.id, maxRetries: MAX_RETRY_ATTEMPTS }, 'Alert failed permanently');
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

        log.info({ retriedCount, resolvedCount }, 'Retry process complete');
        return { retriedCount, resolvedCount };
    } catch (err) {
        log.error({ err }, 'Error during failed alert retry process');
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
    log.info('Starting daily document expiry check');

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

        log.info({ count: activeDocuments.length }, 'Found documents with expiry dates');

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
                    log.warn({ err: workerEmailErr, worker: fullWorkerName }, 'Failed to send worker alert');
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
                        log.info({ documentId: doc.id, daysUntilExpiry: daysRemaining, day: alertDateToday.toISOString().split('T')[0] }, 'Alert already exists for today; skipping');
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

                log.info({ daysRemaining, worker: fullWorkerName, documentType: doc.documentType.name, expiryDate: doc.expiryDate }, 'Sent expiry warning');
                alertsSent++;
                triggeredDocuments.push({
                    documentId: doc.id,
                    workerName: fullWorkerName,
                    documentType: doc.documentType.name,
                    daysRemaining,
                    status: "Sent"
                });
            } catch (err) {
                log.error({ err, documentId: doc.id, worker: fullWorkerName, documentType: doc.documentType.name }, 'Could not process alert step');

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
                    log.info({ documentId: doc.id }, 'Added failed alert to dead letter queue');
                } catch (dlqErr) {
                    log.error({ err: dlqErr, documentId: doc.id }, 'CRITICAL: failed to add to dead letter queue');
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

        log.info({ triggered: triggeredDocuments.length, alertsSent }, 'Completed expiry check');
        return { alertsSent, triggeredDocuments };
    } catch (err) {
        log.error({ err }, 'Global error executing expiry check sweep');
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
 * Generate daily compliance snapshots (R-AP-04, R-AP-08)
 * Creates immutable point-in-time snapshot of compliance state
 */
const generateComplianceSnapshots = async () => {
    log.info('Starting daily compliance snapshot generation');

    try {
        const agencies = await prisma.agency.findMany({
            where: { isActive: true }
        });

        log.info({ count: agencies.length }, 'Found active agencies to snapshot');

        let snapshotCount = 0;

        for (const agency of agencies) {
            try {
                // Fetch all workers with compliance data
                const workers = await prisma.worker.findMany({
                    where: { agencyId: agency.id },
                    include: {
                        complianceDocuments: {
                            include: { documentType: true }
                        }
                    }
                });

                // Fetch required document types
                const requiredDocTypes = await prisma.documentType.findMany({
                    where: { agencyId: agency.id, isRequired: true }
                });

                // Build snapshot data
                const snapshotData = {
                    agencyId: agency.id,
                    agencyName: agency.name,
                    asOfDate: new Date().toISOString(),
                    workerCount: workers.length,
                    requiredDocumentTypes: requiredDocTypes.map(dt => ({ id: dt.id, name: dt.name })),
                    workers: workers.map(w => {
                        const requiredIds = requiredDocTypes.map(dt => dt.id);
                        const requiredDocs = w.complianceDocuments.filter(d => requiredIds.includes(d.documentTypeId));
                        const approvedCount = requiredDocs.filter(d => d.status === 'APPROVED').length;
                        const complianceScore = requiredDocTypes.length > 0
                            ? Math.round((approvedCount / requiredDocTypes.length) * 100)
                            : 100;

                        return {
                            id: w.id,
                            name: `${w.firstName} ${w.lastName}`,
                            email: w.email,
                            jobTitle: w.jobTitle,
                            status: w.status,
                            complianceScore,
                            documents: w.complianceDocuments.map(d => ({
                                id: d.id,
                                typeId: d.documentTypeId,
                                typeName: d.documentType.name,
                                status: d.status,
                                expiryDate: d.expiryDate,
                                uploadedAt: d.uploadedAt
                            }))
                        };
                    }),
                    summary: {
                        totalWorkers: workers.length,
                        compliantWorkers: workers.filter(w => {
                            const requiredIds = requiredDocTypes.map(dt => dt.id);
                            const requiredDocs = w.complianceDocuments.filter(d => requiredIds.includes(d.documentTypeId));
                            const approvedCount = requiredDocs.filter(d => d.status === 'APPROVED').length;
                            const score = requiredDocTypes.length > 0 ? Math.round((approvedCount / requiredDocTypes.length) * 100) : 100;
                            return score >= 80;
                        }).length
                    }
                };

                // Store snapshot
                const today = new Date();
                today.setUTCHours(0, 0, 0, 0);

                try {
                    await prisma.complianceSnapshot.create({
                        data: {
                            agencyId: agency.id,
                            asOfDate: today,
                            data: snapshotData
                        }
                    });
                    log.info({ agency: agency.name }, 'Snapshot created');
                    snapshotCount++;
                } catch (err) {
                    // If snapshot for today already exists, update it
                    if (err.code === 'P2002') {
                        await prisma.complianceSnapshot.update({
                            where: {
                                agencyId_asOfDate: {
                                    agencyId: agency.id,
                                    asOfDate: today
                                }
                            },
                            data: { data: snapshotData }
                        });
                        log.info({ agency: agency.name }, 'Updated existing snapshot');
                        snapshotCount++;
                    } else {
                        throw err;
                    }
                }
            } catch (err) {
                log.error({ err, agencyId: agency.id }, 'Failed to snapshot agency');
                Sentry.captureException(err, {
                    tags: {
                        agencyId: agency.id,
                        context: 'cron-snapshot-failure'
                    }
                });
            }
        }

        log.info({ snapshotCount }, 'Snapshot generation complete');
        return { snapshotCount };
    } catch (err) {
        log.error({ err }, 'Global error during snapshot generation');
        Sentry.captureException(err, {
            tags: {
                context: 'cron-snapshot-global-error'
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
    log.info('Initialized daily background expiry sweep (08:00 AM)');

    // Retry failed alerts every hour
    cron.schedule('0 * * * *', retryFailedAlerts);
    log.info('Initialized hourly failed alert retry process');

    // Generate compliance snapshots at 9:00 AM daily (after expiry check)
    cron.schedule('0 9 * * *', generateComplianceSnapshots);
    log.info('Initialized daily compliance snapshot generation (09:00 AM)');
};

module.exports = {
    initCronJobs,
    checkExpiriesAndAlert,
    retryFailedAlerts,
    generateComplianceSnapshots
};
