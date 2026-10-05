import { api } from '@/lib/server/app';

export const dynamic = 'force-dynamic';

export function PUT(request: Request) {
  return api().putLocale(request);
}
