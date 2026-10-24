import PageShell from '@/components/PageShell.jsx';
import Markup from '@/games/copycat/Markup.jsx';
import '@/games/copycat/style.css';

export const metadata = { title: 'Copycat · WNI' };

export default function CopycatPage() {
  return (
    <PageShell page="copycat">
      <Markup />
    </PageShell>
  );
}
