import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ExcelParserService } from '../cost-sheets/excel-parser.service';
import { GoogleDriveService, DriveSyncResult } from './google-drive.service';
import { EXCEL_MIME_TYPES } from './google-drive.config';

@Injectable()
export class DriveCatalogService {
  private readonly logger = new Logger(DriveCatalogService.name);

  constructor(
    private prisma: PrismaService,
    private googleDrive: GoogleDriveService,
    private excelParser: ExcelParserService,
    private config: ConfigService,
  ) {}

  async getConfig() {
    const active = await this.getActiveFolderRecord();
    return {
      configured: this.googleDrive.isConfigured(),
      activeFolder: active
        ? {
            id: active.id,
            folderId: active.folderId,
            name: active.name,
            lastSyncedAt: active.lastSyncedAt,
          }
        : null,
      envFolderId: this.config.get('GOOGLE_DRIVE_FOLDER_ID') || null,
      fileCount: active
        ? await this.prisma.googleDriveFile.count({
            where: { folderRefId: active.id, isInDrive: true },
          })
        : 0,
    };
  }

  async assignFolder(folderId: string, name?: string) {
    if (!folderId.trim()) {
      throw new BadRequestException('folderId is required');
    }

    let displayName = name;
    if (this.googleDrive.isConfigured()) {
      try {
        const meta = await this.googleDrive.getFolderMetadata(folderId.trim());
        displayName = displayName || meta.name;
      } catch {
        this.logger.warn(`Could not verify folder ${folderId} via Drive API`);
      }
    }

    await this.prisma.googleDriveFolder.updateMany({
      data: { isActive: false },
    });

    const folder = await this.prisma.googleDriveFolder.upsert({
      where: { folderId: folderId.trim() },
      create: {
        folderId: folderId.trim(),
        name: displayName || 'Assigned folder',
        isActive: true,
      },
      update: {
        name: displayName,
        isActive: true,
      },
    });

    return folder;
  }

  async getActiveFolderRecord() {
    let folder = await this.prisma.googleDriveFolder.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (!folder) {
      const envId = this.config.get<string>('GOOGLE_DRIVE_FOLDER_ID');
      if (envId) {
        folder = await this.assignFolder(envId, 'Default (from .env)');
      }
    }

    return folder;
  }

  async listFiles(filters?: {
    category?: string;
    search?: string;
    inDriveOnly?: boolean;
  }) {
    const folder = await this.getActiveFolderRecord();
    if (!folder) {
      return { folder: null, files: [] };
    }

    const where: {
      folderRefId: string;
      isInDrive?: boolean;
      category?: string;
      name?: { contains: string; mode: 'insensitive' };
    } = { folderRefId: folder.id };

    if (filters?.inDriveOnly !== false) {
      where.isInDrive = true;
    }
    if (filters?.category) {
      where.category = filters.category;
    }
    if (filters?.search) {
      where.name = { contains: filters.search, mode: 'insensitive' };
    }

    const files = await this.prisma.googleDriveFile.findMany({
      where,
      include: {
        costSheet: {
          select: {
            id: true,
            jobNumber: true,
            client: true,
            event: true,
          },
        },
      },
      orderBy: { modifiedTime: 'desc' },
      take: 500,
    });

    return {
      folder: {
        id: folder.id,
        folderId: folder.folderId,
        name: folder.name,
        lastSyncedAt: folder.lastSyncedAt,
      },
      files: files.map((f) => ({
        ...f,
        size: f.size != null ? Number(f.size) : null,
        driveUrl: f.webViewLink || `https://drive.google.com/file/d/${f.driveFileId}/view`,
      })),
    };
  }

  async syncCatalogAndCostSheets(): Promise<
    DriveSyncResult & { cataloged: number; removedFromDrive: number }
  > {
    const folder = await this.getActiveFolderRecord();
    if (!folder) {
      return {
        success: false,
        filesFound: 0,
        filesProcessed: 0,
        filesSkipped: 0,
        cataloged: 0,
        removedFromDrive: 0,
        errors: [
          'No Google Drive folder assigned. Set GOOGLE_DRIVE_FOLDER_ID in .env or assign a folder in Settings.',
        ],
        details: [],
      };
    }

    if (!this.googleDrive.isConfigured()) {
      return {
        success: false,
        filesFound: 0,
        filesProcessed: 0,
        filesSkipped: 0,
        cataloged: 0,
        removedFromDrive: 0,
        errors: ['Google Drive OAuth not configured'],
        details: [],
      };
    }

    const result: DriveSyncResult & {
      cataloged: number;
      removedFromDrive: number;
    } = {
      success: true,
      filesFound: 0,
      filesProcessed: 0,
      filesSkipped: 0,
      cataloged: 0,
      removedFromDrive: 0,
      errors: [],
      details: [],
    };

    try {
      const driveFiles = await this.googleDrive.listAllFilesRecursive(
        folder.folderId,
      );
      result.filesFound = driveFiles.length;
      const seenIds = new Set<string>();
      const now = new Date();

      for (const file of driveFiles) {
        seenIds.add(file.id);
        const category = this.googleDrive.categorizeMimeType(file.mimeType);
        const modifiedTime = new Date(file.modifiedTime);
        const size = file.size ? BigInt(file.size) : null;

        const existingCostSheet = await this.prisma.costSheet.findUnique({
          where: { driveFileId: file.id },
          select: { id: true },
        });

        const record = await this.prisma.googleDriveFile.upsert({
          where: { driveFileId: file.id },
          create: {
            folderRefId: folder.id,
            driveFileId: file.id,
            name: file.name,
            mimeType: file.mimeType,
            size,
            modifiedTime,
            webViewLink: file.webViewLink,
            subfolderPath: file.subfolderPath,
            category,
            isInDrive: true,
            costSheetId: existingCostSheet?.id,
            lastSyncedAt: now,
          },
          update: {
            name: file.name,
            mimeType: file.mimeType,
            size,
            modifiedTime,
            webViewLink: file.webViewLink,
            subfolderPath: file.subfolderPath,
            category,
            isInDrive: true,
            costSheetId: existingCostSheet?.id,
            lastSyncedAt: now,
          },
        });
        result.cataloged++;

        if (!EXCEL_MIME_TYPES.includes(file.mimeType)) {
          continue;
        }

        try {
          this.logger.log(`Parsing cost sheet: ${file.name}`);
          const buffer = await this.googleDrive.downloadFile(file.id);
          const parseResult = await this.excelParser.parseAndInsert(
            buffer,
            file.name,
            file.id,
          );

          const costSheet = await this.prisma.costSheet.findUnique({
            where: { driveFileId: file.id },
            select: { id: true },
          });
          if (costSheet) {
            await this.prisma.googleDriveFile.update({
              where: { id: record.id },
              data: { costSheetId: costSheet.id },
            });
          }

          result.details.push({
            fileName: file.name,
            driveFileId: file.id,
            rowsInserted: parseResult.rowsInserted,
            rowsSkipped: parseResult.rowsSkipped,
            error: parseResult.error,
          });

          if (parseResult.success) {
            result.filesProcessed++;
          } else {
            result.filesSkipped++;
            if (parseResult.error) {
              result.errors.push(`${file.name}: ${parseResult.error}`);
            }
          }
        } catch (fileErr: unknown) {
          const message =
            fileErr instanceof Error ? fileErr.message : String(fileErr);
          result.filesSkipped++;
          result.errors.push(`${file.name}: ${message}`);
          result.details.push({
            fileName: file.name,
            driveFileId: file.id,
            rowsInserted: 0,
            rowsSkipped: 0,
            error: message,
          });
        }
      }

      let removedCount = 0;
      if (seenIds.size > 0) {
        const removed = await this.prisma.googleDriveFile.updateMany({
          where: {
            folderRefId: folder.id,
            driveFileId: { notIn: [...seenIds] },
            isInDrive: true,
          },
          data: { isInDrive: false },
        });
        removedCount = removed.count;
      } else if (driveFiles.length === 0) {
        const removed = await this.prisma.googleDriveFile.updateMany({
          where: { folderRefId: folder.id, isInDrive: true },
          data: { isInDrive: false },
        });
        removedCount = removed.count;
      }
      result.removedFromDrive = removedCount;

      await this.prisma.googleDriveFolder.update({
        where: { id: folder.id },
        data: { lastSyncedAt: now },
      });
    } catch (err: unknown) {
      result.success = false;
      result.errors.push(err instanceof Error ? err.message : String(err));
      this.logger.error(`Drive catalog sync failed: ${result.errors[0]}`);
    }

    return result;
  }
}
