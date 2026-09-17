-- AlterTable
ALTER TABLE "User" ADD COLUMN "domainOrder" "Domain"[] DEFAULT ARRAY[]::"Domain"[];
