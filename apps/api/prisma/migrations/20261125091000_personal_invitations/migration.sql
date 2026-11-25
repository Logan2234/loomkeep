-- A member's own reusable invitation link (SOC-02).
ALTER TABLE "Invitation" ADD COLUMN "personal" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "token" TEXT;

CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- One personal link per member.
CREATE UNIQUE INDEX "Invitation_one_personal_per_creator_idx" ON "Invitation"("createdById") WHERE "personal";

ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_personal_token_check"
  CHECK (NOT "personal" OR "token" IS NOT NULL);
