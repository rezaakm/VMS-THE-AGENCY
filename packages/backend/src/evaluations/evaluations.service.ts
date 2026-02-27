import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';

@Injectable()
export class EvaluationsService {
  constructor(private prisma: PrismaService) {}

  async create(createDto: CreateEvaluationDto, evaluatorId: string) {
    // Calculate overall score
    const overallScore =
      (createDto.qualityScore +
        createDto.deliveryScore +
        createDto.pricingScore +
        createDto.serviceScore) /
      4;

    const evaluation = await this.prisma.evaluation.create({
      data: {
        ...createDto,
        evaluatorId,
        overallScore,
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        evaluator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Update vendor performance score
    await this.updateVendorPerformanceScore(createDto.vendorId);

    return evaluation;
  }

  async findAll(vendorId?: string) {
    const where = vendorId ? { vendorId } : {};

    return this.prisma.evaluation.findMany({
      where,
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        evaluator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        evaluationDate: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { id },
      include: {
        vendor: true,
        evaluator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!evaluation) {
      throw new NotFoundException(`Evaluation with ID ${id} not found`);
    }

    return evaluation;
  }

  async getVendorScore(vendorId: string) {
    const evaluations = await this.prisma.evaluation.findMany({
      where: { vendorId },
      select: {
        overallScore: true,
        qualityScore: true,
        deliveryScore: true,
        pricingScore: true,
        serviceScore: true,
      },
    });

    if (evaluations.length === 0) {
      return {
        averageScore: 0,
        totalEvaluations: 0,
        scores: {
          quality: 0,
          delivery: 0,
          pricing: 0,
          service: 0,
        },
      };
    }

    const totalScore = evaluations.reduce((sum, e) => sum + e.overallScore, 0);
    const qualityScore = evaluations.reduce((sum, e) => sum + e.qualityScore, 0);
    const deliveryScore = evaluations.reduce((sum, e) => sum + e.deliveryScore, 0);
    const pricingScore = evaluations.reduce((sum, e) => sum + e.pricingScore, 0);
    const serviceScore = evaluations.reduce((sum, e) => sum + e.serviceScore, 0);

    const count = evaluations.length;

    return {
      averageScore: totalScore / count,
      totalEvaluations: count,
      scores: {
        quality: qualityScore / count,
        delivery: deliveryScore / count,
        pricing: pricingScore / count,
        service: serviceScore / count,
      },
    };
  }

  async remove(id: string) {
    const evaluation = await this.findOne(id);
    await this.prisma.evaluation.delete({ where: { id } });
    
    // Update vendor performance score after deletion
    await this.updateVendorPerformanceScore(evaluation.vendorId);
    
    return { message: 'Evaluation deleted successfully' };
  }

  private async updateVendorPerformanceScore(vendorId: string) {
    const scoreData = await this.getVendorScore(vendorId);

    await this.prisma.vendor.update({
      where: { id: vendorId },
      data: {
        performanceScore: scoreData.averageScore,
      },
    });
  }
}

