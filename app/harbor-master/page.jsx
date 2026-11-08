import PageShell from '@/components/PageShell.jsx';
import Markup from '@/games/harbor-master/Markup.jsx';
import '@/games/shared/yard.css';
import '@/games/harbor-master/style.css';

export const metadata = { title: 'Harbor Master · WNI' };

export default function HarborMasterPage() {
  return (
    <PageShell page="harbor-master">
      <Markup />
    </PageShell>
  );
}
