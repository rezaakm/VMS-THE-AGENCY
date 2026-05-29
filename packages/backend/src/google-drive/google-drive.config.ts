export const EXCEL_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

export function categorizeMimeType(mimeType: string): string {
  if (EXCEL_MIME_TYPES.includes(mimeType)) return 'SPREADSHEET';
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (
    mimeType.includes('document') ||
    mimeType.includes('word') ||
    mimeType === 'application/vnd.google-apps.document' ||
    mimeType === 'text/plain' ||
    mimeType === 'text/csv'
  ) {
    return 'DOCUMENT';
  }
  return 'OTHER';
}
