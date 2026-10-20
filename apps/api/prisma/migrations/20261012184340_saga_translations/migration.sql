-- CreateTable
CREATE TABLE "SagaTranslation" (
    "sagaKey" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "memberTitles" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SagaTranslation_pkey" PRIMARY KEY ("sagaKey","locale")
);

-- AddForeignKey
ALTER TABLE "SagaTranslation" ADD CONSTRAINT "SagaTranslation_sagaKey_fkey" FOREIGN KEY ("sagaKey") REFERENCES "Saga"("key") ON DELETE CASCADE ON UPDATE CASCADE;
