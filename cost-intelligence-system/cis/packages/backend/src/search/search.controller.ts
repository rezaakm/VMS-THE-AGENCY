import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SearchService } from './search.service';

@ApiTags('Search')
@Controller('api/search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Search line items with fuzzy matching' })
  @ApiQuery({ name: 'q', description: 'Search query', required: true })
  @ApiQuery({ name: 'limit', description: 'Max results', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'yearFrom', required: false })
  @ApiQuery({ name: 'yearTo', required: false })
  async search(
    @Query('q') query: string,
    @Query('limit') limit?: string,
    @Query('categoryId') categoryId?: string,
    @Query('yearFrom') yearFrom?: string,
    @Query('yearTo') yearTo?: string,
  ) {
    if (!query || query.trim().length === 0) {
      return { results: [], benchmark: null };
    }

    // Use simple search (Prisma-based) as primary, with raw SQL as enhancement
    const results = await this.searchService.searchSimple(
      query.trim(),
      parseInt(limit || '50'),
    );

    // Get benchmark for this search
    const benchmark = await this.searchService.getBenchmark(query.trim());

    return { results, benchmark };
  }

  @Get('benchmark')
  @ApiOperation({ summary: 'Get price benchmarks for an item description' })
  @ApiQuery({ name: 'q', description: 'Item description', required: true })
  @ApiQuery({ name: 'categoryId', required: false })
  async getBenchmark(
    @Query('q') query: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.searchService.getBenchmark(query, categoryId);
  }

  @Get('recommend-vendors')
  @ApiOperation({ summary: 'Get vendor recommendations for an item or category' })
  @ApiQuery({ name: 'q', description: 'Item description', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  async recommendVendors(
    @Query('q') query?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.searchService.recommendVendors(categoryId, query);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getDashboard() {
    return this.searchService.getDashboardStats();
  }
}
