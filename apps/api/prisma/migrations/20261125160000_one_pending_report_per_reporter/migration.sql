-- Two submissions at once both passed the "already filed?" check: a person
-- may have only one pending report per target.

-- Duplicates already queued are dismissed, the oldest stays pending.
UPDATE "Report" r
SET "status" = 'DISMISSED', "resolvedAt" = CURRENT_TIMESTAMP
WHERE r."status" = 'PENDING'
  AND r."reporterId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "Report" o
    WHERE o."status" = 'PENDING'
      AND o."reporterId" = r."reporterId"
      AND o."targetType" = r."targetType"
      AND o."targetId" = r."targetId"
      AND (o."createdAt", o."id") < (r."createdAt", r."id")
  );

CREATE UNIQUE INDEX "Report_one_pending_per_reporter_key"
ON "Report"("reporterId", "targetType", "targetId")
WHERE "status" = 'PENDING';
