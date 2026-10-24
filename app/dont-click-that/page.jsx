import PageShell from '@/components/PageShell.jsx';
import Markup from '@/games/dont-click-that/Markup.jsx';
import '@/games/dont-click-that/style.css';

export const metadata = { title: 'Don\'t Click That · WNI' };

export default function DontClickThatPage() {
  return (
    <PageShell page="dont-click-that">
      <Markup />
    </PageShell>
  );
}
