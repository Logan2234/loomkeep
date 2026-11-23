-- AlterTable
ALTER TABLE "BookEntry" ADD COLUMN     "lentOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "loanPerson" TEXT,
ADD COLUMN     "loanSince" DATE;

-- AlterTable
ALTER TABLE "GameEntry" ADD COLUMN     "lentOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "loanPerson" TEXT,
ADD COLUMN     "loanSince" DATE;

-- AlterTable
ALTER TABLE "LibraryEntry" ADD COLUMN     "lentOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "loanPerson" TEXT,
ADD COLUMN     "loanSince" DATE;

-- AlterTable
ALTER TABLE "MusicEntry" ADD COLUMN     "lentOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "loanPerson" TEXT,
ADD COLUMN     "loanSince" DATE;
