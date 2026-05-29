import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditLogService } from './audit-log.service';

@ApiTags('audit-logs')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@ApiBearerAuth()
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @ApiOperation({ summary: 'List audit log entries (admin/manager)' })
  @ApiQuery({ name: 'entity', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('entity') entity?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditLogService.findAll(
      entity,
      limit ? parseInt(limit, 10) : 50,
    );
  }
}
