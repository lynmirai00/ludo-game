import { AuthProvider } from '@/components/AuthProvider';
import { Game } from '@/components/Game';
import { Leaderboard } from '@/components/Leaderboard';
import { TopBar } from '@/components/TopBar';

export default function HomePage() {
  return (
    <AuthProvider>
      <TopBar />
      <main className="app">
        <Game />
        <Leaderboard />
      </main>
    </AuthProvider>
  );
}
