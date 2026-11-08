/* Level Crossing: the page structure. game.js fills it in once it mounts. The railway fills the screen. */
export default function Markup() {
  return (
    <>
      <header id="bar"></header>

      <main className="yard">
        <div className="viewport" id="viewport">
          <section className="stage" id="stage" aria-label="The railway">
            <canvas id="map" aria-label="A railway map seen from above: tracks with switches, colored stations, roads with level crossings, your trains and the traffic. Click a train to go or brake, a yellow arrow to flip a switch, a round sign to lower or raise a crossing."></canvas>
            <div className="banner" id="banner" hidden></div>
            <div className="veil" id="veil" hidden><b>Paused</b><span>Press P to carry on</span></div>
            <div className="start-card" id="start-card">
              <h2>All aboard?</h2>
              <p>Passengers wear the color of the station they want. Drive your trains, flip the switches and work the barriers. Mind the cars!</p>
              <button type="button" className="go" id="btn-start">Open the line (Enter)</button>
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
              <div className="count"><span>Delivered</span><b id="delivered">0</b></div>
              <div className="count time"><span>Shift</span><b id="time">0:00</b></div>
            </div>
            <div className="by-color" id="by-color" aria-label="Passengers delivered by color"></div>
            <div className="strikes">
              <span>Complaints</span>
              <div className="strike-row" id="strikes"></div>
            </div>
            <div className="mission" id="mission" aria-live="polite"></div>

            <div className="trains" id="trains" aria-label="Your trains"></div>
            <div className="acts">
              <button type="button" className="pill" id="btn-pause">Pause (P)</button>
              <button type="button" className="pill" id="btn-new">New map (N)</button>
              <button type="button" className="pill" id="btn-horn">Horn (H)</button>
              <button type="button" className="pill" id="btn-full">Full screen (F)</button>
            </div>
            <p className="best" id="best"></p>
          </aside>
        </div>
      </main>
    </>
  );
}
