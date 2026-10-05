import { Game } from '@/components/Game';
import { TopBar } from '@/components/TopBar';

export default function HomePage() {
  return (
    <>
      <TopBar />
      <main className="app">
        <Game />
      </main>
    </>
  );
}
