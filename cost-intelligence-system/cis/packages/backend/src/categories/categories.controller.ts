import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';

@ApiTags('Categories')
@Controller('api/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  async findAll() { return this.categoriesService.findAll(); }

  @Get(':id')
  async findOne(@Param('id') id: string) { return this.categoriesService.findOne(id); }
}
