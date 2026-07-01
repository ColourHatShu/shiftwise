const nodemailer = require('./nodemailer');
const logger = require('./logger').child({ service: 'mail' });

/**
 * Send worker assignment notification email
 * Per R-SA-04: Email notification when worker assigned to shift
 */
async function sendWorkerAssignmentEmail(assignment, shift, worker, coordinator, agencyName) {
    try {
        const shiftDate = new Date(shift.shiftDate);
        const formattedDate = shiftDate.toLocaleDateString('en-GB', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const subject = `[Shift Confirmed] ${shift.facilityName} — ${formattedDate}, ${shift.startTime}`;

        const html = `
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0066cc; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .body { background: #f9f9f9; padding: 20px; border-left: 4px solid #0066cc; }
    .footer { background: #f0f0f0; padding: 15px; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #0066cc; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; margin: 20px 0; }
    .detail-row { margin: 12px 0; }
    .detail-label { color: #666; font-size: 14px; }
    .detail-value { font-size: 16px; font-weight: bold; color: #333; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Shift Assignment</h1>
    </div>

    <div class="body">
      <p>Hi ${worker.firstName},</p>

      <p>You've been assigned to a shift by <strong>${coordinator.firstName} ${coordinator.lastName}</strong> at <strong>${agencyName}</strong>.</p>

      <h2 style="color: #0066cc; margin-top: 20px;">Shift Details</h2>

      <div class="detail-row">
        <div class="detail-label">Facility</div>
        <div class="detail-value">${shift.facilityName}</div>
      </div>

      <div class="detail-row">
        <div class="detail-label">Date</div>
        <div class="detail-value">${formattedDate}</div>
      </div>

      <div class="detail-row">
        <div class="detail-label">Time</div>
        <div class="detail-value">${shift.startTime} - ${shift.endTime}</div>
      </div>

      <div class="detail-row">
        <div class="detail-label">Duration</div>
        <div class="detail-value">${((parseInt(shift.endTime) - parseInt(shift.startTime)) || 0)} hours</div>
      </div>

      <div class="detail-row">
        <div class="detail-label">Role</div>
        <div class="detail-value">${shift.role}</div>
      </div>

      ${shift.notes ? `<div class="detail-row"><div class="detail-label">Notes</div><div class="detail-value">${shift.notes}</div></div>` : ''}

      <h2 style="color: #0066cc; margin-top: 20px;">Next Steps</h2>

      <p>Please confirm or decline this shift in your worker portal. You have until 24 hours before the shift to respond.</p>

      <a href="https://shiftwise.app/worker/dashboard/assigned-shifts" class="button">Confirm Shift in Portal</a>

      <h2 style="color: #0066cc; margin-top: 20px;">Questions?</h2>

      <p>Contact your coordinator: <strong>${coordinator.firstName} ${coordinator.lastName}</strong> (${coordinator.email})</p>
    </div>

    <div class="footer">
      <p><a href="https://shiftwise.app/worker/dashboard/assigned-shifts">View all assigned shifts</a></p>
      <p>&copy; 2026 ShiftWise. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
        `;

        // Send via nodemailer (or Resend if configured)
        const result = await nodemailer.transporter.sendMail({
            from: process.env.EMAIL_FROM || 'noreply@shiftwise.app',
            to: worker.email,
            subject,
            html
        });

        logger.info({ workerEmail: worker.email }, 'Shift assignment email sent');
        return { success: true, messageId: result.messageId };
    } catch (error) {
        logger.error({ err: error }, 'Error sending assignment email');
        // Create FailedAlert for retry (Phase 4 pattern)
        // This is deferred to async processing
        throw error;
    }
}

module.exports = {
    sendWorkerAssignmentEmail
};
