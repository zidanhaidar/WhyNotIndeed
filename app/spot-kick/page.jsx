import PageShell from '@/components/PageShell.jsx';
import Markup from '@/games/spot-kick/Markup.jsx';
import '@/games/spot-kick/style.css';

export const metadata = { title: 'Spot Kick · WNI' };

export default function SpotKickPage() {
  return (
    <PageShell page="spot-kick">
      <Markup />
    </PageShell>
  );
}
