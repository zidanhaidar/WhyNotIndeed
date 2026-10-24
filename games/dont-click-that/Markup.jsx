/* Don't Click That: the page structure. game.js fills it in once it mounts. */
export default function Markup() {
  return (
    <>
      <header id="bar"></header>

      <main className="computer">
        <section className="stage" aria-label="The office computer">
          <div className="monitor">
            <div className="screen">
              <canvas id="desktop" aria-label="A computer desktop. A robot's mouse pointer is heading for the red Delete everything button. Drag the windows into its way."></canvas>
              <div className="cue" id="cue" hidden></div>
              <div className="start-card" id="start-card">
                <h2>Don't let it click!</h2>
                <p>A robot has taken over the mouse and wants the big red button. Drag the open windows into its way. It has to go around them, or stop to close one.</p>
                <button type="button" className="go" id="btn-start">Start (Enter)</button>
              </div>
            </div>
            <div className="monitor-foot" aria-hidden="true"><span className="led"></span><span>WNI 3000</span></div>
          </div>
        </section>

        <aside className="panel" aria-label="This run">
          <div className="who">
            <div className="who-face" id="face"></div>
            <div>
              <span className="who-name" id="bot-name">Pip</span>
              <span className="who-rank" id="bot-rank">Rookie pointer</span>
            </div>
          </div>
          <p className="bubble" id="bubble" aria-live="polite">Hi.</p>

          <div className="score">
            <div className="count"><span>Time survived</span><b id="time">0:00</b></div>
            <div className="count files"><span>Files left</span><b id="files">6</b></div>
          </div>
          <div className="backup">
            <div className="backup-head"><span>Next backup</span><b id="backup">30s</b></div>
            <div className="backup-bar"><i id="backup-fill"></i></div>
            <p id="backup-note">Every backup pays 100 points per file still on the desktop.</p>
          </div>

          <ul className="tips" id="tips"></ul>
          <div className="acts">
            <button type="button" className="pill" id="btn-pause">Pause (P)</button>
            <button type="button" className="pill" id="btn-new">New run (N)</button>
          </div>
          <p className="best" id="best"></p>
        </aside>
      </main>
    </>
  );
}
