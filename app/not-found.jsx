import PageShell from '@/components/PageShell.jsx';
import '@/styles/lobby.css';
import '@/styles/site.css';

export const metadata = { title: 'Nothing here · WNI' };

export default function NotFound() {
  return (
    <PageShell page="not-found">
      <div className="site">
        <div className="note-card sticker">
          <h1 className="site-title">Nothing here.</h1>
          <p>That page wandered off. Maybe it is hiding behind the panic button.</p>
          <a className="btn-ink" href="/">Back to the WNI lobby</a>
        </div>
      </div>
    </PageShell>
  );
}
