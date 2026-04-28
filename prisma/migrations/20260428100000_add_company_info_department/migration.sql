-- Add "Korxona ma'lumotlari" department
-- Special rules: FIN only chat, client can view but not write, no approve/reject

INSERT INTO "global_departments" ("id", "name", "slug", "is_active", "created_at", "updated_at")
VALUES (
  gen_random_uuid()::text,
  'Korxona maʼlumotlari',
  'company-info',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (slug) DO NOTHING;

-- Add company-info department to all existing companies
INSERT INTO "company_department_configs" ("id", "company_id", "global_department_id", "is_enabled", "created_at", "updated_at")
SELECT
  gen_random_uuid()::text,
  c.id,
  gd.id,
  true,
  NOW(),
  NOW()
FROM "companies" c
CROSS JOIN "global_departments" gd
WHERE gd.slug = 'company-info'
ON CONFLICT DO NOTHING;
