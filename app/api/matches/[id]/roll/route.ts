import { api } from '@/lib/server/app';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api().roll(request, (await params).id);
}
