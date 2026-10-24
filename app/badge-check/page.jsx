import PageShell from '@/components/PageShell.jsx';
import Markup from '@/games/badge-check/Markup.jsx';
import '@/games/badge-check/style.css';

export const metadata = { title: 'Badge Check · WNI' };

export default function BadgeCheckPage() {
  return (
    <PageShell page="badge-check">
      <Markup />
    </PageShell>
  );
}
