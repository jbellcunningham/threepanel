/*
  Warnings:

  - You are about to drop the column `order` on the `TodoItem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "TodoItem" DROP COLUMN "order",
ADD COLUMN     "listPosition" INTEGER NOT NULL DEFAULT 0;
