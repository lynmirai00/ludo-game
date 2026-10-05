import { api } from '@/lib/server/app';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return api().getCurrentMatch(request);
}
