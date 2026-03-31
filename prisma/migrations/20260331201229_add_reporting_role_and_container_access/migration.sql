-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'REPORTING';

-- CreateTable
CREATE TABLE "ContainerAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackerItemId" TEXT NOT NULL,
    "accessType" TEXT NOT NULL DEFAULT 'read',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContainerAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContainerAccess_userId_idx" ON "ContainerAccess"("userId");

-- CreateIndex
CREATE INDEX "ContainerAccess_trackerItemId_idx" ON "ContainerAccess"("trackerItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ContainerAccess_userId_trackerItemId_accessType_key" ON "ContainerAccess"("userId", "trackerItemId", "accessType");

-- AddForeignKey
ALTER TABLE "ContainerAccess" ADD CONSTRAINT "ContainerAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContainerAccess" ADD CONSTRAINT "ContainerAccess_trackerItemId_fkey" FOREIGN KEY ("trackerItemId") REFERENCES "TrackerItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
