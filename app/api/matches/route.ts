import { api } from '@/lib/server/app';

export const dynamic = 'force-dynamic';

export function POST(request: Request) {
  return api().createMatch(request);
}
