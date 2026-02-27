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
import { VendorsService } from './vendors.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('vendors')
@Controller('vendors')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new vendor' })
  create(@Body() createVendorDto: CreateVendorDto) {
    return this.vendorsService.create(createVendorDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all vendors' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(@Query() query: any) {
    return this.vendorsService.findAll(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get vendor statistics' })
  getStats() {
    return this.vendorsService.getStats();
  }

  @Get('top')
  @ApiOperation({ summary: 'Get top performing vendors' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getTopVendors(@Query('limit') limit?: string) {
    return this.vendorsService.getTopVendors(limit ? parseInt(limit) : 10);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get vendor by ID' })
  findOne(@Param('id') id: string) {
    return this.vendorsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update vendor' })
  update(@Param('id') id: string, @Body() updateVendorDto: UpdateVendorDto) {
    return this.vendorsService.update(id, updateVendorDto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update vendor status' })
  updateStatus(@Param('id') id: string, @Body('status') status: any) {
    return this.vendorsService.updateStatus(id, status);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete vendor' })
  remove(@Param('id') id: string) {
    return this.vendorsService.remove(id);
  }
}

