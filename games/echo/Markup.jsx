/* Echo: the page structure. game.js fills it in once it mounts. */
export default function Markup() {
  return (
    <>
      <header id="bar"></header>

      <main className="cave">
        <section className="sonar" aria-label="The dark maze">
          <div className="screen">
            <canvas id="maze" aria-label="A dark maze. You only see walls your pings and bumps reveal."></canvas>
            <div className="cue" id="cue" hidden></div>
          </div>
          <div className="controls">
            <div className="pad" aria-label="Move">
              <button type="button" className="pad-btn" data-dir="up" aria-label="Up">&#9650;</button>
              <button type="button" className="pad-btn" data-dir="left" aria-label="Left">&#9664;</button>
              <button type="button" className="pad-btn" data-dir="right" aria-label="Right">&#9654;</button>
              <button type="button" className="pad-btn" data-dir="down" aria-label="Down">&#9660;</button>
            </div>
            <button type="button" className="ping-btn" id="btn-ping">Ping <kbd>Space</kbd></button>
          </div>
        </section>

        <aside className="panel" aria-label="Status">
          <div className="who">
            <div className="who-face" id="face"></div>
            <div>
              <span className="who-name" id="bot-name">Pip</span>
              <span className="who-rank" id="bot-rank">Rookie maze keeper</span>
            </div>
          </div>
          <p className="bubble" id="bubble" aria-live="polite">Hi.</p>

          <div className="stats">
            <div className="stat">
              <div className="stat-head"><span>Steps left</span><b id="steps">0</b></div>
              <div className="stat-bar"><i id="steps-fill"></i></div>
            </div>
            <div className="stat">
              <div className="stat-head"><span>Pings left</span><b id="pings">0</b></div>
              <div className="dots" id="ping-dots"></div>
            </div>
            <div className="stat">
              <div className="stat-head"><span>Keycards</span><b id="keys">0 of 3</b></div>
              <div className="keycards" id="keycards"></div>
            </div>
          </div>

          <ul className="tips" id="tips"></ul>
          <div className="acts">
            <button type="button" className="pill" id="btn-new">New maze (N)</button>
          </div>
          <p className="best" id="best"></p>
        </aside>
      </main>
    </>
  );
}
