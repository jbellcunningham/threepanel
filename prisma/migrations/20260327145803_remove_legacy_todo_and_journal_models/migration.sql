/*
  Warnings:

  - You are about to drop the `JournalEntry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TodoItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "JournalEntry" DROP CONSTRAINT "JournalEntry_userId_fkey";

-- DropForeignKey
ALTER TABLE "TodoItem" DROP CONSTRAINT "TodoItem_userId_fkey";

-- DropTable
DROP TABLE "JournalEntry";

-- DropTable
DROP TABLE "TodoItem";
