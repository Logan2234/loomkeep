-- When newsletter consent was last withdrawn (GDPR art. 7(3)).
ALTER TABLE "UserConsent" ADD COLUMN "newsletterOptOutAt" TIMESTAMP(3);
