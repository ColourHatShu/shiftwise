const { Resend } = require('resend');

// Lazy-instantiate the Resend client so module load never crashes in environments
// (tests, local dev without `.env`) where RESEND_API_KEY isn't set. The send
// functions below already short-circuit when the key is missing.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * Sends an HTML formatted email alert to an agency coordinator about an expiring worker document.
 * 
 * @param {string} coordinatorEmail The agency recipient's email
 * @param {string} workerName The full name of the worker whose document is expiring
 * @param {string} documentType The type of the document (e.g., Passport, DBS)
 * @param {Date|string} expiryDate The date the document expires
 * @param {number} daysUntilExpiry Number of days remaining (e.g., 30, 14, 7)
 */
const sendExpiryAlert = async (coordinatorEmail, workerName, documentType, expiryDate, daysUntilExpiry) => {
    console.log(`[Email Service] Attempting to send Expiry Alert email for ${workerName}'s ${documentType}`);
    console.log(`[Email Service] Target Coordinator Email routing to: ${coordinatorEmail}`);

    // Basic catch if the key is missing during development
    if (!process.env.RESEND_API_KEY) {
        console.warn(`[WARN] Skipping Expiry Alert email to ${coordinatorEmail} because RESEND_API_KEY is not defined in .env`);
        return null;
    }

    const formattedDate = new Date(expiryDate).toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            
            <!-- Header -->
            <tr>
                <td style="background-color: #1e293b; padding: 32px 40px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">ShiftWise Compliance</h1>
                </td>
            </tr>

            <!-- Body -->
            <tr>
                <td style="padding: 40px;">
                    <h2 style="color: #0f172a; margin: 0 0 24px 0; font-size: 20px; font-weight: 600;">Action Required: Document Expiring Soon</h2>
                    
                    <p style="color: #475569; font-size: 16px; line-height: 24px; margin: 0 0 24px 0;">
                        This is an automated notice that a compliance document for <strong>${workerName}</strong> requires your immediate attention.
                    </p>

                    <!-- Alert Box -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fff7ed; border: 1px solid #ffedd5; border-radius: 8px; margin-bottom: 32px;">
                        <tr>
                            <td style="padding: 24px;">
                                <p style="margin: 0; color: #9a3412; font-size: 16px; font-weight: 500;">
                                    The <strong>${documentType}</strong> on file expires in exactly <span style="font-weight: 700; color: #ea580c;">${daysUntilExpiry} days</span>.
                                </p>
                                <p style="margin: 12px 0 0 0; color: #9a3412; font-size: 15px;">
                                    <strong>Expiry Date:</strong> ${formattedDate}
                                </p>
                            </td>
                        </tr>
                    </table>

                    <!-- Call to Action -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 40px;">
                        <tr>
                            <td align="center">
                                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px;">
                                    View Worker Profile
                                </a>
                            </td>
                        </tr>
                    </table>

                    <p style="color: #64748b; font-size: 14px; line-height: 20px; margin: 0; border-top: 1px solid #e2e8f0; padding-top: 24px;">
                        To maintain compliance, please ensure a renewed document is requested and uploaded prior to the expiration date.
                    </p>
                </td>
            </tr>

            <!-- Footer -->
            <tr>
                <td style="background-color: #f1f5f9; padding: 24px 40px; text-align: center;">
                    <p style="color: #64748b; font-size: 12px; margin: 0;">
                        &copy; ${new Date().getFullYear()} ShiftWise. All rights reserved.<br>
                        This is an automated system notification.
                    </p>
                </td>
            </tr>

        </table>
    </body>
    </html>
    `;

    try {
        console.log(`[Email Service] Calling Resend API...`);
        const response = await resend.emails.send({
            from: 'onboarding@resend.dev', // User must configure verified sending domain in production later
            to: [coordinatorEmail],
            subject: `Action Required: ${workerName}'s ${documentType} expires in ${daysUntilExpiry} days`,
            html: emailHtml,
        });

        console.log(`[Email Service] Full Resend Response JSON on success:`, JSON.stringify(response));
        return response;
    } catch (error) {
        console.error('[Email Service] Failed to send expiry alert:', error);
        throw error;
    }
};

/**
 * Sends a worker-friendly pre-expiry notification email.
 *
 * @param {string} workerEmail The worker's email address
 * @param {string} workerFirstName The worker's first name
 * @param {string} documentType The type of document expiring (e.g., DBS Check)
 * @param {Date|string} expiryDate The date the document expires
 * @param {number} daysUntilExpiry Number of days remaining
 */
const sendWorkerExpiryAlert = async (workerEmail, workerFirstName, documentType, expiryDate, daysUntilExpiry) => {
    console.log(`[Email Service] Attempting to send Worker Expiry Alert email to ${workerEmail} for ${documentType}`);

    // Skip if Resend key not configured
    if (!process.env.RESEND_API_KEY) {
        console.warn(`[WARN] Skipping Worker Expiry Alert email to ${workerEmail} because RESEND_API_KEY is not defined in .env`);
        return null;
    }

    const formattedDate = new Date(expiryDate).toLocaleDateString('en-GB');
    const portalUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const urgencyText = daysUntilExpiry === 0
        ? 'Your document has EXPIRED TODAY'
        : `Your ${documentType} expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`;

    const subjectLine = daysUntilExpiry === 0
        ? `[URGENT] Your ${documentType} has expired`
        : `[Action Required] Your ${documentType} expires in ${daysUntilExpiry} days`;

    const emailHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f8fafc; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; }
            .content { padding: 20px 0; }
            .cta-button {
                display: inline-block;
                padding: 12px 24px;
                background-color: #2563eb;
                color: white;
                text-decoration: none;
                border-radius: 4px;
                font-weight: bold;
                margin: 20px 0;
            }
            .footer { font-size: 12px; color: #999; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px; }
            .urgency-red { color: #dc2626; }
            .urgency-yellow { color: #ea580c; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>ShiftWise Compliance Reminder</h1>
            </div>

            <div class="content">
                <p>Hi ${workerFirstName},</p>

                <p class="${daysUntilExpiry === 0 ? 'urgency-red' : 'urgency-yellow'}">
                    <strong>${urgencyText}</strong>
                </p>

                <p>
                    Your <strong>${documentType}</strong> expires on <strong>${formattedDate}</strong>.
                    ${daysUntilExpiry === 0
                        ? 'You must upload a renewal immediately to continue working on shifts.'
                        : `You have ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''} to renew this document.`
                    }
                </p>

                <div style="text-align: center;">
                    <a href="${portalUrl}/worker/dashboard" class="cta-button">View Your Compliance Status</a>
                </div>

                <p>
                    If you have any questions, please contact your coordinator.
                </p>
            </div>

            <div class="footer">
                <p>
                    This is an automated message from ShiftWise.
                </p>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
        console.log(`[Email Service] Calling Resend API for worker email...`);
        const response = await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: [workerEmail],
            subject: subjectLine,
            html: emailHtml,
        });

        console.log(`[Email Service] Worker alert sent successfully to ${workerEmail}`);
        return response;
    } catch (error) {
        console.error(`[Email Service] Failed to send worker expiry alert to ${workerEmail}:`, error);
        throw error;
    }
};

module.exports = {
    sendExpiryAlert,
    sendWorkerExpiryAlert
};
