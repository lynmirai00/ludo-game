import { connection } from 'next/server';
import { AuthProvider } from '@/components/AuthProvider';
import { Game } from '@/components/Game';
import { Leaderboard } from '@/components/Leaderboard';
import { MyGames } from '@/components/MyGames';
import { TopBar } from '@/components/TopBar';

export default async function HomePage() {
  // Rendered per request so Next.js can put this request's CSP nonce on its scripts (proxy.ts).
  await connection();
  return (
    <AuthProvider>
      <TopBar />
      <main className="app">
        <Game />
        <Leaderboard />
        <MyGames />
      </main>
    </AuthProvider>
  );
}
