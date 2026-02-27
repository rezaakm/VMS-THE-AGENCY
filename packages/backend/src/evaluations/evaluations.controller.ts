import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { EvaluationsService } from './evaluations.service';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('evaluations')
@Controller('evaluations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EvaluationsController {
  constructor(private readonly service: EvaluationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create vendor evaluation' })
  create(@Body() createDto: CreateEvaluationDto, @Request() req) {
    return this.service.create(createDto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all evaluations' })
  @ApiQuery({ name: 'vendorId', required: false })
  findAll(@Query('vendorId') vendorId?: string) {
    return this.service.findAll(vendorId);
  }

  @Get('vendor/:vendorId/score')
  @ApiOperation({ summary: 'Get vendor performance score' })
  getVendorScore(@Param('vendorId') vendorId: string) {
    return this.service.getVendorScore(vendorId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get evaluation by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete evaluation' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

