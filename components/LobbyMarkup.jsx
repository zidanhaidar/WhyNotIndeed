/* The lobby's page structure. lib/client/lobby.js fills in the logo, cards and cast once it mounts. */
export default function LobbyMarkup() {
  return (
    <div className="lobby">
      <header className="top">
        <div className="brand">
          <div className="brand-row">
            <h1 className="wordmark" data-wni-logo=""></h1>
            <p className="motto"><b className="m-w">W</b>hy <b className="m-n">n</b>ot, <b className="m-i">i</b>ndeed?</p>
          </div>
          <p className="tagline">Sixteen quick games. Four opponents. One panic button.</p>
        </div>
        <div className="tools">
          <button type="button" className="tool" id="btn-music" aria-pressed="false" title="Background music on or off (M)">Music off</button>
          <button type="button" className="tool" id="btn-sound" aria-pressed="false" title="Sound effects on or off">Sound off</button>
          <button type="button" className="tool" id="btn-volume" title="Volume for WNI only">Volume</button>
          <a className="tool tool-ranks" href="/leaderboard" title="Leaderboard">
            <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 4h10v5a5 5 0 0 1-10 0z" fill="currentColor" />
              <path d="M7 6H4.5a3 3 0 0 0 3 4M17 6h2.5a3 3 0 0 1-3 4M12 14v3M8 20h8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            <span>Leaderboard</span>
          </a>
          <button type="button" className="tool" id="btn-hide" title="Turn the screen into a boring spreadsheet">Panic button (B)</button>
          <span className="arcade-account" id="account"></span>
        </div>
      </header>

      <main>
        <h2 className="section-h">Pick a game</h2>
        <div className="cards games" id="cards"></div>

        <section className="board-row" aria-labelledby="board-h">
          <h2 className="section-h" id="board-h">Scores and your account</h2>
          <div className="cards site-cards" id="site-cards"></div>
        </section>

        <section className="cast" aria-labelledby="cast-h">
          <div className="cast-head">
            <h2 id="cast-h">Meet your opponents</h2>
            <p>Every game has the same four levels. Start with Pip. Nobody has beaten Edith yet.</p>
          </div>
          <ul className="cast-list" id="cast"></ul>
        </section>
      </main>

      <footer className="foot">
        <p className="foot-tip">
          <span className="foot-key"><kbd>B</kbd></span>
          <span>Someone walking by? Press B in any game and the screen turns into a boring budget spreadsheet. Press B again to come back. M turns the music on or off.</span>
        </p>
        <p className="sign" data-wni-logo="compact"><span>WNI stands for <b>Why not, indeed?</b> Sixteen little games for the slow part of the day.</span></p>
        <p className="foot-links"><a href="/credits">Credits and licenses</a></p>
      </footer>
    </div>
  );
}
