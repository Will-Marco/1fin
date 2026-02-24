-- CreateTable
CREATE TABLE "user_department_reads" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "global_department_id" TEXT NOT NULL,
    "last_read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_department_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_department_reads_user_id_company_id_global_department__key" ON "user_department_reads"("user_id", "company_id", "global_department_id");

-- AddForeignKey
ALTER TABLE "user_department_reads" ADD CONSTRAINT "user_department_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_department_reads" ADD CONSTRAINT "user_department_reads_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_department_reads" ADD CONSTRAINT "user_department_reads_global_department_id_fkey" FOREIGN KEY ("global_department_id") REFERENCES "global_departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
