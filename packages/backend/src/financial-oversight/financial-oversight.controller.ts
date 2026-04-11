import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FinancialOversightService } from './financial-oversight.service';
import { CreateFlagDto } from './dto/create-flag.dto';
import { UpdateFlagDto } from './dto/update-flag.dto';
import { CreateResponseDto } from './dto/create-response.dto';
import { GradeResponseDto } from './dto/grade-response.dto';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { CreateProcessDto } from './dto/create-process.dto';

@Controller('financial-oversight')
@UseGuards(JwtAuthGuard)
export class FinancialOversightController {
  constructor(private readonly service: FinancialOversightService) {}

  // ─── DASHBOARD ──────────────────────────────────────

  @Get('dashboard')
  getDashboard() {
    return this.service.getDashboard();
  }

  // ─── FLAGS ──────────────────────────────────────────

  @Get('flags')
  findAllFlags(
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('category') category?: string,
  ) {
    return this.service.findAllFlags({ status, severity, category });
  }

  @Get('flags/:id')
  findFlagById(@Param('id') id: string) {
    return this.service.findFlagById(id);
  }

  @Post('flags')
  createFlag(@Body() dto: CreateFlagDto) {
    return this.service.createFlag(dto);
  }

  @Patch('flags/:id')
  updateFlag(@Param('id') id: string, @Body() dto: UpdateFlagDto) {
    return this.service.updateFlag(id, dto);
  }

  // ─── FLAG RESPONSES ─────────────────────────────────

  @Post('flags/:id/responses')
  createResponse(
    @Param('id') flagId: string,
    @Body() dto: CreateResponseDto,
  ) {
    return this.service.createResponse(flagId, dto);
  }

  @Patch('responses/:id/grade')
  gradeResponse(@Param('id') id: string, @Body() dto: GradeResponseDto) {
    return this.service.gradeResponse(id, dto);
  }

  // ─── CHECKLIST ──────────────────────────────────────

  @Get('checklist')
  findAllChecklistItems(@Query('period') period?: string) {
    return this.service.findAllChecklistItems(period);
  }

  @Post('checklist')
  createChecklistItem(@Body() dto: CreateChecklistItemDto) {
    return this.service.createChecklistItem(dto);
  }

  @Post('checklist/:id/complete')
  completeChecklistItem(
    @Param('id') id: string,
    @Body() body: { period: string; completedBy: string; notes?: string },
  ) {
    return this.service.completeChecklistItem(
      id,
      body.period,
      body.completedBy,
      body.notes,
    );
  }

  // ─── PROCESSES ──────────────────────────────────────

  @Get('processes')
  findAllProcesses() {
    return this.service.findAllProcesses();
  }

  @Post('processes')
  createProcess(@Body() dto: CreateProcessDto) {
    return this.service.createProcess(dto);
  }

  @Patch('processes/:id')
  updateProcess(@Param('id') id: string, @Body() dto: Partial<CreateProcessDto>) {
    return this.service.updateProcess(id, dto);
  }
}
