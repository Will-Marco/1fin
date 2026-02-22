import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';
import { PrismaClient, SystemRole } from '../generated/prisma/client';

const DATABASE_URL = process.env.DATABASE_URL as string,
  SUPERADMIN_NAME = process.env.SUPERADMIN_NAME as string,
  SUPERADMIN_USERNAME = process.env.SUPERADMIN_USERNAME as string,
  SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD as string;

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Default global departments from SRS
const DEFAULT_GLOBAL_DEPARTMENTS = [
  { name: 'Umumiy chat', slug: 'general-chat' },
  { name: "Bank to'lovlari", slug: 'bank-payment' }, // Special: no accept/reject
  { name: 'Shartnomalar', slug: 'contract' },
  { name: 'Hisob-faktura', slug: 'invoice' },
  { name: 'Ishonchnoma', slug: 'power-of-attorney' },
  { name: 'Yuk xati (TTN)', slug: 'waybill' },
  { name: 'Akt sverka', slug: 'reconciliation' },
  { name: "Kadrlar bo'limi", slug: 'hr' },
  { name: "Korxona ma'lumotlari", slug: 'company-info' },
  { name: 'Xatlar', slug: 'letters' },
  { name: 'Dogovor', slug: 'dogovor' },
];

async function main() {
  console.log('Seeding database...');

  // Create Global Departments
  console.log('Creating global departments...');
  for (const dept of DEFAULT_GLOBAL_DEPARTMENTS) {
    const existing = await prisma.globalDepartment.findUnique({
      where: { slug: dept.slug },
    });

    if (!existing) {
      await prisma.globalDepartment.create({
        data: dept,
      });
      console.log(`  Created department: ${dept.name}`);
    } else {
      console.log(`  Department exists: ${dept.name}`);
    }
  }

  // Create 1FIN Director (SuperAdmin)
  const existingDirector = await prisma.user.findFirst({
    where: { systemRole: SystemRole.FIN_DIRECTOR },
  });

  if (!existingDirector) {
    const hashedPassword = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);

    const director = await prisma.user.create({
      data: {
        username: SUPERADMIN_USERNAME,
        password: hashedPassword,
        name: SUPERADMIN_NAME,
        systemRole: SystemRole.FIN_DIRECTOR,
      },
    });

    console.log(`1FIN Director created: ${director.username}`);
  } else {
    console.log('1FIN Director already exists, skipping...');
  }

  // Create 1FIN Admin
  const existingAdmin = await prisma.user.findFirst({
    where: { systemRole: SystemRole.FIN_ADMIN },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const admin = await prisma.user.create({
      data: {
        username: 'admin',
        password: hashedPassword,
        name: '1FIN Admin',
        systemRole: SystemRole.FIN_ADMIN,
      },
    });

    console.log(`1FIN Admin created: ${admin.username}`);
  } else {
    console.log('1FIN Admin already exists, skipping...');
  }

  // Create 1FIN Employee
  const existingEmployee = await prisma.user.findFirst({
    where: { systemRole: SystemRole.FIN_EMPLOYEE },
  });

  if (!existingEmployee) {
    const hashedPassword = await bcrypt.hash('employee123', 10);

    const employee = await prisma.user.create({
      data: {
        username: 'employee',
        password: hashedPassword,
        name: '1FIN Employee',
        systemRole: SystemRole.FIN_EMPLOYEE,
      },
    });

    console.log(`1FIN Employee created: ${employee.username}`);
  } else {
    console.log('1FIN Employee already exists, skipping...');
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
