-- AlterTable
ALTER TABLE "files" ALTER COLUMN "is_outgoing" DROP NOT NULL,
ALTER COLUMN "is_outgoing" DROP DEFAULT;

-- AlterTable
ALTER TABLE "files_archive" ALTER COLUMN "is_outgoing" DROP NOT NULL;

-- AlterTable
ALTER TABLE "messages" ALTER COLUMN "is_outgoing" DROP NOT NULL,
ALTER COLUMN "is_outgoing" DROP DEFAULT;

-- AlterTable
ALTER TABLE "messages_archive" ALTER COLUMN "is_outgoing" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
