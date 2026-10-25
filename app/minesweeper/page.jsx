import PageShell from '@/components/PageShell.jsx';
import Markup from '@/games/minesweeper/Markup.jsx';
import '@/games/minesweeper/style.css';

export const metadata = { title: 'Minesweeper · WNI' };

export default function MinesweeperPage() {
  return (
    <PageShell page="minesweeper">
      <Markup />
    </PageShell>
  );
}
