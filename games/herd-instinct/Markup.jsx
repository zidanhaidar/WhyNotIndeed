/* Herd Instinct: the page structure. game.js fills it in once it mounts. */
export default function Markup() {
  return (
    <>
      <header id="bar"></header>

      <main className="farm">
        <section className="field-wrap" aria-label="The field">
          <div className="hud">
            <div className="hud-item"><span className="lbl">Time left</span><b id="time">2:00</b></div>
            <div className="hud-item"><span className="lbl">In the pen</span><b><span id="penned">0</span> <small>of <span id="need">6</span></small></b></div>
            <div className="hud-item" id="lost-box" hidden><span className="lbl">Taken by the wolf</span><b id="lost">0</b></div>
            <div className="hud-item bark-box"><span className="lbl">Bark (Space)</span><span className="bark-meter"><i id="bark-fill"></i></span></div>
          </div>
          <div className="field">
            <canvas id="field" aria-label="A field with sheep, your sheepdog and a pen on the right. Move the pointer to steer the dog."></canvas>
            <div className="start-card" id="start-card">
              <h2>Round them up!</h2>
              <p id="start-text"></p>
              <button type="button" className="go" id="btn-start">Start herding <kbd>Enter</kbd></button>
            </div>
            <div className="flash" id="flash" hidden></div>
          </div>
          <div className="touch-row">
            <button type="button" className="pill" id="btn-sneak" aria-pressed="false">Sneak (Shift)</button>
            <button type="button" className="pill bark-btn" id="btn-bark">Bark (Space)</button>
            <button type="button" className="pill" id="btn-pause">Pause (P)</button>
          </div>
        </section>

        <aside className="panel" aria-label="The flock">
          <div className="who">
            <div className="who-face" id="face"></div>
            <div>
              <span className="who-name" id="bot-name">Pip</span>
              <span className="who-rank" id="bot-rank">Rookie lead sheep</span>
            </div>
          </div>
          <p className="bubble" id="bubble" aria-live="polite">Baa.</p>
          <ul className="tips" id="tips"></ul>
          <button type="button" className="pill" id="btn-new">New field (N)</button>
          <p className="best" id="best"></p>
        </aside>
      </main>
    </>
  );
}
