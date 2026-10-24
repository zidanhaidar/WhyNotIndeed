import PageShell from '@/components/PageShell.jsx';
import Markup from '@/games/coffee-spill/Markup.jsx';
import '@/games/coffee-spill/style.css';

export const metadata = { title: 'Coffee Spill · WNI' };

export default function CoffeeSpillPage() {
  return (
    <PageShell page="coffee-spill">
      <Markup />
    </PageShell>
  );
}
