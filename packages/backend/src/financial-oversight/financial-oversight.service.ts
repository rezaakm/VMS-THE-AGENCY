import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateFlagDto } from './dto/create-flag.dto';
import { UpdateFlagDto } from './dto/update-flag.dto';
import { CreateResponseDto } from './dto/create-response.dto';
import { GradeResponseDto } from './dto/grade-response.dto';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { CreateProcessDto } from './dto/create-process.dto';

@Injectable()
export class FinancialOversightService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  /** Mark open/in-progress flags past deadline as OVERDUE */
  async escalateOverdueFlags(): Promise<number> {
    const now = new Date();
    const result = await this.prisma.financialFlag.updateMany({
      where: {
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        deadline: { lt: now },
      },
      data: { status: 'OVERDUE' },
    });
    return result.count;
  }

  private async ensureOverdueChecked() {
    await this.escalateOverdueFlags();
  }

  // ─── FLAGS ──────────────────────────────────────────

  async findAllFlags(filters?: {
    status?: string;
    severity?: string;
    category?: string;
  }) {
    await this.ensureOverdueChecked();
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.severity) where.severity = filters.severity;
    if (filters?.category) where.category = filters.category;

    return this.prisma.financialFlag.findMany({
      where,
      include: {
        responses: {
          orderBy: { submittedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ severity: 'asc' }, { flagNumber: 'asc' }],
    });
  }

  async findFlagById(id: string) {
    const flag = await this.prisma.financialFlag.findUnique({
      where: { id },
      include: {
        responses: {
          orderBy: { submittedAt: 'desc' },
        },
      },
    });
    if (!flag) throw new NotFoundException(`Flag ${id} not found`);
    return flag;
  }

  async createFlag(dto: CreateFlagDto, userId?: string) {
    const flag = await this.prisma.financialFlag.create({
      data: {
        flagNumber: dto.flagNumber,
        title: dto.title,
        description: dto.description,
        severity: dto.severity as any,
        category: dto.category as any,
        assignedTo: dto.assignedTo,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      },
    });
    if (userId) {
      await this.auditLog.log(userId, 'CREATE', 'FINANCIAL_FLAG', flag.id, {
        flagNumber: flag.flagNumber,
        title: flag.title,
      });
    }
    return flag;
  }

  async updateFlag(id: string, dto: UpdateFlagDto, userId?: string) {
    await this.findFlagById(id);
    const flag = await this.prisma.financialFlag.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description && { description: dto.description }),
        ...(dto.severity && { severity: dto.severity as any }),
        ...(dto.status && { status: dto.status as any }),
        ...(dto.assignedTo && { assignedTo: dto.assignedTo }),
        ...(dto.deadline && { deadline: new Date(dto.deadline) }),
      },
    });
    if (userId) {
      await this.auditLog.log(userId, 'UPDATE', 'FINANCIAL_FLAG', id, {
        ...dto,
      });
    }
    return flag;
  }

  // ─── FLAG RESPONSES ─────────────────────────────────

  async createResponse(flagId: string, dto: CreateResponseDto, userId?: string) {
    await this.findFlagById(flagId);

    // Auto-update flag status to IN_PROGRESS when response submitted
    await this.prisma.financialFlag.update({
      where: { id: flagId },
      data: { status: 'IN_PROGRESS' },
    });

    const response = await this.prisma.flagResponse.create({
      data: {
        flagId,
        acknowledgement: dto.acknowledgement as any,
        rootCause: dto.rootCause,
        currentStatus: dto.currentStatus,
        correctiveAction: dto.correctiveAction,
        evidence: dto.evidence || [],
        completionDate: dto.completionDate
          ? new Date(dto.completionDate)
          : undefined,
      },
    });
    if (userId) {
      await this.auditLog.log(userId, 'CREATE', 'FLAG_RESPONSE', response.id, {
        flagId,
      });
    }
    return response;
  }

  async gradeResponse(responseId: string, dto: GradeResponseDto, userId?: string) {
    const response = await this.prisma.flagResponse.findUnique({
      where: { id: responseId },
      include: { flag: true },
    });
    if (!response)
      throw new NotFoundException(`Response ${responseId} not found`);

    // Update the response with grade
    const updated = await this.prisma.flagResponse.update({
      where: { id: responseId },
      data: {
        grade: dto.grade as any,
        reviewerNotes: dto.reviewerNotes,
        reviewedAt: new Date(),
      },
    });

    // If graded ADEQUATE, auto-resolve the flag
    if (dto.grade === 'ADEQUATE') {
      await this.prisma.financialFlag.update({
        where: { id: response.flagId },
        data: { status: 'RESOLVED' },
      });
    }

    if (userId) {
      await this.auditLog.log(userId, 'GRADE', 'FLAG_RESPONSE', responseId, {
        grade: dto.grade,
      });
    }

    return updated;
  }

  // ─── CHECKLIST ──────────────────────────────────────

  async findAllChecklistItems(period?: string) {
    const items = await this.prisma.financialChecklistItem.findMany({
      where: { isActive: true },
      include: {
        completions: period
          ? { where: { period } }
          : { orderBy: { period: 'desc' }, take: 1 },
      },
      orderBy: [{ dueDay: 'asc' }, { name: 'asc' }],
    });
    return items;
  }

  async createChecklistItem(dto: CreateChecklistItemDto) {
    return this.prisma.financialChecklistItem.create({
      data: {
        name: dto.name,
        description: dto.description,
        frequency: dto.frequency as any,
        owner: dto.owner,
        dueDay: dto.dueDay,
        category: dto.category as any,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async completeChecklistItem(
    itemId: string,
    period: string,
    completedBy: string,
    notes?: string,
  ) {
    return this.prisma.checklistCompletion.upsert({
      where: {
        checklistItemId_period: { checklistItemId: itemId, period },
      },
      create: {
        checklistItemId: itemId,
        period,
        status: 'COMPLETED',
        completedBy,
        completedAt: new Date(),
        notes,
      },
      update: {
        status: 'COMPLETED',
        completedBy,
        completedAt: new Date(),
        notes,
      },
    });
  }

  // ─── PROCESSES ──────────────────────────────────────

  async findAllProcesses() {
    return this.prisma.financialProcess.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createProcess(dto: CreateProcessDto) {
    return this.prisma.financialProcess.create({
      data: {
        name: dto.name,
        description: dto.description,
        owner: dto.owner,
        frequency: dto.frequency as any,
        status: (dto.status as any) || 'NOT_STARTED',
        templateUrl: dto.templateUrl,
        nextDue: dto.nextDue ? new Date(dto.nextDue) : undefined,
        trainingRequired: dto.trainingRequired ?? false,
      },
    });
  }

  async updateProcess(id: string, data: Partial<CreateProcessDto>) {
    return this.prisma.financialProcess.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description && { description: data.description }),
        ...(data.owner && { owner: data.owner }),
        ...(data.frequency && { frequency: data.frequency as any }),
        ...(data.status && { status: data.status as any }),
        ...(data.templateUrl && { templateUrl: data.templateUrl }),
        ...(data.nextDue && { nextDue: new Date(data.nextDue) }),
        ...(data.trainingRequired !== undefined && {
          trainingRequired: data.trainingRequired,
        }),
      },
    });
  }

  // ─── DASHBOARD ──────────────────────────────────────

  async getDashboard() {
    await this.ensureOverdueChecked();
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [flags, checklist, processes] = await Promise.all([
      this.prisma.financialFlag.groupBy({
        by: ['status', 'severity'],
        _count: true,
      }),
      this.prisma.financialChecklistItem.findMany({
        where: { isActive: true },
        include: {
          completions: { where: { period: currentPeriod } },
        },
      }),
      this.prisma.financialProcess.findMany(),
    ]);

    // Flag counts
    const openFlags = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      total: 0,
    };
    const overdueFlags = { count: 0 };
    flags.forEach((g) => {
      if (['OPEN', 'IN_PROGRESS', 'OVERDUE'].includes(g.status)) {
        openFlags[g.severity] = (openFlags[g.severity] || 0) + g._count;
        openFlags.total += g._count;
      }
      if (g.status === 'OVERDUE') overdueFlags.count += g._count;
    });

    // Checklist completion
    const totalItems = checklist.length;
    const completedItems = checklist.filter(
      (item) =>
        item.completions.length > 0 &&
        item.completions[0].status === 'COMPLETED',
    ).length;

    // Process status
    const processStats = {
      active: processes.filter((p) => p.status === 'ACTIVE').length,
      inDevelopment: processes.filter((p) => p.status === 'IN_DEVELOPMENT')
        .length,
      notStarted: processes.filter((p) => p.status === 'NOT_STARTED').length,
      total: processes.length,
    };

    return {
      flags: openFlags,
      overdueFlags: overdueFlags.count,
      checklist: {
        total: totalItems,
        completed: completedItems,
        completionRate:
          totalItems > 0
            ? Math.round((completedItems / totalItems) * 100)
            : 0,
        period: currentPeriod,
      },
      processes: processStats,
    };
  }
}
