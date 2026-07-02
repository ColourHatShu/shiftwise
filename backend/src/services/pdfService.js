const PDFDocument = require('pdfkit');
const { computeDocumentDisplayStatus } = require('../lib/document-status');

function addHeader(doc, agencyName) {
    // Top Left Header
    doc.fontSize(24).font('Helvetica-Bold').fillColor('#0f172a').text('Shift', 50, 50, { continued: true })
       .fillColor('#3b82f6').text('Wise');
    
    doc.fontSize(12).font('Helvetica').fillColor('#64748b').text(`Prepared for: ${agencyName}`, 50, 80);
}

function addFooter(doc, pageNum) {
    const bottom = doc.page.height - 50;
    doc.fontSize(9).fillColor('#94a3b8').font('Helvetica');
    doc.text('Strictly Confidential — ShiftWise Compliance Engine', 50, bottom, { width: 300, align: 'left' });
    doc.text(`Page ${pageNum}`, 350, bottom, { width: 195, align: 'right' });
}

module.exports = {
    generateReportPDF: (reportType, reportData, agencyName, res) => {
        // Initialize PDFKit document
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        
        // Stream PDF directly to response - no buffering to disk or memory
        doc.pipe(res);
        
        let pageNumber = 1;
        
        // Add initial header
        addHeader(doc, agencyName);
        
        // Determine Report Title
        let title = 'ShiftWise Report';
        if (reportType === 'COMPLIANCE') title = 'Full Compliance Report';
        else if (reportType === 'EXPIRING') title = 'Expiring Documents Report';
        else if (reportType === 'NON_COMPLIANT') title = 'Non-Compliant Workers Report';
        
        const today = new Date().toLocaleDateString('en-GB', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        
        doc.moveDown(1);
        doc.fontSize(20).font('Helvetica-Bold').fillColor('#0f172a').text(title, { align: 'right' });
        doc.fontSize(10).font('Helvetica').fillColor('#64748b').text(`Generated on ${today}`, { align: 'right' });
        doc.moveDown(2);

        // Draw line separator
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').lineWidth(2).stroke();
        doc.moveDown(2);

        // --- Workers and Documents Loop ---
        if (reportType === 'COMPLIANCE' && reportData.workers) {
            reportData.workers.forEach(worker => {
               // Calculate required height for page break logic
               const docCount = worker.documents ? worker.documents.length : 0;
               const requiredHeight = 40 + 20 + (docCount * 20);
               
               if (doc.y + requiredHeight > doc.page.height - 80) {
                   doc.addPage();
                   addHeader(doc, agencyName);
                   pageNumber++;
                   addFooter(doc, pageNumber);
                   doc.y = 120; // Explicitly reset Y cursor past the header
               }

               // Worker Name and Role
               doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text(worker.name);
               doc.fontSize(11).font('Helvetica').fillColor('#64748b').text(worker.role || 'Unassigned');
               doc.moveDown(0.5);
               
               // Table Header
               const startY = doc.y;
               doc.rect(50, startY, 495, 20).fill('#f1f5f9');
               doc.fillColor('#475569').fontSize(10).font('Helvetica-Bold');
               doc.text('Document Type', 60, startY + 6);
               doc.text('Status', 300, startY + 6);
               doc.text('Expiry Date', 400, startY + 6);
               
               let currentY = startY + 20;
               
               if (!worker.documents || worker.documents.length === 0) {
                   doc.rect(50, currentY, 495, 20).stroke('#e2e8f0');
                   doc.fillColor('#0f172a').font('Helvetica').text('No documents uploaded', 60, currentY + 6);
                   currentY += 20;
               } else {
                   worker.documents.forEach((docItem, index) => {
                       // Alternating row styling
                       if (index % 2 === 0) {
                           doc.rect(50, currentY, 495, 20).fill('#ffffff'); // white background
                       } else {
                           doc.rect(50, currentY, 495, 20).fill('#f8fafc'); // slightly gray background
                       }
                       
                       doc.fillColor('#0f172a').font('Helvetica').fontSize(10);
                       doc.text(docItem.typeName || 'Unknown Document', 60, currentY + 6, { width: 230, lineBreak: false });
                       
                       // Status Color Badge logic. An APPROVED doc past its expiry is
                       // effectively EXPIRED (red), not green — critical on the CQC report.
                       const effectiveStatus = computeDocumentDisplayStatus(docItem);
                       if (effectiveStatus === 'EXPIRED') doc.fillColor('#dc2626');
                       else if (docItem.status === 'APPROVED') doc.fillColor('#16a34a');
                       else if (docItem.status === 'PENDING') doc.fillColor('#ea580c');
                       else if (docItem.status === 'REJECTED') doc.fillColor('#dc2626');
                       else doc.fillColor('#64748b');

                       const displayStatus = effectiveStatus === 'EXPIRED' ? 'EXPIRED' : (docItem.status || 'N/A');
                       doc.text(displayStatus, 300, currentY + 6);
                       
                       doc.fillColor('#0f172a');
                       const expDate = docItem.expiryDate ? new Date(docItem.expiryDate).toLocaleDateString('en-GB') : 'N/A';
                       doc.text(expDate, 400, currentY + 6);
                       
                       currentY += 20;
                   });
               }
               
               // Bottom border for table
               doc.moveTo(50, currentY).lineTo(545, currentY).strokeColor('#e2e8f0').lineWidth(1).stroke();
               
               doc.y = currentY + 20;
            });
        } else {
            // Placeholder for other report types
            doc.fontSize(12).fillColor('#0f172a').font('Helvetica').text('Report data is being compiled inside PDFKit.');
        }
        
        // Add footer for the very first page (since event only triggers on new pages)
        addFooter(doc, 1);
        
        // Finalize PDF file
        doc.end();
    }
};
