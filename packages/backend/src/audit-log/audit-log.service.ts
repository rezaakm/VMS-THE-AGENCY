import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private prisma: PrismaService) {}

  async log(
    userId: string,
    action: string,
    entity: string,
    entityId: string,
    changes?: Prisma.InputJsonValue,
  ) {
    try {
      return await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          entity,
          entityId,
          changes: changes ?? undefined,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Audit log failed: ${action} ${entity} ${entityId}`,
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }

  async findAll(entity?: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: entity ? { entity } : undefined,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }
}
