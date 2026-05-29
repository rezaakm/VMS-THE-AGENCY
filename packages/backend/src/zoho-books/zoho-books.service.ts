import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ZohoApiClient } from './zoho-api.client';
import { ZohoOAuthService } from './zoho-oauth.service';

@Injectable()
export class ZohoBooksService {
  constructor(
    private prisma: PrismaService,
    private api: ZohoApiClient,
    private oauth: ZohoOAuthService,
    private auditLog: AuditLogService,
  ) {}

  async getStatus() {
    const conn = await this.prisma.zohoConnection.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
    const configured = !!(
      process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET
    );
    return {
      configured,
      connected: !!conn,
      organizationId: conn?.organizationId,
      organizationName: conn?.organizationName,
      expiresAt: conn?.expiresAt,
      dataCenter: conn?.dataCenter || this.oauth.getDataCenter(),
      needsOrganization:
        conn?.organizationId === 'pending-selection',
    };
  }

  async listOrganizations() {
    const conn = await this.oauth.getActiveConnection();
    if (!conn) throw new BadRequestException('Zoho not connected');

    const data = await this.api.get<{
      organizations: Array<{
        organization_id: string;
        name: string;
        currency_code: string;
      }>;
    }>('/organizations');

    return data.organizations || [];
  }

  async listChartOfAccounts() {
    const data = await this.api.get<{
      chartofaccounts: Array<{
        account_id: string;
        account_name: string;
        account_type: string;
      }>;
    }>('/chartofaccounts');
    return data.chartofaccounts || [];
  }

  async listContacts(contactType?: 'customer' | 'vendor') {
    const data = await this.api.get<{
      contacts: Array<{
        contact_id: string;
        contact_name: string;
        company_name?: string;
        contact_type: string;
        email?: string;
      }>;
    }>('/contacts', contactType ? { contact_type: contactType } : undefined);
    return data.contacts || [];
  }

  async listBills() {
    const data = await this.api.get<{ bills: unknown[] }>('/bills');
    return data.bills || [];
  }

  async listInvoices() {
    const data = await this.api.get<{ invoices: unknown[] }>('/invoices');
    return data.invoices || [];
  }

  async getProfitAndLoss(params?: { from_date?: string; to_date?: string }) {
    const data = await this.api.get('/reports/profitandloss', params);
    return data;
  }

  async syncVendorToZoho(vendorId: string, userId?: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      include: { contacts: { where: { isPrimary: true }, take: 1 } },
    });
    if (!vendor) throw new NotFoundException(`Vendor ${vendorId} not found`);

    const existing = await this.prisma.zohoSyncMap.findUnique({
      where: { entityType_localId: { entityType: 'VENDOR', localId: vendorId } },
    });

    const primary = vendor.contacts[0];
    const payload = {
      contact_name: vendor.name,
      company_name: vendor.name,
      contact_type: 'vendor',
      website: vendor.website || undefined,
      billing_address: {
        address: vendor.address,
        city: vendor.city,
        state: vendor.state,
        zip: vendor.postalCode,
        country: vendor.country,
      },
      contact_persons: primary
        ? [
            {
              first_name: primary.firstName,
              last_name: primary.lastName,
              email: primary.email,
              phone: primary.phone,
              is_primary_contact: true,
            },
          ]
        : undefined,
    };

    let zohoId: string;
    if (existing) {
      await this.api.put(`/contacts/${existing.zohoId}`, payload);
      zohoId = existing.zohoId;
    } else {
      const created = await this.api.post<{
        contact: { contact_id: string };
      }>('/contacts', payload);
      zohoId = created.contact.contact_id;
      await this.prisma.zohoSyncMap.create({
        data: {
          entityType: 'VENDOR',
          localId: vendorId,
          zohoId,
          zohoEntity: 'contact',
        },
      });
    }

    if (userId) {
      await this.auditLog.log(userId, 'ZOHO_SYNC', 'VENDOR', vendorId, {
        zohoContactId: zohoId,
      });
    }

    return { vendorId, zohoContactId: zohoId, synced: true };
  }

  async createBillFromPurchaseOrder(poId: string, userId?: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { vendor: true, items: true },
    });
    if (!po) throw new NotFoundException(`PO ${poId} not found`);

    let vendorZohoId = (
      await this.prisma.zohoSyncMap.findUnique({
        where: {
          entityType_localId: { entityType: 'VENDOR', localId: po.vendorId },
        },
      })
    )?.zohoId;

    if (!vendorZohoId) {
      const sync = await this.syncVendorToZoho(po.vendorId, userId);
      vendorZohoId = sync.zohoContactId;
    }

    const lineItems = po.items.map((item) => ({
      name: item.description,
      description: item.itemNumber,
      rate: item.unitPrice,
      quantity: item.quantity,
    }));

    const billPayload = {
      vendor_id: vendorZohoId,
      bill_number: po.orderNumber,
      date: po.orderDate.toISOString().slice(0, 10),
      due_date: po.requiredDate
        ? po.requiredDate.toISOString().slice(0, 10)
        : undefined,
      notes: po.notes || po.description || undefined,
      line_items: lineItems,
    };

    const created = await this.api.post<{
      bill: { bill_id: string; bill_number: string };
    }>('/bills', billPayload);

    const billId = created.bill.bill_id;
    await this.prisma.zohoSyncMap.upsert({
      where: {
        entityType_localId: { entityType: 'PURCHASE_ORDER', localId: poId },
      },
      create: {
        entityType: 'PURCHASE_ORDER',
        localId: poId,
        zohoId: billId,
        zohoEntity: 'bill',
      },
      update: { zohoId: billId, lastSyncedAt: new Date() },
    });

    if (userId) {
      await this.auditLog.log(userId, 'ZOHO_SYNC', 'PURCHASE_ORDER', poId, {
        zohoBillId: billId,
      });
    }

    return {
      purchaseOrderId: poId,
      zohoBillId: billId,
      billNumber: created.bill.bill_number,
    };
  }

  async getSyncMappings() {
    return this.prisma.zohoSyncMap.findMany({
      orderBy: { lastSyncedAt: 'desc' },
      take: 100,
    });
  }
}
