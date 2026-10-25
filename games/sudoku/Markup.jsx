/* Sudoku: the page structure. game.js fills it in once it mounts. */
export default function Markup() {
  return (
    <>
      <header id="bar"></header>

      <main className="notebook">
        <section className="stage" aria-label="Your puzzle">
          <div className="paper">
            <div className="grid hidden" id="grid" role="group" aria-label="Sudoku grid. Pick a square, then a number."></div>
            <div className="cover" id="cover" hidden>
              <h2 id="cover-title">Ready?</h2>
              <p id="cover-text">The robot is solving the same puzzle. Fill your grid before it fills its own.</p>
              <button type="button" className="go" id="btn-start">Start (Enter)</button>
            </div>
            <div className="cue" id="cue" hidden></div>
          </div>
          <div className="pad" id="pad" aria-label="Numbers"></div>
          <div className="tools">
            <button type="button" className="pill tool" id="btn-notes" aria-pressed="false">Notes (Space)</button>
            <button type="button" className="pill tool" id="btn-clear">Clear notes</button>
          </div>
        </section>

        <aside className="panel" aria-label="The race">
          <div className="who">
            <div className="who-face" id="face"></div>
            <div>
              <span className="who-name" id="bot-name">Pip</span>
              <span className="who-rank" id="bot-rank">Rookie solver</span>
            </div>
          </div>
          <p className="bubble" id="bubble" aria-live="polite">Hi.</p>

          <div className="race">
            <span className="race-head">Squares to go</span>
            <div className="lane you"><span>You</span><div className="track"><i id="you-fill"></i></div><b id="you-count">0</b></div>
            <div className="lane bot"><span id="bot-short">Pip</span><div className="track"><i id="bot-fill"></i></div><b id="bot-count">0</b></div>
          </div>
          <div className="copy">
            <span className="copy-head" id="copy-head">Pip's copy</span>
            <div className="mini" id="mini" aria-hidden="true"></div>
            <div className="clock">
              <span>Time</span><b id="time">0:00</b>
              <span>Mistakes</span><div className="marks" id="marks"></div>
            </div>
          </div>

          <ul className="tips" id="tips"></ul>
          <div className="acts">
            <button type="button" className="pill" id="btn-pause">Pause (P)</button>
            <button type="button" className="pill" id="btn-new">New puzzle (N)</button>
          </div>
          <p className="best" id="best"></p>
        </aside>
      </main>
    </>
  );
}
