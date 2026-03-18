/*
  Warnings:

  - You are about to drop the column `content` on the `TrackerEntry` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `TrackerEntry` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `TrackerEntry` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "TrackerEntry" DROP COLUMN "content",
DROP COLUMN "title",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
