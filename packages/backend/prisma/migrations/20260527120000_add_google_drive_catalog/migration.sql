-- Google Drive folder assignment and file catalog

CREATE TABLE "google_drive_folders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "folderId" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "google_drive_folders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "google_drive_folders_folderId_key" ON "google_drive_folders"("folderId");

CREATE TABLE "google_drive_files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "folderRefId" UUID NOT NULL,
    "driveFileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" BIGINT,
    "modifiedTime" TIMESTAMP(3) NOT NULL,
    "webViewLink" TEXT,
    "subfolderPath" TEXT,
    "category" TEXT NOT NULL,
    "isInDrive" BOOLEAN NOT NULL DEFAULT true,
    "costSheetId" UUID,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "google_drive_files_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "google_drive_files_driveFileId_key" ON "google_drive_files"("driveFileId");
CREATE UNIQUE INDEX "google_drive_files_costSheetId_key" ON "google_drive_files"("costSheetId");
CREATE INDEX "google_drive_files_folderRefId_idx" ON "google_drive_files"("folderRefId");
CREATE INDEX "google_drive_files_category_idx" ON "google_drive_files"("category");
CREATE INDEX "google_drive_files_isInDrive_idx" ON "google_drive_files"("isInDrive");

ALTER TABLE "google_drive_files" ADD CONSTRAINT "google_drive_files_folderRefId_fkey" FOREIGN KEY ("folderRefId") REFERENCES "google_drive_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "google_drive_files" ADD CONSTRAINT "google_drive_files_costSheetId_fkey" FOREIGN KEY ("costSheetId") REFERENCES "cost_sheets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
