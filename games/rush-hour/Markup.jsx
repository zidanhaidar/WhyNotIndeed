/* Rush Hour: the page structure. game.js fills it in once it mounts. The town fills the screen. */
export default function Markup() {
  return (
    <>
      <header id="bar"></header>

      <main className="yard">
        <div className="viewport" id="viewport">
          <section className="stage" id="stage" aria-label="The town">
            <canvas id="map" aria-label="A town seen from above: streets with junctions and zebra crossings, blocks of buildings and parks, cars heading for the colored sides of town and walkers waiting to cross. Click the round button in a junction to switch its lights, and a zebra crossing's signal to give walkers the green man."></canvas>
            <div className="banner" id="banner" hidden></div>
            <div className="veil" id="veil" hidden><b>Paused</b><span>Press P to carry on</span></div>
            <div className="start-card" id="start-card">
              <h2>Rush hour!</h2>
              <p>Switch the lights so every car gets to the side of town on its roof, and give the walkers their green man before they lose patience.</p>
              <button type="button" className="go" id="btn-start">Start the traffic (Enter)</button>
            </div>
          </section>

          <aside className="panel" id="panel" aria-label="Your shift">
            <div className="who">
              <div className="who-face" id="face"></div>
              <div>
                <span className="who-name" id="bot-name">Pip</span>
                <span className="who-rank" id="bot-rank">Rookie traffic boss</span>
              </div>
            </div>
            <p className="bubble" id="bubble" aria-live="polite">Hi.</p>

            <div className="score">
              <div className="count"><span>Trips</span><b id="delivered">0</b></div>
              <div className="count time"><span>Shift</span><b id="time">0:00</b></div>
            </div>
            <div className="by-color" id="by-color" aria-label="Cars home by side of town, and walkers across"></div>
            <div className="strikes">
              <span>Complaints</span>
              <div className="strike-row" id="strikes"></div>
            </div>
            <div className="mission" id="mission" aria-live="polite"></div>

            <div className="queue">
              <div><span>Cars in town</span><b id="q-cars">0</b></div>
              <div><span>Walkers waiting</span><b id="q-walk">0</b></div>
              <div><span>Queueing to get in</span><b id="q-out">0</b></div>
            </div>
            <div className="acts">
              <button type="button" className="pill" id="btn-pause">Pause (P)</button>
              <button type="button" className="pill" id="btn-new">New town (N)</button>
              <button type="button" className="pill wide" id="btn-full">Full screen (F)</button>
            </div>
            <p className="best" id="best"></p>
          </aside>
        </div>
      </main>
    </>
  );
}
