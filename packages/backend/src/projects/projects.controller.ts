import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';

@ApiTags('Projects')
@Controller('api/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  async findAll(@Query('year') year?: string, @Query('clientId') clientId?: string, @Query('page') page?: string) {
    return this.projectsService.findAll({ year: year ? parseInt(year) : undefined, clientId, page: page ? parseInt(page) : 1 });
  }

  @Get('years')
  async getYears() { return this.projectsService.getYears(); }

  @Get(':id')
  async findOne(@Param('id') id: string) { return this.projectsService.findOne(id); }
}
