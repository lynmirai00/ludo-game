import { api } from '@/lib/server/app';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api().getMatch(request, (await params).id);
}
