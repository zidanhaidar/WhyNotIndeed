import PageShell from '@/components/PageShell.jsx';
import '@/styles/lobby.css';
import '@/styles/site.css';

export const metadata = { title: 'Credits · WNI' };

const FONTS = [
  ['Atkinson Hyperlegible', 'Braille Institute of America', 'SIL Open Font License 1.1'],
  ['Bowlby One', 'Vernon Adams', 'SIL Open Font License 1.1'],
  ['Alfa Slab One', 'JM Solé', 'SIL Open Font License 1.1'],
  ['Bungee', 'David Jonathan Ross', 'SIL Open Font License 1.1'],
  ['Chewy', 'Sideshow (Font Diner)', 'Apache License 2.0'],
  ['Bangers', 'Vernon Adams', 'SIL Open Font License 1.1'],
  ['Titan One', 'Rodrigo Fuenzalida', 'SIL Open Font License 1.1'],
  ['Luckiest Guy', 'Astigmatic', 'Apache License 2.0'],
  ['Shrikhand', 'Jonny Pinhorn', 'SIL Open Font License 1.1'],
  ['Lilita One', 'Juan Montoreano', 'SIL Open Font License 1.1'],
  ['Righteous', 'Astigmatic', 'SIL Open Font License 1.1'],
  ['Limelight', 'Sorkin Type (Nicole Fally)', 'SIL Open Font License 1.1'],
  ['Rye', 'Sorkin Type (Nicole Fally)', 'SIL Open Font License 1.1'],
  ['VT323', 'Peter Hull', 'SIL Open Font License 1.1'],
  ['Special Elite', 'Astigmatic', 'Apache License 2.0']
];

export default function CreditsPage() {
  return (
    <PageShell page="credits">
      <div className="site">
        <header className="site-bar">
          <a className="site-home" href="/" title="Back to the WNI lobby"><span>Lobby</span></a>
          <h1 className="site-title">Credits</h1>
        </header>
        <main className="credits">
          <section className="sticker credit-card">
            <h2>Music and sound</h2>
            <p>Every soundtrack and sound effect in WNI is original, written for this project and played live in your browser by a small Web Audio synthesizer. There are no recordings, samples or existing songs. The chord progressions are common musical building blocks that nobody owns.</p>
          </section>
          <section className="sticker credit-card">
            <h2>Art and games</h2>
            <p>All game art, characters and the WNI logo are drawn in code for WNI. Every game and its rules were made for WNI.</p>
          </section>
          <section className="sticker credit-card">
            <h2>Fonts</h2>
            <p>Served from this site, unchanged, from Google Fonts. Full license texts and copyright notices: <a href="/fonts/LICENSES.txt" data-licenses="">LICENSES</a>.</p>
            <ul className="credit-list">
              {FONTS.map(([name, by, lic]) => (
                <li key={name}><b>{name}</b> by {by}. {lic}.</li>
              ))}
            </ul>
          </section>
          <section className="sticker credit-card">
            <h2>Words</h2>
            <p>Sneaky Hangman&apos;s words come from the <a href="https://www.datamuse.com/api/">Datamuse API</a>, which draws on freely available sources such as Google Books Ngrams, WordNet and Wiktionary.</p>
            <p>The backup word list is derived from <a href="https://github.com/rspeer/wordfreq">wordfreq</a> by Robyn Speer, licensed <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>, and is shared under the same license.</p>
          </section>
          <section className="sticker credit-card">
            <h2>Handwritten digits</h2>
            <p>Fool the Model uses the <a href="https://doi.org/10.24432/C50P49">Optical Recognition of Handwritten Digits</a> dataset by E. Alpaydin and C. Kaynak (1998), UCI Machine Learning Repository, licensed <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Its models were trained on these digits and its letters show them.</p>
          </section>
        </main>
      </div>
    </PageShell>
  );
}
