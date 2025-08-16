-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ping" TEXT,
    "endTime" BIGINT NOT NULL,
    "timeString" TEXT,
    "title" TEXT,
    "desc" TEXT
);
INSERT INTO "new_Event" ("channelId", "desc", "endTime", "id", "ping", "timeString", "title", "type", "userId") SELECT "channelId", "desc", "endTime", "id", "ping", "timeString", "title", "type", "userId" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
