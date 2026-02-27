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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('contracts')
@Controller('contracts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContractsController {
  constructor(private readonly service: ContractsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new contract' })
  create(@Body() createDto: CreateContractDto) {
    return this.service.create(createDto);
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
  update(@Param('id') id: string, @Body() updateDto: UpdateContractDto) {
    return this.service.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete contract' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

