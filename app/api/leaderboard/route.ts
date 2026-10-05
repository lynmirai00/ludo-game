import { api } from '@/lib/server/app';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return api().getLeaderboard(request);
}

export function DELETE(request: Request) {
  return api().resetLeaderboards(request);
}
