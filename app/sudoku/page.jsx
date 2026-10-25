import PageShell from '@/components/PageShell.jsx';
import Markup from '@/games/sudoku/Markup.jsx';
import '@/games/sudoku/style.css';

export const metadata = { title: 'Sudoku · WNI' };

export default function SudokuPage() {
  return (
    <PageShell page="sudoku">
      <Markup />
    </PageShell>
  );
}
