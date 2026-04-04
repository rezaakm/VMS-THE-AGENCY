import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RfqsService } from './rfqs.service';
import { RfqEmailService } from './rfqs.email.service';
import { CreateRfqDto } from './dto/create-rfq.dto';
import { SubmitBidDto } from './dto/submit-bid.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('rfqs')
@Controller('rfqs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RfqsController {
  constructor(
    private readonly rfqsService: RfqsService,
    private readonly emailService: RfqEmailService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new RFQ' })
  create(@Body() dto: CreateRfqDto, @Request() req) {
    return this.rfqsService.create(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List all RFQs with filters' })
  @ApiQuery({ name: 'status', required: false, enum: ['DRAFT', 'SENT', 'CLOSED', 'AWARDED', 'CANCELLED'] })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(@Query() query: { status?: any; category?: string; search?: string }) {
    return this.rfqsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get RFQ by ID' })
  findOne(@Param('id') id: string) {
    return this.rfqsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update RFQ (draft only)' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateRfqDto>) {
    return this.rfqsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete RFQ (draft only)' })
  remove(@Param('id') id: string) {
    return this.rfqsService.remove(id);
  }

  @Post(':id/send')
  @ApiOperation({ summary: 'Send RFQ to vendors (creates bid tokens, returns email/WhatsApp links)' })
  async send(@Param('id') id: string, @Body() body: { vendorIds: string[] }) {
    const result = await this.rfqsService.sendToVendors(id, body.vendorIds);

    // Try sending emails in background
    for (const link of result.sendLinks) {
      if (link.vendorEmail) {
        this.emailService.sendRfqInvite({
          vendorName: link.vendorName,
          vendorEmail: link.vendorEmail,
          rfqNumber: result.rfq.rfqNumber,
          rfqTitle: result.rfq.title,
          deadline: result.rfq.deadline,
          items: result.rfq.items.map((i) => ({
            itemNumber: i.itemNumber,
            description: i.description,
            quantity: i.quantity,
            unit: i.unit,
          })),
          bidUrl: link.bidUrl,
        });
      }
    }

    return result;
  }

  @Get(':id/compare')
  @ApiOperation({ summary: 'Compare bids side-by-side' })
  compare(@Param('id') id: string) {
    return this.rfqsService.compareBids(id);
  }

  @Post(':id/award/:bidId')
  @ApiOperation({ summary: 'Award RFQ to a vendor' })
  award(@Param('id') id: string, @Param('bidId') bidId: string) {
    return this.rfqsService.awardBid(id, bidId);
  }

  // ─── Public endpoints (vendor bid submission) ────────────────────────────

  @Public()
  @Get('bid/:token')
  @ApiOperation({ summary: 'Get RFQ details for vendor bid (public, no auth)' })
  getBid(@Param('token') token: string) {
    return this.rfqsService.getBidByToken(token);
  }

  @Public()
  @Post('bid/:token')
  @ApiOperation({ summary: 'Submit vendor bid (public, no auth)' })
  submitBid(@Param('token') token: string, @Body() dto: SubmitBidDto) {
    return this.rfqsService.submitBid(token, dto);
  }
}
