import { Controller, Get, UseGuards, Query, Res, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
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

  @Get('ar-aging')
  @ApiOperation({ summary: 'Accounts receivable aging (client receivables)' })
  getArAging() {
    return this.service.getArAging();
  }

  @Get('monthly-pl-summary')
  @ApiOperation({ summary: 'Monthly operational P&L-style summary' })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiQuery({ name: 'month', required: false, type: Number })
  getMonthlyPlSummary(
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.service.getMonthlyPlSummary(
      year ? parseInt(year, 10) : undefined,
      month ? parseInt(month, 10) : undefined,
    );
  }

  @Get('export/spend-by-vendor.csv')
  @Header('Content-Type', 'text/csv')
  @ApiOperation({ summary: 'Export spend by vendor as CSV' })
  async exportSpendByVendor(@Res() res: Response) {
    const csv = await this.service.getSpendByVendorCsv();
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="spend-by-vendor.csv"',
    );
    res.send(csv);
  }
}

