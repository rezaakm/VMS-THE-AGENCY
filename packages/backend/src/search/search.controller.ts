import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SearchService } from './search.service';

@ApiTags('Search')
@Controller('api/search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Search line items with fuzzy matching' })
  async search(@Query('q') query: string, @Query('limit') limit?: string, @Query('categoryId') categoryId?: string) {
    if (!query || query.trim().length === 0) return { results: [], benchmark: null };
    const results = await this.searchService.searchSimple(query.trim(), parseInt(limit || '50'));
    const benchmark = await this.searchService.getBenchmark(query.trim());
    return { results, benchmark };
  }

  @Get('benchmark')
  async getBenchmark(@Query('q') query: string, @Query('categoryId') categoryId?: string) {
    return this.searchService.getBenchmark(query, categoryId);
  }

  @Get('recommend-vendors')
  async recommendVendors(@Query('q') query?: string, @Query('categoryId') categoryId?: string) {
    return this.searchService.recommendVendors(categoryId, query);
  }

  @Get('dashboard')
  async getDashboard() { return this.searchService.getDashboardStats(); }
}
