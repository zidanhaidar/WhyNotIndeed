import PageShell from '@/components/PageShell.jsx';
import Markup from '@/games/going-up/Markup.jsx';
import '@/games/going-up/style.css';

export const metadata = { title: 'Going Up · WNI' };

export default function GoingUpPage() {
  return (
    <PageShell page="going-up">
      <Markup />
    </PageShell>
  );
}
