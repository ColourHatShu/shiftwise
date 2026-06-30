/**
 * Email Utility using Nodemailer
 * Sends OTP codes and alerts to workers and coordinators
 *
 * In production, uses configured SMTP service (e.g., AWS SES, SendGrid)
 * In development, logs to console
 */

const nodemailer = require('nodemailer');
const Sentry = require('@sentry/node');

// Initialize transporter based on environment
let transporter;

if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    // Production SMTP configuration
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true', // use TLS
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
} else {
    // Development: use test account (logs to console)
    transporter = {
        sendMail: async (mailOptions) => {
            console.log('[DEV] Email not sent (configure SMTP for production)');
            console.log('  To:', mailOptions.to);
            console.log('  Subject:', mailOptions.subject);
            return { messageId: 'dev-' + Math.random().toString(36).substr(2, 9) };
        },
    };
}

/**
 * Send OTP to worker for signin
 * @param {string} email - Worker email
 * @param {string} firstName - Worker first name
 * @param {string} otp - 6-digit OTP code
 */
async function sendWorkerOtpEmail(email, firstName, otp) {
    try {
        const mailOptions = {
            from: process.env.SMTP_FROM || 'noreply@shiftwise.io',
            to: email,
            subject: `Your ShiftWise Sign-In Code: ${otp}`,
            html: `
<html>
  <body style="font-family: Arial, sans-serif; color: #333;">
    <h2>ShiftWise Sign-In Code</h2>
    <p>Hi ${firstName},</p>
    <p>Your one-time sign-in code is:</p>
    <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">
      ${otp}
    </div>
    <p>This code expires in 10 minutes. Do not share this code with anyone.</p>
    <p>If you did not request this code, you can safely ignore this email.</p>
    <hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;" />
    <p style="font-size: 12px; color: #666;">
      ShiftWise — Compliance Management for UK Healthcare Staffing
    </p>
  </body>
</html>
            `,
        };

        const result = await transporter.sendMail(mailOptions);
        console.log('OTP email sent:', result.messageId);
        return result;
    } catch (error) {
        Sentry.captureException(error, {
            tags: { context: 'email.send-otp' },
            extra: { email },
        });
        throw error;
    }
}

/**
 * Send document review notification to coordinator
 * @param {string} coordinatorEmail - Coordinator email
 * @param {string} workerName - Worker name
 * @param {string} docType - Document type (e.g., "DBS Check")
 * @param {string} agencyName - Agency name
 * @param {string} reviewUrl - URL to review the document
 */
async function sendCoordinatorUploadNotification(coordinatorEmail, workerName, docType, agencyName, reviewUrl) {
    try {
        const mailOptions = {
            from: process.env.SMTP_FROM || 'noreply@shiftwise.io',
            to: coordinatorEmail,
            subject: `New Document Upload: ${workerName} - ${docType}`,
            html: `
<html>
  <body style="font-family: Arial, sans-serif; color: #333;">
    <h2>Document Review Required</h2>
    <p>A new compliance document has been uploaded:</p>
    <table style="margin: 20px 0; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Worker:</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${workerName}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Document Type:</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${docType}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Agency:</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${agencyName}</td>
      </tr>
    </table>
    <p>
      <a href="${reviewUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;">
        Review Document
      </a>
    </p>
    <hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;" />
    <p style="font-size: 12px; color: #666;">
      ShiftWise — Compliance Management for UK Healthcare Staffing
    </p>
  </body>
</html>
            `,
        };

        const result = await transporter.sendMail(mailOptions);
        console.log('Coordinator notification sent:', result.messageId);
        return result;
    } catch (error) {
        Sentry.captureException(error, {
            tags: { context: 'email.send-coordinator-notification' },
            extra: { coordinatorEmail },
        });
        throw error;
    }
}

module.exports = {
    sendWorkerOtpEmail,
    sendCoordinatorUploadNotification,
};
