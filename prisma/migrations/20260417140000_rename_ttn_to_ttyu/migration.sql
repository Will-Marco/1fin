-- Rename TTN to TTYU (name and slug)
UPDATE "global_departments" SET "name" = 'TTYU', "slug" = 'ttyu' WHERE "slug" = 'ttn';
