/* Bury the Bot: the page structure. game.js fills it in once it mounts. */
export default function Markup() {
  return (
    <>
      <div className="app">
        <header id="bar"></header>

        <main className="table">
          <section className="seat panel" aria-label="Your opponent">
            <div className="face" id="face"></div>
            <div className="bot-id">
              <span className="bot-name" id="bot-name">Pip</span>
              <span className="bot-level" id="bot-level">Rookie</span>
            </div>
            <div className="bubble" id="bubble" aria-live="polite">Hi.</div>
            <div className="nerves">
              <div className="nerves-head"><span>Nerves</span><span id="nerves-word">Relaxed</span></div>
              <div className="nerves-bar"><i id="nerves-fill"></i></div>
            </div>
            <p className="bot-blurb" id="bot-blurb"></p>
          </section>

          <section className="center" aria-label="Board and hand">
            <div className="well">
              <canvas id="board" aria-label="The bot's board"></canvas>
            </div>
            <div className="hand" id="hand" aria-label="Your hand"></div>
          </section>

          <section className="ledger panel" aria-label="Score and powers">
            <div className="budget">
              <div className="budget-head">
                <span className="label">Pieces dealt</span>
                <span className="count"><b id="dealt">0</b> <small>of <span id="budget">60</span></small></span>
              </div>
              <div className="budget-bar" id="budget-bar"><i id="budget-fill"></i></div>
              <p className="budget-note" id="budget-note"></p>
            </div>

            <dl className="stats">
              <div><dt>Lines it cleared</dt><dd id="st-lines">0</dd></div>
              <div><dt>Holes in its stack</dt><dd id="st-holes">0</dd></div>
              <div><dt>Tallest column</dt><dd id="st-height">0</dd></div>
            </dl>

            <div className="plan" id="plan" aria-live="polite"></div>

            <div className="mischief">
              <div className="mischief-head"><span className="label">Mischief</span><span id="points-text">3 of 10</span></div>
              <div className="pips" id="pips"></div>
            </div>

            <div className="powers" id="powers"></div>

            <div className="game-btns">
              <button className="btn btn-quiet" id="btn-new" type="button">New deal (N)</button>
              <button className="btn btn-quiet" id="btn-rematch" type="button">Same deal again</button>
              <button className="btn btn-quiet btn-speed" id="btn-speed" type="button">Speed: normal</button>
            </div>
            <p className="best" id="best"></p>
          </section>
        </main>
      </div>
    </>
  );
}
