CREATE TABLE "ConsumedRefreshToken" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumedRefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConsumedRefreshToken_tokenHash_key" ON "ConsumedRefreshToken"("tokenHash");
CREATE INDEX "ConsumedRefreshToken_sessionId_idx" ON "ConsumedRefreshToken"("sessionId");
CREATE INDEX "ConsumedRefreshToken_expiresAt_idx" ON "ConsumedRefreshToken"("expiresAt");

ALTER TABLE "ConsumedRefreshToken" ADD CONSTRAINT "ConsumedRefreshToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RefreshToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;
