/* Harbor Master: the page structure. game.js fills it in once it mounts. The harbor fills the screen. */
export default function Markup() {
  return (
    <>
      <header id="bar"></header>

      <main className="yard">
        <div className="viewport" id="viewport">
          <section className="stage" id="stage" aria-label="The harbor">
            <canvas id="map" aria-label="A harbor seen from above: coasts and islands, docks with colored crates, a drawbridge, robot boats and your cargo ship with a dotted forecast of where it will go. Steer with the helm buttons or the keys."></canvas>
            <div className="banner" id="banner" hidden></div>
            <div className="veil" id="veil" hidden><b>Paused</b><span>Press P to carry on</span></div>
            <div className="start-card" id="start-card">
              <h2>Ready to sail?</h2>
              <p>Take the colored crates to the dock of their color. Your ship turns and stops slowly, so follow the forecast line and slow down early.</p>
              <button type="button" className="go" id="btn-start">Cast off (Enter)</button>
            </div>
          </section>

          <aside className="panel" id="panel" aria-label="Your shift">
            <div className="who">
              <div className="who-face" id="face"></div>
              <div>
                <span className="who-name" id="bot-name">Pip</span>
                <span className="who-rank" id="bot-rank">Rookie harbor boss</span>
              </div>
            </div>
            <p className="bubble" id="bubble" aria-live="polite">Hi.</p>

            <div className="score">
              <div className="count"><span>Crates</span><b id="delivered">0</b></div>
              <div className="count time"><span>Shift</span><b id="time">0:00</b></div>
            </div>
            <div className="by-color" id="by-color" aria-label="Crates delivered by color"></div>
            <div className="strikes">
              <span>Complaints</span>
              <div className="strike-row" id="strikes"></div>
            </div>
            <div className="mission" id="mission" aria-live="polite"></div>

            <div className="helm" aria-label="The helm">
              <div className="gauge" aria-hidden="true"><i id="rudder-needle"></i></div>
              <span className="helm-text" id="rudder-text">Rudder centred</span>
              <div className="helm-row">
                <button type="button" className="pill" id="btn-port">◀ Port (A)</button>
                <button type="button" className="pill" id="btn-center">Centre (C)</button>
                <button type="button" className="pill" id="btn-star">Starboard (D) ▶</button>
              </div>
              <div className="tele" aria-hidden="true"><i>Full astern</i><i>Half astern</i><i>Stop</i><i>Half ahead</i><i>Full ahead</i></div>
              <span className="helm-text" id="tele-text">Stop</span>
              <div className="helm-row">
                <button type="button" className="pill" id="btn-astern">▼ Astern (S)</button>
                <button type="button" className="pill" id="btn-stop">Stop (Space)</button>
                <button type="button" className="pill" id="btn-ahead">▲ Ahead (W)</button>
              </div>
              <div className="cargo" id="cargo" aria-label="Cargo on board"></div>
            </div>
            <div className="acts">
              <button type="button" className="pill wide" id="btn-bridge" hidden>Raise the bridge (R)</button>
              <button type="button" className="pill" id="btn-horn">Horn (H)</button>
              <button type="button" className="pill" id="btn-pause">Pause (P)</button>
              <button type="button" className="pill" id="btn-new">New harbor (N)</button>
              <button type="button" className="pill" id="btn-full">Full screen (F)</button>
            </div>
            <p className="best" id="best"></p>
          </aside>
        </div>
      </main>
    </>
  );
}
