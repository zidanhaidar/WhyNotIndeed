/* Minesweeper: the page structure. game.js fills it in once it mounts. */
export default function Markup() {
  return (
    <>
      <header id="bar"></header>

      <main className="field">
        <section className="stage" aria-label="Your minefield">
          <div className="case">
            <div className="hud">
              <div className="led"><span>Mines</span><b id="mines-left">10</b></div>
              <button type="button" className="smiley" id="btn-face" aria-label="New field (N)"></button>
              <div className="led"><span>Time</span><b id="time">0:00</b></div>
            </div>
            <div className="board-wrap">
              <div className="board" id="board" role="group" aria-label="Minefield. Open a square to start."></div>
              <div className="veil" id="veil" hidden><b>Paused</b><span>Press P to carry on</span></div>
              <div className="cue" id="cue" hidden></div>
            </div>
          </div>
          <div className="tools">
            <button type="button" className="pill tool" id="btn-mode" aria-pressed="false">Tapping digs</button>
            <span className="hint" id="hint">Right click or hold to plant a flag.</span>
          </div>
        </section>

        <aside className="panel" aria-label="The race">
          <div className="who">
            <div className="who-face" id="face"></div>
            <div>
              <span className="who-name" id="bot-name">Pip</span>
              <span className="who-rank" id="bot-rank">Rookie sweeper</span>
            </div>
          </div>
          <p className="bubble" id="bubble" aria-live="polite">Hi.</p>

          <div className="race">
            <span className="race-head">Safe squares to go</span>
            <div className="lane you"><span>You</span><div className="track"><i id="you-fill"></i></div><b id="you-count">0</b></div>
            <div className="lane bot"><span id="bot-short">Pip</span><div className="track"><i id="bot-fill"></i></div><b id="bot-count">0</b></div>
          </div>

          <ul className="tips" id="tips"></ul>
          <div className="acts">
            <button type="button" className="pill" id="btn-pause">Pause (P)</button>
            <button type="button" className="pill" id="btn-new">New field (N)</button>
          </div>
          <p className="best" id="best"></p>
        </aside>
      </main>
    </>
  );
}
