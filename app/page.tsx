import { connection } from 'next/server';
import { AppShell } from '@/components/AppShell';
import { AuthProvider } from '@/components/AuthProvider';
import { Game } from '@/components/Game';

export default async function HomePage() {
  // Rendered per request so Next.js can put this request's CSP nonce on its scripts (proxy.ts).
  await connection();
  return (
    <AuthProvider>
      <AppShell>
        <main className="app">
          <Game />
        </main>
      </AppShell>
    </AuthProvider>
  );
}
