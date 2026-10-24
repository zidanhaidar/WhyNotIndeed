import PageShell from '@/components/PageShell.jsx';
import Markup from '@/games/fool-the-model/Markup.jsx';
import '@/games/fool-the-model/style.css';

export const metadata = { title: 'Fool the Model · WNI' };

export default function FoolTheModelPage() {
  return (
    <PageShell page="fool-the-model">
      <Markup />
    </PageShell>
  );
}
