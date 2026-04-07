import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Request,
  UseGuards, UseInterceptors, UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BoqService } from './boq.service';
import { CreateBoqDto } from './dto/create-boq.dto';
import { UpdateBoqItemDto } from './dto/update-boq-item.dto';

@ApiTags('boq')
@Controller('boq')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BoqController {
  constructor(private readonly boqService: BoqService) {}

  @Post()
  @ApiOperation({ summary: 'Create BOQ from uploaded drawings' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('drawings', 10, {
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB per file
    fileFilter: (_req, file, cb) => {
      const allowed = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'image/tiff'];
      cb(null, allowed.includes(file.mimetype));
    },
  }))
  create(
    @Body() dto: CreateBoqDto,
    @Request() req,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.boqService.create(dto, req.user.id, files);
  }

  @Get()
  @ApiOperation({ summary: 'List all BOQs' })
  @ApiQuery({ name: 'status', required: false, enum: ['PROCESSING', 'DRAFT', 'REVIEWED', 'APPROVED', 'EXPORTED'] })
  @ApiQuery({ name: 'search', required: false })
  findAll(@Query() query: { status?: string; search?: string }) {
    return this.boqService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get BOQ by ID with all items and drawings' })
  findOne(@Param('id') id: string) {
    return this.boqService.findOne(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update BOQ status' })
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.boqService.updateStatus(id, status);
  }

  @Post(':id/reprice')
  @ApiOperation({ summary: 'Re-price all BOQ items from cost sheets and vendor data' })
  repriceAll(@Param('id') id: string) {
    return this.boqService.repriceAll(id);
  }

  @Post(':id/sync-reprice')
  @ApiOperation({ summary: 'Sync latest cost sheets from Google Drive then re-price all items' })
  syncAndReprice(@Param('id') id: string) {
    return this.boqService.syncAndReprice(id);
  }

  @Post(':id/items')
  @ApiOperation({ summary: 'Add a new item to BOQ' })
  addItem(@Param('id') id: string, @Body() dto: any) {
    return this.boqService.addItem(id, dto);
  }

  @Patch('items/:itemId')
  @ApiOperation({ summary: 'Update a BOQ item (quantity, price, description)' })
  updateItem(@Param('itemId') itemId: string, @Body() dto: UpdateBoqItemDto) {
    return this.boqService.updateItem(itemId, dto);
  }

  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Remove a BOQ item' })
  removeItem(@Param('itemId') itemId: string) {
    return this.boqService.removeItem(itemId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete BOQ' })
  remove(@Param('id') id: string) {
    return this.boqService.remove(id);
  }
}
