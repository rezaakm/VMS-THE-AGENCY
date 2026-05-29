import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateFlagDto } from './dto/create-flag.dto';
import { UpdateFlagDto } from './dto/update-flag.dto';
import { CreateResponseDto } from './dto/create-response.dto';
import { GradeResponseDto } from './dto/grade-response.dto';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { CreateProcessDto } from './dto/create-process.dto';
import { FlagStatus, ResponseGrade } from '@prisma/client';

@Injectable()
export class FinancialOversightService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  // ===================== FLAGS =====================

  async findAllFlags(filters?: {
    status?: string;
    severity?: string;
    category?: string;
  }) {
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
          include: { submittedBy: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
      orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findFlagById(id: string) {
    const flag = await this.prisma.financialFlag.findUnique({
      where: { id },
      include: {
        responses: {
          orderBy: { submittedAt: 'desc' },
          include: {
            submittedBy: { select: { id: true, firstName: true, lastName: true } },
            gradedBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!flag) throw new NotFoundException(`Financial flag ${id} not found`);
    return flag;
  }

  async createFlag(dto: CreateFlagDto, createdById: string) {
    const flag = await this.prisma.financialFlag.create({
      data: {
        title: dto.title,
        description: dto.description,
        severity: dto.severity,
        category: dto.category,
        assignedToId: dto.assignedToId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        createdById,
      },
    });

    await this.auditLog.log(createdById, 'CREATE', 'FINANCIAL_FLAG', flag.id, dto);
    return flag;
  }

  async updateFlag(id: string, dto: UpdateFlagDto, userId: string) {
    await this.findFlagById(id);

    const updated = await this.prisma.financialFlag.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description && { description: dto.description }),
        ...(dto.severity && { severity: dto.severity }),
        ...(dto.status && { status: dto.status }),
        ...(dto.assignedToId && { assignedToId: dto.assignedToId }),
        ...(dto.dueDate && { dueDate: new Date(dto.dueDate) }),
      },
    });

    await this.auditLog.log(userId, 'UPDATE', 'FINANCIAL_FLAG', id, dto);
    return updated;
  }

  // ===================== FLAG RESPONSES (A-F Template) =====================

  async createResponse(flagId: string, dto: CreateResponseDto, userId: string) {
    const flag = await this.findFlagById(flagId);

    if (flag.status === 'RESOLVED') {
      throw new BadRequestException('Cannot respond to a resolved flag');
    }

    const response = await this.prisma.flagResponse.create({
      data: {
        flagId,
        acknowledge: dto.acknowledge,
        rootCause: dto.rootCause,
        currentStatus: dto.currentStatus,
        actionPlan: dto.actionPlan,
        evidence: dto.evidence,
        completionDate: dto.completionDate,
        submittedById: userId,
      },
    });

    // Auto-progress the flag
    await this.prisma.financialFlag.update({
      where: { id: flagId },
      data: { status: 'IN_PROGRESS' },
    });

    await this.auditLog.log(userId, 'CREATE', 'FLAG_RESPONSE', response.id, { flagId });
    return response;
  }

  async gradeResponse(responseId: string, dto: GradeResponseDto, graderId: string) {
    const response = await this.prisma.flagResponse.findUnique({
      where: { id: responseId },
      include: { flag: true },
    });
    if (!response) throw new NotFoundException(`Response ${responseId} not found`);

    const updated = await this.prisma.flagResponse.update({
      where: { id: responseId },
      data: {
        grade: dto.grade,
        gradedById: graderId,
        gradedAt: new Date(),
        gradeNotes: dto.gradeNotes,
      },
    });

    // Auto-resolve if graded ADEQUATE
    if (dto.grade === ResponseGrade.ADEQUATE) {
      await this.prisma.financialFlag.update({
        where: { id: response.flagId },
        data: { status: 'RESOLVED' },
      });
    }

    await this.auditLog.log(graderId, 'GRADE', 'FLAG_RESPONSE', responseId, dto);
    return updated;
  }

  // ===================== CHECKLIST =====================

  async findAllChecklistItems(period?: string) {
    const currentPeriod = period || this.getCurrentPeriod();

    return this.prisma.financialChecklistItem.findMany({
      where: { isActive: true },
      include: {
        completions: {
          where: { period: currentPeriod },
        },
      },
      orderBy: [{ dueDay: 'asc' }, { name: 'asc' }],
    });
  }

  async createChecklistItem(dto: CreateChecklistItemDto) {
    return this.prisma.financialChecklistItem.create({ data: dto });
  }

  async completeChecklistItem(
    itemId: string,
    period: string,
    completedById: string,
    notes?: string,
  ) {
    const completion = await this.prisma.checklistCompletion.upsert({
      where: { itemId_period: { itemId, period } },
      create: {
        itemId,
        period,
        completed: true,
        completedById,
        completedAt: new Date(),
        notes,
      },
      update: {
        completed: true,
        completedById,
        completedAt: new Date(),
        notes,
      },
    });

    await this.auditLog.log(completedById, 'COMPLETE', 'CHECKLIST_ITEM', itemId, { period });
    return completion;
  }

  // ===================== PROCESSES =====================

  async findAllProcesses() {
    return this.prisma.financialProcess.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createProcess(dto: CreateProcessDto) {
    return this.prisma.financialProcess.create({ data: dto });
  }

  async updateProcess(id: string, dto: Partial<CreateProcessDto>) {
    return this.prisma.financialProcess.update({
      where: { id },
      data: dto,
    });
  }

  // ===================== DASHBOARD =====================

  async getDashboard() {
    const currentPeriod = this.getCurrentPeriod();

    const [flagStats, checklistItems, processes] = await Promise.all([
      this.prisma.financialFlag.groupBy({
        by: ['status', 'severity'],
        _count: true,
      }),
      this.findAllChecklistItems(currentPeriod),
      this.findAllProcesses(),
    ]);

    const openFlags = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, total: 0 };
    let overdueCount = 0;

    flagStats.forEach((g) => {
      if (['OPEN', 'IN_PROGRESS'].includes(g.status)) {
        openFlags[g.severity] = (openFlags[g.severity] || 0) + g._count;
        openFlags.total += g._count;
      }
      if (g.status === 'ESCALATED') overdueCount += g._count;
    });

    const completedChecklist = checklistItems.filter(
      (item) => item.completions.length > 0 && item.completions[0].completed,
    ).length;

    return {
      flags: openFlags,
      overdueFlags: overdueCount,
      checklist: {
        total: checklistItems.length,
        completed: completedChecklist,
        completionRate:
          checklistItems.length > 0
            ? Math.round((completedChecklist / checklistItems.length) * 100)
            : 0,
        period: currentPeriod,
      },
      processes: {
        active: processes.filter((p) => p.status === 'ACTIVE').length,
        total: processes.length,
      },
    };
  }

  private getCurrentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}
