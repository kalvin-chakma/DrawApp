-- AlterTable: add viewToken as nullable first so existing rows aren't rejected
ALTER TABLE "Room" ADD COLUMN "viewToken" TEXT;

-- Backfill existing rows with a random unguessable token (no extensions required)
UPDATE "Room" SET "viewToken" = md5(random()::text || clock_timestamp()::text) WHERE "viewToken" IS NULL;

-- Now that every row has a value, enforce NOT NULL
ALTER TABLE "Room" ALTER COLUMN "viewToken" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Room_viewToken_key" ON "Room"("viewToken");
