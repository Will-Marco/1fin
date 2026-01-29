import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';
import { PrismaClient, Role } from '../generated/prisma/client';

const DATABASE_URL = process.env.DATABASE_URL as string,
  SUPERADMIN_NAME = process.env.SUPERADMIN_NAME as string,
  SUPERADMIN_USERNAME = process.env.SUPERADMIN_USERNAME as string,
  SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD as string;

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // Create SuperAdmin
  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: Role.SUPER_ADMIN },
  });

  if (!existingSuperAdmin) {
    const hashedPassword = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);

    const superAdmin = await prisma.user.create({
      data: {
        username: SUPERADMIN_USERNAME,
        password: hashedPassword,
        name: SUPERADMIN_NAME,
        role: Role.SUPER_ADMIN,
      },
    });

    console.log(`SuperAdmin created: ${superAdmin.username}`);
  } else {
    console.log('SuperAdmin already exists, skipping...');
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
