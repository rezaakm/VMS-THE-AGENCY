'use client';

interface VendorFormData {
  name: string;
  email: string;
  phone: string;
  website: string;
  taxId: string;
  status: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  industry: string;
  category: string;
  description: string;
  paymentTerms: string;
  creditLimit: string;
  currency: string;
}

export const emptyVendorForm: VendorFormData = {
  name: '',
  email: '',
  phone: '',
  website: '',
  taxId: '',
  status: 'PENDING',
  address: '',
  city: '',
  state: '',
  country: 'Oman',
  postalCode: '',
  industry: '',
  category: '',
  description: '',
  paymentTerms: 'Net 30',
  creditLimit: '',
  currency: 'OMR',
};

export function vendorToForm(v: Record<string, unknown>): VendorFormData {
  return {
    name: String(v.name ?? ''),
    email: String(v.email ?? ''),
    phone: String(v.phone ?? ''),
    website: String(v.website ?? ''),
    taxId: String(v.taxId ?? ''),
    status: String(v.status ?? 'PENDING'),
    address: String(v.address ?? ''),
    city: String(v.city ?? ''),
    state: String(v.state ?? ''),
    country: String(v.country ?? 'Oman'),
    postalCode: String(v.postalCode ?? ''),
    industry: String(v.industry ?? ''),
    category: String(v.category ?? ''),
    description: String(v.description ?? ''),
    paymentTerms: String(v.paymentTerms ?? ''),
    creditLimit: v.creditLimit != null ? String(v.creditLimit) : '',
    currency: String(v.currency ?? 'OMR'),
  };
}

export function formToVendorPayload(form: VendorFormData) {
  return {
    name: form.name,
    email: form.email,
    phone: form.phone,
    website: form.website || undefined,
    taxId: form.taxId || undefined,
    status: form.status,
    address: form.address,
    city: form.city,
    state: form.state,
    country: form.country,
    postalCode: form.postalCode,
    industry: form.industry,
    category: form.category,
    description: form.description || undefined,
    paymentTerms: form.paymentTerms || undefined,
    creditLimit: form.creditLimit ? parseFloat(form.creditLimit) : undefined,
    currency: form.currency || 'OMR',
  };
}

type Props = {
  form: VendorFormData;
  onChange: (form: VendorFormData) => void;
};

export default function VendorForm({ form, onChange }: Props) {
  const set = (key: keyof VendorFormData, value: string) =>
    onChange({ ...form, [key]: value });

  const field =
    'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
        <input className={field} value={form.name} onChange={(e) => set('name', e.target.value)} required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
        <input type="email" className={field} value={form.email} onChange={(e) => set('email', e.target.value)} required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
        <input className={field} value={form.phone} onChange={(e) => set('phone', e.target.value)} required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Industry *</label>
        <input className={field} value={form.industry} onChange={(e) => set('industry', e.target.value)} required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
        <input className={field} value={form.category} onChange={(e) => set('category', e.target.value)} required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <select className={field} value={form.status} onChange={(e) => set('status', e.target.value)}>
          <option value="PENDING">Pending</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="BLACKLISTED">Blacklisted</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
        <input className={field} value={form.currency} onChange={(e) => set('currency', e.target.value)} />
      </div>
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
        <input className={field} value={form.address} onChange={(e) => set('address', e.target.value)} required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
        <input className={field} value={form.city} onChange={(e) => set('city', e.target.value)} required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
        <input className={field} value={form.state} onChange={(e) => set('state', e.target.value)} required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Country *</label>
        <input className={field} value={form.country} onChange={(e) => set('country', e.target.value)} required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Postal code *</label>
        <input className={field} value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} required />
      </div>
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea className={field} rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
      </div>
    </div>
  );
}
