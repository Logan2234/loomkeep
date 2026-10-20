CREATE INDEX "Report_reporterId_status_createdAt_idx"
ON "Report"("reporterId", "status", "createdAt");

CREATE INDEX "SecurityEvent_createdAt_idx"
ON "SecurityEvent"("createdAt");

CREATE INDEX "ImportRun_startedAt_idx"
ON "ImportRun"("startedAt");
