/*
  Warnings:

  - You are about to drop the column `from_department_id` on the `message_forwards` table. All the data in the column will be lost.
  - You are about to drop the column `message_id` on the `message_forwards` table. All the data in the column will be lost.
  - You are about to drop the column `to_department_id` on the `message_forwards` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[forwarded_message_id]` on the table `message_forwards` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `forwarded_message_id` to the `message_forwards` table without a default value. This is not possible if the table is not empty.
  - Added the required column `original_message_id` to the `message_forwards` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "message_forwards" DROP CONSTRAINT "message_forwards_message_id_fkey";

-- AlterTable
ALTER TABLE "message_forwards" DROP COLUMN "from_department_id",
DROP COLUMN "message_id",
DROP COLUMN "to_department_id",
ADD COLUMN     "forwarded_message_id" TEXT NOT NULL,
ADD COLUMN     "original_message_id" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "message_forwards_forwarded_message_id_key" ON "message_forwards"("forwarded_message_id");

-- AddForeignKey
ALTER TABLE "message_forwards" ADD CONSTRAINT "message_forwards_forwarded_message_id_fkey" FOREIGN KEY ("forwarded_message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_forwards" ADD CONSTRAINT "message_forwards_original_message_id_fkey" FOREIGN KEY ("original_message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
