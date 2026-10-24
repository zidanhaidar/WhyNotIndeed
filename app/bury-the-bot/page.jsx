import PageShell from '@/components/PageShell.jsx';
import Markup from '@/games/bury-the-bot/Markup.jsx';
import '@/games/bury-the-bot/style.css';

export const metadata = { title: 'Bury the Bot · WNI' };

export default function BuryTheBotPage() {
  return (
    <PageShell page="bury-the-bot">
      <Markup />
    </PageShell>
  );
}
