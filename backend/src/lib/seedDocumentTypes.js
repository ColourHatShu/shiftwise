// The 8 standard document types for every ShiftWise agency.
const STANDARD_DOCUMENT_TYPES = [
    { name: 'CV', hasExpiry: false, isRequired: true, expiryWarningDays: 30, description: 'Curriculum Vitae / Resume' },
    { name: 'Passport', hasExpiry: true, isRequired: true, expiryWarningDays: 90, description: 'Valid passport or travel document' },
    { name: 'Right to Work', hasExpiry: true, isRequired: true, expiryWarningDays: 60, description: 'Right to work evidence for the UK' },
    { name: 'DBS', hasExpiry: true, isRequired: true, expiryWarningDays: 60, description: 'Disclosure and Barring Service check' },
    { name: 'Training Certificate', hasExpiry: true, isRequired: true, expiryWarningDays: 30, description: 'Relevant training and qualification certificates' },
    { name: 'NI Card', hasExpiry: false, isRequired: true, expiryWarningDays: 30, description: 'National Insurance number confirmation' },
    { name: 'References', hasExpiry: false, isRequired: true, expiryWarningDays: 30, description: 'Professional references (minimum 2)' },
    { name: 'Immunisation Records', hasExpiry: false, isRequired: true, expiryWarningDays: 30, description: 'Vaccination and immunisation history' },
];

/**
 * Idempotently seeds the 8 standard document types for a given agency.
 * Safe to call multiple times — uses upsert.
 */
async function seedDocumentTypes(agencyId, prisma) {
    for (const dt of STANDARD_DOCUMENT_TYPES) {
        await prisma.documentType.upsert({
            where: { agencyId_name: { agencyId, name: dt.name } },
            update: {},
            create: { agencyId, ...dt },
        });
    }
}

module.exports = { seedDocumentTypes, STANDARD_DOCUMENT_TYPES };
