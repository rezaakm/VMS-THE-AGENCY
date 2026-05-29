import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('contracts')
@Controller('contracts')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ContractsController {
  constructor(private readonly service: ContractsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new contract' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.BUYER)
  create(
    @Body() createDto: CreateContractDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.service.create(createDto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all contracts' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'vendorId', required: false })
  findAll(@Query() query: any) {
    return this.service.findAll(query);
  }

  @Get('expiring')
  @ApiOperation({ summary: 'Get expiring contracts' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  getExpiringContracts(@Query('days') days?: string) {
    return this.service.getExpiringContracts(days ? parseInt(days) : 30);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contract by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update contract' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateContractDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.service.update(id, updateDto, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete contract' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  remove(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.service.remove(id, req.user.id);
  }
}

