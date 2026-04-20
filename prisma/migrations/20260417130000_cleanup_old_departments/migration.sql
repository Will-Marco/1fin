-- Migration: Cleanup old departments and update names
-- Removes: company-info, waybill, dogovor
-- Updates: reconciliation name, hr name

-- Step 1: Update department names
UPDATE "global_departments" SET "name" = 'Solishtirma dalolatnoma' WHERE "slug" = 'reconciliation';
UPDATE "global_departments" SET "name" = 'HR' WHERE "slug" = 'hr';
UPDATE "global_departments" SET "name" = 'TTN' WHERE "slug" = 'ttn';

-- Step 2: Get IDs of departments to delete
-- Delete related records first (to avoid foreign key constraints)

-- Delete from files (related to messages in these departments)
DELETE FROM "files" WHERE "global_department_id" IN (
    SELECT "id" FROM "global_departments" WHERE "slug" IN ('company-info', 'waybill', 'dogovor')
);

-- Delete from document_action_logs (related to documents)
DELETE FROM "document_action_logs" WHERE "document_id" IN (
    SELECT "id" FROM "documents" WHERE "global_department_id" IN (
        SELECT "id" FROM "global_departments" WHERE "slug" IN ('company-info', 'waybill', 'dogovor')
    )
);

-- Delete from message_forwards (related to messages)
DELETE FROM "message_forwards" WHERE "original_message_id" IN (
    SELECT "id" FROM "messages" WHERE "global_department_id" IN (
        SELECT "id" FROM "global_departments" WHERE "slug" IN ('company-info', 'waybill', 'dogovor')
    )
) OR "forwarded_message_id" IN (
    SELECT "id" FROM "messages" WHERE "global_department_id" IN (
        SELECT "id" FROM "global_departments" WHERE "slug" IN ('company-info', 'waybill', 'dogovor')
    )
);

-- Delete from message_edits (related to messages)
DELETE FROM "message_edits" WHERE "message_id" IN (
    SELECT "id" FROM "messages" WHERE "global_department_id" IN (
        SELECT "id" FROM "global_departments" WHERE "slug" IN ('company-info', 'waybill', 'dogovor')
    )
);

-- Delete from documents
DELETE FROM "documents" WHERE "global_department_id" IN (
    SELECT "id" FROM "global_departments" WHERE "slug" IN ('company-info', 'waybill', 'dogovor')
);

-- Delete from messages
DELETE FROM "messages" WHERE "global_department_id" IN (
    SELECT "id" FROM "global_departments" WHERE "slug" IN ('company-info', 'waybill', 'dogovor')
);

-- Delete from user_department_reads (CASCADE should handle this, but explicit is safer)
DELETE FROM "user_department_reads" WHERE "global_department_id" IN (
    SELECT "id" FROM "global_departments" WHERE "slug" IN ('company-info', 'waybill', 'dogovor')
);

-- Delete from membership_department_access (CASCADE should handle this, but explicit is safer)
DELETE FROM "membership_department_access" WHERE "global_department_id" IN (
    SELECT "id" FROM "global_departments" WHERE "slug" IN ('company-info', 'waybill', 'dogovor')
);

-- Delete from company_department_configs (CASCADE should handle this, but explicit is safer)
DELETE FROM "company_department_configs" WHERE "global_department_id" IN (
    SELECT "id" FROM "global_departments" WHERE "slug" IN ('company-info', 'waybill', 'dogovor')
);

-- Step 3: Finally delete the departments
DELETE FROM "global_departments" WHERE "slug" IN ('company-info', 'waybill', 'dogovor');
