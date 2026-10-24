import LobbyMarkup from '@/components/LobbyMarkup.jsx';
import PageShell from '@/components/PageShell.jsx';
import '@/styles/lobby.css';
// site.css does not style the lobby (it is scoped to the other site pages), but loading the same pair on every
// site page keeps the two files in one bundle, so site.css always lands after lobby.css however you navigate.
import '@/styles/site.css';

export default function LobbyPage() {
  return (
    <PageShell page="lobby">
      <LobbyMarkup />
    </PageShell>
  );
}
