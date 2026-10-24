import PageShell from '@/components/PageShell.jsx';
import Markup from '@/games/herd-instinct/Markup.jsx';
import '@/games/herd-instinct/style.css';

export const metadata = { title: 'Herd Instinct · WNI' };

export default function HerdInstinctPage() {
  return (
    <PageShell page="herd-instinct">
      <Markup />
    </PageShell>
  );
}
