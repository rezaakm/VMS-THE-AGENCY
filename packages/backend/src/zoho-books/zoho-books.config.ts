export const ZOHO_DC_MAP: Record<
  string,
  { accounts: string; api: string }
> = {
  com: {
    accounts: 'https://accounts.zoho.com',
    api: 'https://www.zohoapis.com',
  },
  sa: {
    accounts: 'https://accounts.zoho.sa',
    api: 'https://www.zohoapis.sa',
  },
  eu: {
    accounts: 'https://accounts.zoho.eu',
    api: 'https://www.zohoapis.eu',
  },
  in: {
    accounts: 'https://accounts.zoho.in',
    api: 'https://www.zohoapis.in',
  },
  'com.au': {
    accounts: 'https://accounts.zoho.com.au',
    api: 'https://www.zohoapis.com.au',
  },
};

export const ZOHO_BOOKS_SCOPES = [
  'ZohoBooks.settings.READ',
  'ZohoBooks.contacts.READ',
  'ZohoBooks.contacts.CREATE',
  'ZohoBooks.contacts.UPDATE',
  'ZohoBooks.bills.READ',
  'ZohoBooks.bills.CREATE',
  'ZohoBooks.invoices.READ',
  'ZohoBooks.purchaseorders.READ',
  'ZohoBooks.purchaseorders.CREATE',
  'ZohoBooks.accountants.READ',
  'ZohoBooks.reports.READ',
].join(',');
