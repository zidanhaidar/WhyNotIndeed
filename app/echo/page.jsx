import PageShell from '@/components/PageShell.jsx';
import Markup from '@/games/echo/Markup.jsx';
import '@/games/echo/style.css';

export const metadata = { title: 'Echo · WNI' };

export default function EchoPage() {
  return (
    <PageShell page="echo">
      <Markup />
    </PageShell>
  );
}
