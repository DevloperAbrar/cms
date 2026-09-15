require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../config/prismaClient');

async function run() {
  const [, , collegeName, collegeCode, contactEmail, adminEmail, adminPassword] = process.argv;

  if (!collegeName || !collegeCode || !contactEmail || !adminEmail || !adminPassword) {
    console.error(
      'Usage: node scripts/migrateExistingCollegeToTenant.js "<College Name>" <college-code> <contact-email> <admin-email> <admin-password>'
    );
    process.exit(1);
  }

  const existing = await prisma.college.findUnique({ where: { code: collegeCode } });
  if (existing) {
    console.error(`A college with code "${collegeCode}" already exists (id: ${existing.id}). Aborting.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const subscriptionEnd = new Date();
  subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1); // default 1-year runway, adjust if needed

  const result = await prisma.$transaction(async (tx) => {
    const college = await tx.college.create({
      data: {
        name: collegeName,
        code: collegeCode,
        contactEmail,
        subscriptionPlan: 'standard',
        subscriptionStatus: 'active',
        subscriptionEnd,
      },
    });

    const superadmin = await tx.user.create({
      data: {
        collegeId: college.id,
        name: `${collegeName} Admin`,
        email: adminEmail.toLowerCase(),
        passwordHash,
        role: 'superadmin',
        status: 'active',
      },
    });

    await tx.subscriptionEvent.create({
      data: {
        collegeId: college.id,
        action: 'created',
        actor: 'platform_owner',
        note: 'Migrated from pre-existing single-tenant deployment',
      },
    });

    return { college, superadmin };
  });

  console.log('Done.');
  console.log('College ID:', result.college.id);
  console.log('SuperAdmin login email:', result.superadmin.email);
  console.log('Log in at POST /api/auth/superadmin/login with the password you just passed in.');

  await prisma.$disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});