ALTER TABLE "TrackerItem"
ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "TrackerItem_pinned_idx" ON "TrackerItem"("pinned");

CREATE INDEX "TrackerItem_sortOrder_idx" ON "TrackerItem"("sortOrder");
