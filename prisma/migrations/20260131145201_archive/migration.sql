/*
  Warnings:

  - You are about to drop the column `s3_key` on the `files` table. All the data in the column will be lost.
  - Added the required column `file_type` to the `files` table without a default value. This is not possible if the table is not empty.
  - Added the required column `original_name` to the `files` table without a default value. This is not possible if the table is not empty.
  - Added the required column `path` to the `files` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `messages_archive` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('IMAGE', 'DOCUMENT', 'VOICE', 'OTHER');

-- AlterTable
ALTER TABLE "files" DROP COLUMN "s3_key",
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by" TEXT,
ADD COLUMN     "file_type" "FileType" NOT NULL,
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "original_name" TEXT NOT NULL,
ADD COLUMN     "path" TEXT NOT NULL,
ALTER COLUMN "department_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "messages_archive" ADD COLUMN     "reply_to_id" TEXT,
ADD COLUMN     "type" "MessageType" NOT NULL,
ADD COLUMN     "voice_duration" INTEGER;

-- CreateTable
CREATE TABLE "files_archive" (
    "id" TEXT NOT NULL,
    "department_id" TEXT,
    "message_id" TEXT,
    "uploaded_by" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_type" "FileType" NOT NULL,
    "path" TEXT NOT NULL,
    "document_number" TEXT,
    "status" "FileStatus" NOT NULL,
    "is_outgoing" BOOLEAN NOT NULL,
    "is_deleted" BOOLEAN NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_archive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_approvals_archive" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "document_name" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL,
    "rejection_reason" TEXT,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_approvals_archive_pkey" PRIMARY KEY ("id")
);
