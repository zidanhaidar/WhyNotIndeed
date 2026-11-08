import PageShell from '@/components/PageShell.jsx';
import Markup from '@/games/cleared-to-land/Markup.jsx';
import '@/games/shared/yard.css';
import '@/games/cleared-to-land/style.css';

export const metadata = { title: 'Cleared to Land · WNI' };

export default function ClearedToLandPage() {
  return (
    <PageShell page="cleared-to-land">
      <Markup />
    </PageShell>
  );
}
