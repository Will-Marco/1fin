/*
  Warnings:

  - You are about to drop the column `company_role` on the `user_company_memberships` table. All the data in the column will be lost.
  - You are about to drop the column `user_rank` on the `users` table. All the data in the column will be lost.
  - Made the column `system_role` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SystemRole" ADD VALUE 'CLIENT_FOUNDER';
ALTER TYPE "SystemRole" ADD VALUE 'CLIENT_DIRECTOR';
ALTER TYPE "SystemRole" ADD VALUE 'CLIENT_EMPLOYEE';

-- AlterTable
ALTER TABLE "user_company_memberships" DROP COLUMN "company_role",
ADD COLUMN     "rank" INTEGER;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "user_rank",
ALTER COLUMN "system_role" SET NOT NULL;

-- DropEnum
DROP TYPE "CompanyRole";
