-- The bottom bar's organisation now lives on each device (localStorage).
ALTER TABLE "User" DROP COLUMN "mobileNavShortcuts";
