import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ClientsService } from './clients.service';

@ApiTags('Clients')
@Controller('api/clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  async findAll(@Query('page') page?: string, @Query('search') search?: string) {
    return this.clientsService.findAll({ page: page ? parseInt(page) : 1, search });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) { return this.clientsService.findOne(id); }
}
