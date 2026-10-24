/* Cable Spaghetti: the page structure. game.js fills it in once it mounts. */
export default function Markup() {
  return (
    <>
      <header id="bar"></header>

      <main className="trattoria">
        <section className="stage" aria-label="The desk">
          <div className="desk-frame">
            <svg id="desk" role="img" aria-label="The desk seen from above, with devices, sockets and cables. Drag from the new device to a free socket of its kind."></svg>
            <div className="cue" id="cue" hidden></div>
          </div>
          <p className="now" id="now" aria-live="polite"></p>
        </section>

        <aside className="panel" aria-label="Score">
          <div className="who">
            <div className="who-face" id="face"></div>
            <div>
              <span className="who-name" id="bot-name">Pip</span>
              <span className="who-rank" id="bot-rank">Rookie IT robot</span>
            </div>
          </div>
          <p className="bubble" id="bubble" aria-live="polite">Hi.</p>

          <div className="score">
            <div className="count"><span>Plugged in</span><b id="plugged">0</b></div>
            <div className="count neat"><span>Neat cables</span><b id="neat">0</b></div>
          </div>
          <div className="sockets">
            <span>Free sockets</span>
            <span className="sock power"><i aria-hidden="true"></i><b id="sock-power">0</b> power</span>
            <span className="sock usb"><i aria-hidden="true"></i><b id="sock-usb">0</b> USB</span>
          </div>
          <div className="tools-row">
            <button type="button" className="pill tool" id="btn-cut" aria-pressed="false">Scissors (C): <b id="scissors">3</b></button>
            <button type="button" className="pill" id="btn-undo">Undo step</button>
          </div>

          <ul className="tips" id="tips"></ul>
          <div className="acts">
            <button type="button" className="pill" id="btn-stop">Call it a day</button>
            <button type="button" className="pill" id="btn-new">New desk (N)</button>
          </div>
          <p className="best" id="best"></p>
        </aside>
      </main>
    </>
  );
}
