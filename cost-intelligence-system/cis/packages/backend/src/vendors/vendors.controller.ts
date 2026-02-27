import { Controller, Get, Param, Query, Put, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { VendorsService } from './vendors.service';

@ApiTags('Vendors')
@Controller('api/vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  async findAll(@Query('page') page?: string, @Query('search') search?: string) {
    return this.vendorsService.findAll({ page: page ? parseInt(page) : 1, search });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) { return this.vendorsService.findOne(id); }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any) { return this.vendorsService.update(id, data); }
}
