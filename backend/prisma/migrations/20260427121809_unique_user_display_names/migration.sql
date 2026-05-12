ALTER TABLE "users"
ADD COLUMN "display_name_key" TEXT;

WITH normalized_users AS (
  SELECT
    id,
    REGEXP_REPLACE(TRIM(display_name), '\s+', ' ', 'g') AS normalized_display_name,
    LOWER(REGEXP_REPLACE(TRIM(display_name), '\s+', ' ', 'g')) AS normalized_display_name_key,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(REGEXP_REPLACE(TRIM(display_name), '\s+', ' ', 'g'))
      ORDER BY id
    ) AS duplicate_rank
  FROM "users"
),
resolved_users AS (
  SELECT
    id,
    CASE
      WHEN duplicate_rank = 1 THEN normalized_display_name
      ELSE normalized_display_name || '-' || duplicate_rank
    END AS next_display_name,
    CASE
      WHEN duplicate_rank = 1 THEN normalized_display_name_key
      ELSE normalized_display_name_key || '-' || duplicate_rank
    END AS next_display_name_key
  FROM normalized_users
)
UPDATE "users" AS users
SET
  "display_name" = resolved_users.next_display_name,
  "display_name_key" = resolved_users.next_display_name_key
FROM resolved_users
WHERE users.id = resolved_users.id;

ALTER TABLE "users"
ALTER COLUMN "display_name_key" SET NOT NULL;

ALTER TABLE "users"
ADD CONSTRAINT "users_display_name_key_key" UNIQUE ("display_name_key");
