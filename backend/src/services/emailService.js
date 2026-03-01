const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

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

module.exports = {
    sendExpiryAlert
};
