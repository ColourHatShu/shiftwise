/**
 * seed-comprehensive.js
 *
 * Idempotent comprehensive seed for ShiftWise local/dev environments.
 * Creates a single fully-populated agency with realistic mixed data so
 * every UI page renders meaningful content.
 *
 * Run: node prisma/seed-comprehensive.js
 *      (or:  npx prisma db seed  — after wiring "prisma.seed" in package.json)
 *
 * Safe to re-run: uses upsert / deterministic IDs where possible and
 * cleans children before re-seeding the demo agency by slug "demo-agency".
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const AGENCY_SLUG = 'demo-agency';

// ─── helpers ─────────────────────────────────────────────────────────────────
const daysFromNow = (n) => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + n);
    return d;
};
const pick = (arr, i) => arr[i % arr.length];

async function main() {
    console.log('🌱 Seeding comprehensive demo data...');

    // ─── 1) Agency ───────────────────────────────────────────────────────────
    const agency = await prisma.agency.upsert({
        where: { slug: AGENCY_SLUG },
        update: { isOnboarded: true, isActive: true },
        create: {
            name: 'Demo Healthcare Staffing Ltd',
            slug: AGENCY_SLUG,
            email: 'coordinator@demo-agency.test',
            phone: '+44 20 7946 0000',
            address: '1 Demo Street',
            city: 'London',
            postcode: 'EC1A 1AA',
            agencyType: 'Healthcare',
            isActive: true,
            isOnboarded: true,
        },
    });
    console.log(`  ✓ Agency: ${agency.name} (${agency.id})`);

    // Wipe child data for this agency to ensure deterministic re-seed
    await prisma.shiftAssignment.deleteMany({ where: { agencyId: agency.id } });
    await prisma.shift.deleteMany({ where: { agencyId: agency.id } });
    await prisma.workerAvailability.deleteMany({ where: { agencyId: agency.id } });
    await prisma.expiryAlert.deleteMany({ where: { agencyId: agency.id } });
    await prisma.failedAlert.deleteMany({ where: { agencyId: agency.id } });
    await prisma.complianceDocument.deleteMany({ where: { agencyId: agency.id } });
    await prisma.documentType.deleteMany({ where: { agencyId: agency.id } });
    await prisma.auditLog.deleteMany({ where: { agencyId: agency.id } });
    await prisma.workerSession.deleteMany({ where: { agencyId: agency.id } });
    await prisma.worker.deleteMany({ where: { agencyId: agency.id } });
    await prisma.user.deleteMany({ where: { agencyId: agency.id } });

    // ─── 2) Users (OWNER, ADMIN, STAFF) ──────────────────────────────────────
    const users = await Promise.all([
        prisma.user.create({
            data: {
                clerkId: 'user_demo_owner',
                agencyId: agency.id,
                email: 'owner@demo-agency.test',
                firstName: 'Olivia',
                lastName: 'Owner',
                role: 'OWNER',
            },
        }),
        prisma.user.create({
            data: {
                clerkId: 'user_demo_admin',
                agencyId: agency.id,
                email: 'admin@demo-agency.test',
                firstName: 'Alan',
                lastName: 'Admin',
                role: 'ADMIN',
            },
        }),
        prisma.user.create({
            data: {
                clerkId: 'user_demo_staff',
                agencyId: agency.id,
                email: 'staff@demo-agency.test',
                firstName: 'Sam',
                lastName: 'Staff',
                role: 'STAFF',
            },
        }),
    ]);
    console.log(`  ✓ Users: ${users.length}`);

    // ─── 3) DocumentTypes ────────────────────────────────────────────────────
    const docTypeSpecs = [
        { name: 'DBS Check', expiryWarningDays: 60, isRequired: true },
        { name: 'Right to Work', expiryWarningDays: 30, isRequired: true },
        { name: 'NMC PIN', expiryWarningDays: 90, isRequired: true },
        { name: 'Passport', expiryWarningDays: 90, isRequired: true },
        { name: 'Training Certificate', expiryWarningDays: 30, isRequired: true },
    ];
    const docTypes = [];
    for (const spec of docTypeSpecs) {
        docTypes.push(
            await prisma.documentType.create({
                data: { agencyId: agency.id, hasExpiry: true, ...spec },
            })
        );
    }
    console.log(`  ✓ DocumentTypes: ${docTypes.length}`);

    // ─── 4) Workers (10, mix of statuses) ────────────────────────────────────
    const workerSpecs = [
        ['Aisha', 'Khan', 'Nurse'],
        ['Ben', 'Carter', 'Carer'],
        ['Chioma', 'Okafor', 'Support Worker'],
        ['Daniel', 'Smith', 'Nurse'],
        ['Ella', 'Brown', 'Carer'],
        ['Farhan', 'Iqbal', 'Support Worker'],
        ['Grace', 'Lee', 'Nurse'],
        ['Hassan', 'Ali', 'Carer'],
        ['Isla', 'Murphy', 'Support Worker'],
        ['Jamal', 'Wright', 'Nurse'],
    ];
    const workers = [];
    for (let i = 0; i < workerSpecs.length; i++) {
        const [first, last, jobTitle] = workerSpecs[i];
        workers.push(
            await prisma.worker.create({
                data: {
                    agencyId: agency.id,
                    firstName: first,
                    lastName: last,
                    email: `${first.toLowerCase()}.${last.toLowerCase()}@workers.demo-agency.test`,
                    phone: `+447700900${(100 + i).toString()}`,
                    jobTitle,
                    startDate: daysFromNow(-365 + i * 10),
                    status: i === 9 ? 'INACTIVE' : 'ACTIVE',
                    isActive: i !== 9,
                },
            })
        );
    }
    console.log(`  ✓ Workers: ${workers.length}`);

    // ─── 5) ComplianceDocuments (30, mix of statuses & expiry timings) ───────
    // Distribution: 6 EXPIRED, 9 expiring soon (PENDING/APPROVED), 12 APPROVED valid, 3 REJECTED
    const statuses = ['APPROVED', 'PENDING', 'REJECTED', 'EXPIRED'];
    let docCount = 0;
    for (let i = 0; i < workers.length; i++) {
        const worker = workers[i];
        // 3 docs per worker = 30 total
        for (let j = 0; j < 3; j++) {
            const docType = pick(docTypes, i + j);
            // Spread of timings
            const dayOffset = ((i * 3 + j) % 12) - 4; // -4..7 bucket
            let expiryDate, status;
            if (dayOffset < -2) {
                expiryDate = daysFromNow(-30 - (i + j));
                status = 'EXPIRED';
            } else if (dayOffset < 1) {
                expiryDate = daysFromNow(7 + j); // expiring inside warning window
                status = j % 2 === 0 ? 'APPROVED' : 'PENDING';
            } else if (dayOffset < 4) {
                expiryDate = daysFromNow(60 + i * 5);
                status = 'APPROVED';
            } else {
                expiryDate = daysFromNow(180 + i);
                status = pick(['APPROVED', 'PENDING', 'REJECTED'], i + j);
            }
            await prisma.complianceDocument.create({
                data: {
                    agencyId: agency.id,
                    workerId: worker.id,
                    documentTypeId: docType.id,
                    fileUrl: `https://r2.demo/${worker.id}-${docType.id}.pdf`,
                    fileKey: `uploads/${worker.id}-${docType.id}.pdf`,
                    fileName: `${docType.name.replace(/\s+/g, '_')}_${worker.lastName}.pdf`,
                    fileSize: 123456 + i * 1000,
                    mimeType: 'application/pdf',
                    encryptionAlgorithm: 'aes-256-gcm',
                    status,
                    issueDate: daysFromNow(-180),
                    expiryDate,
                    notes: status === 'REJECTED' ? 'Illegible scan' : null,
                    rejectionReason: status === 'REJECTED' ? 'Please re-upload clearer copy' : null,
                    reviewedAt: status === 'APPROVED' || status === 'REJECTED' ? daysFromNow(-1) : null,
                },
            });
            docCount++;
        }
    }
    console.log(`  ✓ ComplianceDocuments: ${docCount}`);

    // ─── 6) Shifts (10, past / today / future, mix of roles) ─────────────────
    const facilities = ['St Mary Care Home', 'Riverside Hospital', 'Sunrise Lodge', 'Oak Park Nursing'];
    const roles = ['Nurse', 'Carer', 'Support Worker'];
    const shifts = [];
    const offsets = [-7, -3, -1, 0, 0, 1, 3, 7, 14, 30];
    for (let i = 0; i < offsets.length; i++) {
        shifts.push(
            await prisma.shift.create({
                data: {
                    agencyId: agency.id,
                    facilityName: pick(facilities, i),
                    shiftDate: daysFromNow(offsets[i]),
                    startTime: i % 2 === 0 ? '08:00' : '20:00',
                    endTime: i % 2 === 0 ? '16:00' : '04:00',
                    role: pick(roles, i),
                    requiredCount: 1 + (i % 3),
                    complianceCheckup: i % 2 === 0,
                    notes: `Demo shift #${i + 1}`,
                },
            })
        );
    }
    console.log(`  ✓ Shifts: ${shifts.length}`);

    // ─── 7) ShiftAssignments (5, mix of confirmation statuses) ───────────────
    const confirmations = ['pending', 'confirmed', 'confirmed', 'declined', 'pending'];
    for (let i = 0; i < 5; i++) {
        await prisma.shiftAssignment.create({
            data: {
                shiftId: shifts[i + 2].id,
                workerId: workers[i].id,
                agencyId: agency.id,
                complianceCheckPassed: i !== 3,
                complianceCheckDetails: i === 3 ? { missingDocs: ['DBS Check'] } : null,
                complianceSnapshot: {
                    workerId: workers[i].id,
                    capturedAt: new Date().toISOString(),
                    score: 80 + i * 4,
                },
                workerConfirmation: confirmations[i],
                workerNote: confirmations[i] === 'declined' ? 'On annual leave' : null,
                notes: `Auto-seeded assignment #${i + 1}`,
            },
        });
    }
    console.log(`  ✓ ShiftAssignments: 5`);

    // ─── 8) AuditLog (50 entries spanning actions/entities) ──────────────────
    const auditTemplates = [
        { action: 'worker.created', entity: 'Worker' },
        { action: 'worker.updated', entity: 'Worker' },
        { action: 'document.uploaded', entity: 'ComplianceDocument' },
        { action: 'document.approved', entity: 'ComplianceDocument' },
        { action: 'document.rejected', entity: 'ComplianceDocument' },
        { action: 'shift.created', entity: 'Shift' },
        { action: 'shift.assigned', entity: 'ShiftAssignment' },
        { action: 'alert.expiry_warning_sent', entity: 'ComplianceDocument' },
        { action: 'agency.updated', entity: 'Agency' },
        { action: 'user.invited', entity: 'User' },
    ];
    for (let i = 0; i < 50; i++) {
        const tpl = auditTemplates[i % auditTemplates.length];
        await prisma.auditLog.create({
            data: {
                agencyId: agency.id,
                userId: users[i % users.length].id,
                action: tpl.action,
                entity: tpl.entity,
                entityId: `seed-entity-${i}`,
                metadata: { seedIndex: i, note: 'auto-generated' },
                ipAddress: '127.0.0.1',
                userAgent: 'seed-script/1.0',
                createdAt: daysFromNow(-Math.floor(i / 2)),
            },
        });
    }
    console.log('  ✓ AuditLog: 50');

    console.log('\n✅ Seed complete.');
    console.log(`   Agency slug: ${AGENCY_SLUG}`);
    console.log('   Sign in as one of:');
    console.log('     OWNER  clerkId=user_demo_owner  email=owner@demo-agency.test');
    console.log('     ADMIN  clerkId=user_demo_admin  email=admin@demo-agency.test');
    console.log('     STAFF  clerkId=user_demo_staff  email=staff@demo-agency.test');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
