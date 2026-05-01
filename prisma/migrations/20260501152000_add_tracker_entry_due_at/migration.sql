ALTER TABLE "TrackerEntry"
ADD COLUMN "dueAt" TIMESTAMP(3);

CREATE INDEX "TrackerEntry_dueAt_idx" ON "TrackerEntry"("dueAt");
