import PageShell from '@/components/PageShell.jsx';
import Markup from '@/games/rush-hour/Markup.jsx';
import '@/games/shared/yard.css';
import '@/games/rush-hour/style.css';

export const metadata = { title: 'Rush Hour · WNI' };

export default function RushHourPage() {
  return (
    <PageShell page="rush-hour">
      <Markup />
    </PageShell>
  );
}
