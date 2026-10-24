/* Spot Kick: the page structure. game.js fills it in once it mounts. */
export default function Markup() {
  return (
    <>
      <header id="bar"></header>

      <main className="stadium">
        <section className="stage-wrap" aria-label="The goal">
          <div className="stage">
            <svg id="scene" viewBox="0 0 800 480" role="img" aria-label="A goal with six target zones"></svg>
            <div className="banner" id="banner" hidden></div>
            <div className="prompt" id="prompt"></div>
          </div>
          <div className="meter" id="meter" aria-hidden="true">
            <div className="meter-track">
              <span className="band weak"></span><span className="band ok"></span><span className="band sweet"></span><span className="band risky"></span><span className="band wild"></span>
              <i className="needle" id="needle"></i>
            </div>
            <div className="meter-labels"><span>Soft</span><span>Sweet spot</span><span>Too hard</span></div>
          </div>
        </section>

        <aside className="side" aria-label="Scoreboard">
          <div className="board">
            <div className="board-row"><span className="board-name">You</span><span className="dots" id="dots-you"></span><b id="score-you">0</b></div>
            <div className="board-row"><span className="board-name" id="bot-short">Pip</span><span className="dots" id="dots-bot"></span><b id="score-bot">0</b></div>
            <p className="board-note" id="board-note">Five kicks each. Then sudden death.</p>
          </div>

          <div className="rival">
            <div className="rival-face" id="face"></div>
            <div>
              <span className="rival-name" id="bot-name">Pip</span>
              <span className="rival-rank" id="bot-rank">Rookie keeper</span>
            </div>
          </div>
          <p className="bubble" id="bubble" aria-live="polite">Hi.</p>

          <div className="read">
            <div className="read-head"><span>Reading you</span><b id="read-num">0%</b></div>
            <div className="read-bar"><i id="read-fill"></i></div>
            <span className="read-note" id="read-note">It has not seen you kick yet.</span>
          </div>

          <div className="keys-hint" id="keys-hint">Pick a spot: <kbd>Q</kbd> <kbd>W</kbd> <kbd>E</kbd> top, <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> low. <kbd>Space</kbd> strikes.</div>
          <button type="button" className="pill" id="btn-new">New shootout (N)</button>
          <p className="best" id="best"></p>
        </aside>
      </main>
    </>
  );
}
