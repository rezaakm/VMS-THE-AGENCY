/**
 * Browser: use same-origin /api proxy (works in Cursor Cloud + local).
 * Server: use BACKEND_URL or localhost for SSR.
 * Override anytime with NEXT_PUBLIC_API_URL.
 */
export function getApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    return '/api';
  }
  return (process.env.BACKEND_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
}
