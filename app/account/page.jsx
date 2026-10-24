import PageShell from '@/components/PageShell.jsx';
import '@/styles/lobby.css';
import '@/styles/site.css';

export const metadata = { title: 'Your account · WNI' };

// Keyed by the address settings, so an in-app link here with other settings starts the page script afresh.
export default async function AccountPage({ searchParams }) {
  const settings = new URLSearchParams(await searchParams).toString();
  return (
    <PageShell key={settings} page="account">
      <div className="site">
        <header id="bar"></header>
        <main id="main"><p className="loading">Checking who you are...</p></main>
      </div>
    </PageShell>
  );
}
