import PageShell from '@/components/PageShell.jsx';
import Markup from '@/games/level-crossing/Markup.jsx';
import '@/games/level-crossing/style.css';

export const metadata = { title: 'Level Crossing · WNI' };

export default function LevelCrossingPage() {
  return (
    <PageShell page="level-crossing">
      <Markup />
    </PageShell>
  );
}
