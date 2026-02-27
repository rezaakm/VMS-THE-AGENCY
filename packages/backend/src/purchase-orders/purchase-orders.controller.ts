import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('purchase-orders')
@Controller('purchase-orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PurchaseOrdersController {
  constructor(private readonly service: PurchaseOrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new purchase order' })
  create(@Body() createDto: CreatePurchaseOrderDto, @Request() req) {
    return this.service.create(createDto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all purchase orders' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'vendorId', required: false })
  findAll(@Query() query: any) {
    return this.service.findAll(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get purchase order statistics' })
  getStats() {
    return this.service.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get purchase order by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update purchase order' })
  update(@Param('id') id: string, @Body() updateDto: UpdatePurchaseOrderDto) {
    return this.service.update(id, updateDto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update purchase order status' })
  updateStatus(@Param('id') id: string, @Body('status') status: any) {
    return this.service.updateStatus(id, status);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete purchase order' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

