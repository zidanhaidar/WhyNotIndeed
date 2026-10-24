import PageShell from '@/components/PageShell.jsx';
import Markup from '@/games/sock-trap/Markup.jsx';
import '@/games/sock-trap/style.css';

export const metadata = { title: 'Sock Trap · WNI' };

export default function SockTrapPage() {
  return (
    <PageShell page="sock-trap">
      <Markup />
    </PageShell>
  );
}
