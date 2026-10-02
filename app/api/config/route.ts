import { loadConfig } from '@/lib/server/config';

// Read env at request time, not at build time.
export const dynamic = 'force-dynamic';

export function GET() {
  const { zitadelUrl, clientId } = loadConfig();
  return Response.json({ zitadelUrl, clientId });
}
