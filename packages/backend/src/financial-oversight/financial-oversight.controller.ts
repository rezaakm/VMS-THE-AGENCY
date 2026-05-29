import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FinancialOversightService } from './financial-oversight.service';
import { CreateFlagDto } from './dto/create-flag.dto';
import { UpdateFlagDto } from './dto/update-flag.dto';
import { CreateResponseDto } from './dto/create-response.dto';
import { GradeResponseDto } from './dto/grade-response.dto';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { CreateProcessDto } from './dto/create-process.dto';

@ApiTags('financial-oversight')
@Controller('financial-oversight')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class FinancialOversightController {
  constructor(private readonly service: FinancialOversightService) {}

  @Get('dashboard')
  getDashboard() {
    return this.service.getDashboard();
  }

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
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  createFlag(@Body() dto: CreateFlagDto, @Request() req: { user: { id: string } }) {
    return this.service.createFlag(dto, req.user.id);
  }

  @Patch('flags/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  updateFlag(
    @Param('id') id: string,
    @Body() dto: UpdateFlagDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.service.updateFlag(id, dto, req.user.id);
  }

  @Post('flags/:id/responses')
  createResponse(
    @Param('id') flagId: string,
    @Body() dto: CreateResponseDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.service.createResponse(flagId, dto, req.user.id);
  }

  @Patch('responses/:id/grade')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  gradeResponse(
    @Param('id') id: string,
    @Body() dto: GradeResponseDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.service.gradeResponse(id, dto, req.user.id);
  }

  @Get('checklist')
  findAllChecklistItems(@Query('period') period?: string) {
    return this.service.findAllChecklistItems(period);
  }

  @Post('checklist')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  createChecklistItem(@Body() dto: CreateChecklistItemDto) {
    return this.service.createChecklistItem(dto);
  }

  @Post('checklist/:id/complete')
  completeChecklistItem(
    @Param('id') id: string,
    @Body() body: { period: string; completedBy: string; notes?: string },
    @Request() req: { user: { id: string } },
  ) {
    return this.service.completeChecklistItem(id, body.period, req.user.id, body.notes);
  }

  @Get('processes')
  findAllProcesses() {
    return this.service.findAllProcesses();
  }

  @Post('processes')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  createProcess(@Body() dto: CreateProcessDto) {
    return this.service.createProcess(dto);
  }

  @Patch('processes/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  updateProcess(@Param('id') id: string, @Body() dto: Partial<CreateProcessDto>) {
    return this.service.updateProcess(id, dto);
  }
}
