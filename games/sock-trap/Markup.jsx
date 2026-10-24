/* Sock Trap: the page structure. game.js fills it in once it mounts. */
export default function Markup() {
  return (
    <>
      <header id="bar"></header>

      <main className="office">
        <section className="floor-wrap" aria-label="The office floor">
          <div className="board-frame">
            <svg id="board" role="img" aria-label="Office floor plan. Click the floor to place your items."></svg>
            <div className="hover-tip" id="hover-tip" hidden></div>
          </div>
          <p className="floor-hint" id="floor-hint"></p>
        </section>

        <aside className="panel" aria-label="Controls">
          <div className="who">
            <div className="who-face" id="face"></div>
            <div className="who-text">
              <span className="who-name" id="bot-name">Pip</span>
              <span className="who-rank" id="bot-rank">Rookie vacuum</span>
            </div>
          </div>
          <p className="bubble" id="bubble" aria-live="polite">Hi.</p>
          <div className="rounds" id="rounds" aria-label="Offices in this match"></div>

          <div className="meters">
            <div className="meter">
              <div className="meter-head"><span>Floor still dirty</span><b id="dirty-num">100%</b></div>
              <div className="meter-bar dirt"><i id="dirty-fill"></i><span className="goal" id="dirty-goal"></span></div>
              <span className="meter-note" id="dirty-note">Keep at least 40% dirty.</span>
            </div>
            <div className="meter">
              <div className="meter-head"><span>Robot battery</span><b id="bat-num">100%</b></div>
              <div className="meter-bar bat"><i id="bat-fill"></i></div>
              <span className="meter-note" id="bat-note"></span>
            </div>
          </div>

          <div className="tray" role="toolbar" aria-label="Your items" id="tray"></div>

          <div className="acts">
            <button type="button" className="go" id="btn-go">Let it loose! <kbd>Enter</kbd></button>
            <div className="acts-row">
              <button type="button" className="pill" id="btn-speed">Speed: normal (F)</button>
              <button type="button" className="pill" id="btn-pause">Pause (P)</button>
              <button type="button" className="pill" id="btn-reset">Clear items (R)</button>
            </div>
          </div>
          <p className="best" id="best"></p>
        </aside>
      </main>
    </>
  );
}
