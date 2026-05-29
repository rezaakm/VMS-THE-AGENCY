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
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { VendorsService } from './vendors.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('vendors')
@Controller('vendors')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new vendor' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.BUYER)
  create(
    @Body() createVendorDto: CreateVendorDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.vendorsService.create(createVendorDto, req.user.id);
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
  update(
    @Param('id') id: string,
    @Body() updateVendorDto: UpdateVendorDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.vendorsService.update(id, updateVendorDto, req.user.id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update vendor status' })
  updateStatus(@Param('id') id: string, @Body('status') status: any) {
    return this.vendorsService.updateStatus(id, status);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete vendor' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  remove(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.vendorsService.remove(id, req.user.id);
  }
}

