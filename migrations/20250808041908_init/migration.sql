-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "presets" JSONB NOT NULL,
    "premium" TEXT,
    "timezone" TEXT
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ping" TEXT,
    "endTime" BIGINT NOT NULL,
    "timeString" TEXT,
    "title" TEXT,
    "desc" TEXT
);
