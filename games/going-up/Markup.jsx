/* Going Up: the page structure. game.js fills it in once it mounts. */
export default function Markup() {
  return (
    <>
      <header id="bar"></header>

      <main className="tower">
        <section className="stage" aria-label="The building">
          <div className="tower-frame">
            <canvas id="building" aria-label="A cutaway of the office tower: your elevator on the left, the robot elevator on the right, and people waiting on every floor. Pick floors to stop at."></canvas>
            <div className="banner" id="banner" hidden></div>
            <div className="start-card" id="start-card">
              <h2>Ready for your shift?</h2>
              <p>People will press the button on every floor. Pick the floors your elevator stops at and get them where they are going.</p>
              <button type="button" className="go" id="btn-start">Start the shift (Enter)</button>
            </div>
          </div>
          <div className="lift-panel" aria-label="Floor buttons">
            <span className="lift-head">Floors</span>
            <div className="lift-btns" id="lift-btns"></div>
          </div>
        </section>

        <aside className="panel" aria-label="Shift">
          <div className="who">
            <div className="who-face" id="face"></div>
            <div>
              <span className="who-name" id="bot-name">Pip</span>
              <span className="who-rank" id="bot-rank">Rookie lift</span>
            </div>
          </div>
          <p className="bubble" id="bubble" aria-live="polite">Hi.</p>

          <div className="score">
            <div className="count"><span>Riders delivered</span><b id="riders">0</b></div>
            <div className="count quick"><span>Quick trips</span><b id="quick">0</b></div>
          </div>
          <div className="strikes">
            <span>Took the stairs</span>
            <div className="strike-row" id="strikes"></div>
          </div>
          <div className="clock">
            <div><span id="day">Day 1</span><b id="time">0:00</b></div>
            <p id="rush">Calm</p>
          </div>
          <p className="stops" id="stops">No stops picked yet.</p>
          <p className="rival" id="rival"></p>

          <ul className="tips" id="tips"></ul>
          <div className="acts">
            <button type="button" className="pill" id="btn-pause">Pause (P)</button>
            <button type="button" className="pill" id="btn-new">New shift (N)</button>
          </div>
          <p className="best" id="best"></p>
        </aside>
      </main>
    </>
  );
}
