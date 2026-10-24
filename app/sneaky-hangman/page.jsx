import PageShell from '@/components/PageShell.jsx';
import Markup from '@/games/sneaky-hangman/Markup.jsx';
import '@/games/sneaky-hangman/style.css';

export const metadata = { title: 'Sneaky Hangman · WNI' };

export default function SneakyHangmanPage() {
  return (
    <PageShell page="sneaky-hangman">
      <Markup />
    </PageShell>
  );
}
