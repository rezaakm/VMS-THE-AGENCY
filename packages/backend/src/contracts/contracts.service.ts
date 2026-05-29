import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

@Injectable()
export class ContractsService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  async create(createDto: CreateContractDto, userId?: string) {
    const contractNumber = await this.generateContractNumber();

    const contract = await this.prisma.contract.create({
      data: {
        ...createDto,
        contractNumber,
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });
    if (userId) {
      await this.auditLog.log(userId, 'CREATE', 'CONTRACT', contract.id, {
        contractNumber: contract.contractNumber,
      });
    }
    return contract;
  }

  async findAll(filters?: any) {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.vendorId) {
      where.vendorId = filters.vendorId;
    }

    return this.prisma.contract.findMany({
      where,
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: {
        vendor: true,
      },
    });

    if (!contract) {
      throw new NotFoundException(`Contract with ID ${id} not found`);
    }

    return contract;
  }

  async update(id: string, updateDto: UpdateContractDto, userId?: string) {
    await this.findOne(id);

    const contract = await this.prisma.contract.update({
      where: { id },
      data: updateDto,
      include: {
        vendor: true,
      },
    });
    if (userId) {
      await this.auditLog.log(userId, 'UPDATE', 'CONTRACT', id, {
        ...updateDto,
      });
    }
    return contract;
  }

  async remove(id: string, userId?: string) {
    await this.findOne(id);
    await this.prisma.contract.delete({ where: { id } });
    if (userId) {
      await this.auditLog.log(userId, 'DELETE', 'CONTRACT', id);
    }
    return { message: 'Contract deleted successfully' };
  }

  async getExpiringContracts(days: number = 30) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return this.prisma.contract.findMany({
      where: {
        status: 'ACTIVE',
        endDate: {
          lte: futureDate,
          gte: new Date(),
        },
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            code: true,
            email: true,
          },
        },
      },
      orderBy: {
        endDate: 'asc',
      },
    });
  }

  private async generateContractNumber(): Promise<string> {
    const count = await this.prisma.contract.count();
    const year = new Date().getFullYear();
    const paddedCount = String(count + 1).padStart(6, '0');
    return `CNT${year}${paddedCount}`;
  }
}

