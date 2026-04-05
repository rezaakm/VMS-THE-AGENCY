import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRfqDto } from './dto/create-rfq.dto';
import { SubmitBidDto } from './dto/submit-bid.dto';
import { RFQStatus, BidStatus } from '@prisma/client';

@Injectable()
export class RfqsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateRfqDto, userId: string) {
    const rfqNumber = await this.generateRfqNumber();
    const { items, vendorIds, ...rfqData } = dto;

    const rfq = await this.prisma.rFQ.create({
      data: {
        ...rfqData,
        rfqNumber,
        createdById: userId,
        items: {
          create: items.map((item, idx) => ({
            ...item,
            itemNumber: idx + 1,
          })),
        },
      },
      include: { items: true, createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });

    // Create bid slots for selected vendors
    if (vendorIds?.length) {
      await this.prisma.rFQVendorBid.createMany({
        data: vendorIds.map((vendorId) => ({
          rfqId: rfq.id,
          vendorId,
        })),
      });
    }

    return this.findOne(rfq.id);
  }

  async findAll(filters?: { status?: RFQStatus; category?: string; search?: string }) {
    const where: any = {};

    if (filters?.status) where.status = filters.status;
    if (filters?.category) where.category = { contains: filters.category, mode: 'insensitive' };
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { rfqNumber: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.rFQ.findMany({
      where,
      include: {
        items: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        vendorBids: {
          include: {
            vendor: { select: { id: true, name: true, code: true } },
          },
        },
        _count: { select: { vendorBids: true, items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const rfq = await this.prisma.rFQ.findUnique({
      where: { id },
      include: {
        items: { orderBy: { itemNumber: 'asc' } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        vendorBids: {
          include: {
            vendor: { select: { id: true, name: true, code: true, email: true, phone: true } },
            items: { include: { rfqItem: true } },
          },
        },
      },
    });
    if (!rfq) throw new NotFoundException(`RFQ ${id} not found`);
    return rfq;
  }

  async update(id: string, dto: Partial<CreateRfqDto>) {
    const rfq = await this.findOne(id);
    if (rfq.status !== 'DRAFT') throw new BadRequestException('Can only edit RFQs in DRAFT status');

    const { items, vendorIds, ...data } = dto;

    if (items) {
      await this.prisma.rFQItem.deleteMany({ where: { rfqId: id } });
      await this.prisma.rFQItem.createMany({
        data: items.map((item, idx) => ({ ...item, rfqId: id, itemNumber: idx + 1 })),
      });
    }

    await this.prisma.rFQ.update({ where: { id }, data });
    return this.findOne(id);
  }

  async remove(id: string) {
    const rfq = await this.findOne(id);
    if (rfq.status !== 'DRAFT') throw new BadRequestException('Can only delete RFQs in DRAFT status');
    await this.prisma.rFQ.delete({ where: { id } });
    return { message: 'RFQ deleted' };
  }

  async sendToVendors(id: string, vendorIds: string[]) {
    const rfq = await this.findOne(id);
    if (rfq.status === 'AWARDED' || rfq.status === 'CANCELLED') {
      throw new BadRequestException('Cannot send this RFQ');
    }

    // Create bid slots for new vendors (skip existing)
    const existingVendorIds = rfq.vendorBids.map((b) => b.vendor.id);
    const newVendorIds = vendorIds.filter((v) => !existingVendorIds.includes(v));

    if (newVendorIds.length > 0) {
      await this.prisma.rFQVendorBid.createMany({
        data: newVendorIds.map((vendorId) => ({ rfqId: id, vendorId })),
      });
    }

    // Update status to SENT
    await this.prisma.rFQ.update({ where: { id }, data: { status: 'SENT' } });

    // Get all bids with vendor details for sending
    const updatedRfq = await this.findOne(id);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const sendLinks = updatedRfq.vendorBids.map((bid) => ({
      vendorId: bid.vendor.id,
      vendorName: bid.vendor.name,
      vendorEmail: bid.vendor.email,
      vendorPhone: bid.vendor.phone,
      token: bid.token,
      bidUrl: `${frontendUrl}/bid/${bid.token}`,
      whatsappUrl: bid.vendor.phone
        ? `https://wa.me/${bid.vendor.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
            `Hi ${bid.vendor.name},\n\nYou're invited to submit a quotation for: ${rfq.title}\nRFQ #: ${rfq.rfqNumber}\nDeadline: ${new Date(rfq.deadline).toLocaleDateString('en-GB')}\n\nPlease submit your pricing here:\n${frontendUrl}/bid/${bid.token}`,
          )}`
        : null,
      status: bid.status,
    }));

    return { rfq: updatedRfq, sendLinks };
  }

  // Public endpoints (no auth)
  async getBidByToken(token: string) {
    const bid = await this.prisma.rFQVendorBid.findUnique({
      where: { token },
      include: {
        rfq: { include: { items: { orderBy: { itemNumber: 'asc' } } } },
        vendor: { select: { id: true, name: true } },
        items: true,
      },
    });
    if (!bid) throw new NotFoundException('Invalid bid link');
    return bid;
  }

  async submitBid(token: string, dto: SubmitBidDto) {
    const bid = await this.prisma.rFQVendorBid.findUnique({
      where: { token },
      include: { rfq: { include: { items: true } } },
    });
    if (!bid) throw new NotFoundException('Invalid bid link');
    if (bid.status === 'ACCEPTED' || bid.status === 'REJECTED') {
      throw new BadRequestException('This bid has already been processed');
    }
    if (new Date() > bid.rfq.deadline) {
      throw new BadRequestException('The deadline for this RFQ has passed');
    }

    // Delete old bid items if resubmitting
    await this.prisma.rFQBidItem.deleteMany({ where: { bidId: bid.id } });

    // Create bid items and calculate total
    const bidItems = dto.items.map((item) => {
      const rfqItem = bid.rfq.items.find((ri) => ri.id === item.rfqItemId);
      if (!rfqItem) throw new BadRequestException(`Invalid item ID: ${item.rfqItemId}`);
      return {
        bidId: bid.id,
        rfqItemId: item.rfqItemId,
        unitPrice: item.unitPrice,
        totalPrice: item.unitPrice * rfqItem.quantity,
        notes: item.notes,
      };
    });

    await this.prisma.rFQBidItem.createMany({ data: bidItems });

    const totalAmount = bidItems.reduce((sum, i) => sum + i.totalPrice, 0);

    await this.prisma.rFQVendorBid.update({
      where: { id: bid.id },
      data: {
        status: 'SUBMITTED',
        totalAmount,
        notes: dto.notes,
        validityDays: dto.validityDays,
        submittedAt: new Date(),
      },
    });

    return { message: 'Bid submitted successfully', totalAmount };
  }

  async compareBids(rfqId: string) {
    const rfq = await this.findOne(rfqId);
    const submittedBids = rfq.vendorBids.filter((b) => b.status === 'SUBMITTED');

    const comparison = rfq.items.map((item) => {
      const prices = submittedBids.map((bid) => {
        const bidItem = bid.items.find((bi) => bi.rfqItemId === item.id);
        return {
          vendorId: bid.vendor.id,
          vendorName: bid.vendor.name,
          unitPrice: bidItem?.unitPrice || null,
          totalPrice: bidItem?.totalPrice || null,
          notes: bidItem?.notes || null,
        };
      });

      const validPrices = prices.filter((p) => p.unitPrice !== null);
      const lowestPrice = validPrices.length
        ? Math.min(...validPrices.map((p) => p.unitPrice!))
        : null;

      return {
        itemId: item.id,
        itemNumber: item.itemNumber,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        prices,
        lowestUnitPrice: lowestPrice,
      };
    });

    const vendorTotals = submittedBids.map((bid) => ({
      vendorId: bid.vendor.id,
      vendorName: bid.vendor.name,
      totalAmount: bid.totalAmount,
      submittedAt: bid.submittedAt,
      validityDays: bid.validityDays,
      notes: bid.notes,
    }));

    return { rfq: { id: rfq.id, rfqNumber: rfq.rfqNumber, title: rfq.title }, comparison, vendorTotals };
  }

  async awardBid(rfqId: string, bidId: string) {
    const rfq = await this.findOne(rfqId);
    const bid = rfq.vendorBids.find((b) => b.id === bidId);
    if (!bid) throw new NotFoundException('Bid not found');
    if (bid.status !== 'SUBMITTED') throw new BadRequestException('Can only award submitted bids');

    // Award this bid, reject others
    await this.prisma.$transaction([
      this.prisma.rFQ.update({ where: { id: rfqId }, data: { status: 'AWARDED' } }),
      this.prisma.rFQVendorBid.update({ where: { id: bidId }, data: { status: 'ACCEPTED' } }),
      this.prisma.rFQVendorBid.updateMany({
        where: { rfqId, id: { not: bidId }, status: 'SUBMITTED' },
        data: { status: 'REJECTED' },
      }),
    ]);

    return this.findOne(rfqId);
  }

  private async generateRfqNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.rFQ.count({
      where: { rfqNumber: { startsWith: `RFQ-${year}` } },
    });
    return `RFQ-${year}-${String(count + 1).padStart(3, '0')}`;
  }
}
