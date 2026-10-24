import PageShell from '@/components/PageShell.jsx';
import Markup from '@/games/cable-spaghetti/Markup.jsx';
import '@/games/cable-spaghetti/style.css';

export const metadata = { title: 'Cable Spaghetti · WNI' };

export default function CableSpaghettiPage() {
  return (
    <PageShell page="cable-spaghetti">
      <Markup />
    </PageShell>
  );
}
