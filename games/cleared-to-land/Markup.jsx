/* Cleared to Land: the page structure. game.js fills it in once it mounts. The airport fills the screen. */
export default function Markup() {
  return (
    <>
      <header id="bar"></header>

      <main className="yard">
        <div className="viewport" id="viewport">
          <section className="stage" id="stage" aria-label="The airport">
            <canvas id="map" aria-label="An airport seen from above: a runway, a taxiway, a terminal with colored gates, and planes circling, landing, taxiing and taking off. Click a circling plane to clear it to land, a ready plane to push it back, and a plane at the runway to take off."></canvas>
            <div className="banner" id="banner" hidden></div>
            <div className="veil" id="veil" hidden><b>Paused</b><span>Press P to carry on</span></div>
            <div className="start-card" id="start-card">
              <h2>Tower open?</h2>
              <p>Planes circle until you clear them to land. They park at a gate of their tail color, then wait for you to send them off. One plane on the runway at a time!</p>
              <button type="button" className="go" id="btn-start">Open the tower (Enter)</button>
            </div>
          </section>

          <aside className="panel" id="panel" aria-label="Your shift">
            <div className="who">
              <div className="who-face" id="face"></div>
              <div>
                <span className="who-name" id="bot-name">Pip</span>
                <span className="who-rank" id="bot-rank">Rookie sky boss</span>
              </div>
            </div>
            <p className="bubble" id="bubble" aria-live="polite">Hi.</p>

            <div className="score">
              <div className="count"><span>Passengers</span><b id="delivered">0</b></div>
              <div className="count time"><span>Shift</span><b id="time">0:00</b></div>
            </div>
            <div className="by-color" id="by-color" aria-label="Passengers landed by color"></div>
            <div className="strikes">
              <span>Complaints</span>
              <div className="strike-row" id="strikes"></div>
            </div>
            <div className="mission" id="mission" aria-live="polite"></div>

            <div className="queue">
              <div><span>Circling</span><b id="q-hold">0</b></div>
              <div><span>Ready at gates</span><b id="q-ready">0</b></div>
              <div><span>At the runway</span><b id="q-line">0</b></div>
            </div>
            <div className="acts tower">
              <button type="button" className="pill" id="btn-land">Land next (L)</button>
              <button type="button" className="pill" id="btn-ga">Go around (G)</button>
              <button type="button" className="pill" id="btn-push">Push back (D)</button>
              <button type="button" className="pill" id="btn-to">Take off (T)</button>
              <button type="button" className="pill wide" id="btn-light" hidden>Runway light: green (R)</button>
            </div>
            <div className="acts">
              <button type="button" className="pill" id="btn-pause">Pause (P)</button>
              <button type="button" className="pill" id="btn-new">New airport (N)</button>
              <button type="button" className="pill wide" id="btn-full">Full screen (F)</button>
            </div>
            <p className="best" id="best"></p>
          </aside>
        </div>
      </main>
    </>
  );
}
