-- Backfill NULL emails with unique placeholder values before adding NOT NULL constraint
UPDATE merchants
SET email = CONCAT('legacy_', SUBSTRING(COALESCE(bch_address, id) FROM '.{8}$'), '@cashtap.local')
WHERE email IS NULL;

-- Deduplicate any remaining duplicate emails by appending row number
WITH dupes AS (
  SELECT id, email, ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at) AS rn
  FROM merchants
  WHERE email IS NOT NULL
)
UPDATE merchants
SET email = CONCAT(dupes.rn, '_', merchants.email)
FROM dupes
WHERE merchants.id = dupes.id AND dupes.rn > 1;
