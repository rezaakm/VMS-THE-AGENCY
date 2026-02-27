import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  getDashboardStats() {
    return this.service.getDashboardStats();
  }

  @Get('spend-by-vendor')
  @ApiOperation({ summary: 'Get spending by vendor' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getSpendByVendor(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.service.getSpendByVendor(start, end);
  }

  @Get('spend-by-category')
  @ApiOperation({ summary: 'Get spending by category' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getSpendByCategory(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.service.getSpendByCategory(start, end);
  }

  @Get('monthly-spend')
  @ApiOperation({ summary: 'Get monthly spending trend' })
  @ApiQuery({ name: 'months', required: false, type: Number })
  getMonthlySpend(@Query('months') months?: string) {
    return this.service.getMonthlySpend(months ? parseInt(months) : 12);
  }

  @Get('vendor-performance')
  @ApiOperation({ summary: 'Get vendor performance report' })
  getVendorPerformanceReport() {
    return this.service.getVendorPerformanceReport();
  }
}

