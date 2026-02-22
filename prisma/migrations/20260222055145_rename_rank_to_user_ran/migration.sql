/*
  Warnings:

  - The values [APPROVED] on the enum `DocumentStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [DOCUMENT] on the enum `MessageType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `accepted_at` on the `files` table. All the data in the column will be lost.
  - You are about to drop the column `accepted_by` on the `files` table. All the data in the column will be lost.
  - You are about to drop the column `department_id` on the `files` table. All the data in the column will be lost.
  - You are about to drop the column `document_number` on the `files` table. All the data in the column will be lost.
  - You are about to drop the column `rejected_at` on the `files` table. All the data in the column will be lost.
  - You are about to drop the column `rejected_by` on the `files` table. All the data in the column will be lost.
  - You are about to drop the column `reminder_date` on the `files` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `files` table. All the data in the column will be lost.
  - You are about to drop the column `department_id` on the `files_archive` table. All the data in the column will be lost.
  - You are about to drop the column `document_number` on the `files_archive` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `files_archive` table. All the data in the column will be lost.
  - You are about to drop the column `department_id` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `department_id` on the `messages_archive` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `worker_type_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `department_members` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `departments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `document_approvals` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `document_approvals_archive` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `operator_companies` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_companies` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `worker_types` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `company_id` to the `messages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `global_department_id` to the `messages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `messages_archive` table without a default value. This is not possible if the table is not empty.
  - Added the required column `global_department_id` to the `messages_archive` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('FIN_DIRECTOR', 'FIN_ADMIN', 'FIN_EMPLOYEE');

-- CreateEnum
CREATE TYPE "CompanyRole" AS ENUM ('CLIENT_FOUNDER', 'CLIENT_DIRECTOR', 'CLIENT_EMPLOYEE');

-- AlterEnum
BEGIN;
CREATE TYPE "DocumentStatus_new" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'AUTO_EXPIRED');
ALTER TABLE "public"."document_approvals" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "documents" ALTER COLUMN "status" TYPE "DocumentStatus_new" USING ("status"::text::"DocumentStatus_new");
ALTER TABLE "documents_archive" ALTER COLUMN "status" TYPE "DocumentStatus_new" USING ("status"::text::"DocumentStatus_new");
ALTER TYPE "DocumentStatus" RENAME TO "DocumentStatus_old";
ALTER TYPE "DocumentStatus_new" RENAME TO "DocumentStatus";
DROP TYPE "public"."DocumentStatus_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "MessageType_new" AS ENUM ('TEXT', 'FILE', 'VOICE', 'DOCUMENT_FORWARD');
ALTER TABLE "public"."messages" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "messages" ALTER COLUMN "type" TYPE "MessageType_new" USING ("type"::text::"MessageType_new");
ALTER TABLE "messages_archive" ALTER COLUMN "type" TYPE "MessageType_new" USING ("type"::text::"MessageType_new");
ALTER TYPE "MessageType" RENAME TO "MessageType_old";
ALTER TYPE "MessageType_new" RENAME TO "MessageType";
DROP TYPE "public"."MessageType_old";
ALTER TABLE "messages" ALTER COLUMN "type" SET DEFAULT 'TEXT';
COMMIT;

-- DropForeignKey
ALTER TABLE "department_members" DROP CONSTRAINT "department_members_department_id_fkey";

-- DropForeignKey
ALTER TABLE "department_members" DROP CONSTRAINT "department_members_user_id_fkey";

-- DropForeignKey
ALTER TABLE "departments" DROP CONSTRAINT "departments_company_id_fkey";

-- DropForeignKey
ALTER TABLE "document_approvals" DROP CONSTRAINT "document_approvals_approved_by_fkey";

-- DropForeignKey
ALTER TABLE "document_approvals" DROP CONSTRAINT "document_approvals_message_id_fkey";

-- DropForeignKey
ALTER TABLE "files" DROP CONSTRAINT "files_department_id_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_department_id_fkey";

-- DropForeignKey
ALTER TABLE "operator_companies" DROP CONSTRAINT "operator_companies_company_id_fkey";

-- DropForeignKey
ALTER TABLE "operator_companies" DROP CONSTRAINT "operator_companies_operator_id_fkey";

-- DropForeignKey
ALTER TABLE "user_companies" DROP CONSTRAINT "user_companies_company_id_fkey";

-- DropForeignKey
ALTER TABLE "user_companies" DROP CONSTRAINT "user_companies_user_id_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_worker_type_id_fkey";

-- AlterTable
ALTER TABLE "files" DROP COLUMN "accepted_at",
DROP COLUMN "accepted_by",
DROP COLUMN "department_id",
DROP COLUMN "document_number",
DROP COLUMN "rejected_at",
DROP COLUMN "rejected_by",
DROP COLUMN "reminder_date",
DROP COLUMN "status",
ADD COLUMN     "document_id" TEXT,
ADD COLUMN     "global_department_id" TEXT;

-- AlterTable
ALTER TABLE "files_archive" DROP COLUMN "department_id",
DROP COLUMN "document_number",
DROP COLUMN "status",
ADD COLUMN     "document_id" TEXT,
ADD COLUMN     "global_department_id" TEXT;

-- AlterTable
ALTER TABLE "message_forwards" ADD COLUMN     "document_id" TEXT;

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "department_id",
ADD COLUMN     "company_id" TEXT NOT NULL,
ADD COLUMN     "global_department_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "messages_archive" DROP COLUMN "department_id",
ADD COLUMN     "company_id" TEXT NOT NULL,
ADD COLUMN     "global_department_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "role",
DROP COLUMN "worker_type_id",
ADD COLUMN     "notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "system_role" "SystemRole",
ADD COLUMN     "user_rank" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "department_members";

-- DropTable
DROP TABLE "departments";

-- DropTable
DROP TABLE "document_approvals";

-- DropTable
DROP TABLE "document_approvals_archive";

-- DropTable
DROP TABLE "operator_companies";

-- DropTable
DROP TABLE "user_companies";

-- DropTable
DROP TABLE "worker_types";

-- DropEnum
DROP TYPE "Role";

-- CreateTable
CREATE TABLE "user_company_memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "company_role" "CompanyRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_company_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_department_configs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "global_department_id" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_department_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_department_access" (
    "id" TEXT NOT NULL,
    "user_company_membership_id" TEXT NOT NULL,
    "global_department_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_department_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "global_department_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "document_name" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "created_by_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_action_logs" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents_archive" (
    "id" TEXT NOT NULL,
    "global_department_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "document_name" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL,
    "rejection_reason" TEXT,
    "created_by_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_archive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_company_memberships_user_id_company_id_key" ON "user_company_memberships"("user_id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "global_departments_slug_key" ON "global_departments"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "company_department_configs_company_id_global_department_id_key" ON "company_department_configs"("company_id", "global_department_id");

-- CreateIndex
CREATE UNIQUE INDEX "membership_department_access_user_company_membership_id_glo_key" ON "membership_department_access"("user_company_membership_id", "global_department_id");

-- AddForeignKey
ALTER TABLE "user_company_memberships" ADD CONSTRAINT "user_company_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_company_memberships" ADD CONSTRAINT "user_company_memberships_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_department_configs" ADD CONSTRAINT "company_department_configs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_department_configs" ADD CONSTRAINT "company_department_configs_global_department_id_fkey" FOREIGN KEY ("global_department_id") REFERENCES "global_departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_department_access" ADD CONSTRAINT "membership_department_access_user_company_membership_id_fkey" FOREIGN KEY ("user_company_membership_id") REFERENCES "user_company_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_department_access" ADD CONSTRAINT "membership_department_access_global_department_id_fkey" FOREIGN KEY ("global_department_id") REFERENCES "global_departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_global_department_id_fkey" FOREIGN KEY ("global_department_id") REFERENCES "global_departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_action_logs" ADD CONSTRAINT "document_action_logs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_global_department_id_fkey" FOREIGN KEY ("global_department_id") REFERENCES "global_departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_forwards" ADD CONSTRAINT "message_forwards_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_global_department_id_fkey" FOREIGN KEY ("global_department_id") REFERENCES "global_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
