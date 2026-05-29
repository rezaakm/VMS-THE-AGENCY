-- Zoho Books integration (OAuth tokens + entity sync map)

CREATE TABLE "zoho_connections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" TEXT NOT NULL,
    "organizationName" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "apiDomain" TEXT NOT NULL DEFAULT 'https://www.zohoapis.com',
    "accountsDomain" TEXT NOT NULL DEFAULT 'https://accounts.zoho.com',
    "dataCenter" TEXT NOT NULL DEFAULT 'com',
    "scopes" TEXT,
    "connectedById" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zoho_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "zoho_sync_maps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entityType" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "zohoId" TEXT NOT NULL,
    "zohoEntity" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zoho_sync_maps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "zoho_sync_maps_entityType_localId_key" ON "zoho_sync_maps"("entityType", "localId");
CREATE INDEX "zoho_sync_maps_zohoId_idx" ON "zoho_sync_maps"("zohoId");
