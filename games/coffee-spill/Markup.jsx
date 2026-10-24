/* Coffee Spill: the page structure. game.js fills it in once it mounts. */
export default function Markup() {
  return (
    <>
      <header id="bar"></header>

      <main className="cafe">
        <section className="desk-wrap" aria-label="The desk">
          <div className="desk">
            <div className="rail" id="rail" aria-hidden="true"><div className="pot" id="pot"></div><div className="aim" id="aim"></div></div>
            <canvas id="desk" aria-label="A desk with a laptop and two mugs. Draw walls with your pen to steer the coffee."></canvas>
            <div className="countdown" id="countdown" hidden>
              <span className="cd-label">The pot tips in</span>
              <b id="cd-num">20</b>
              <button type="button" className="go" id="btn-pour">Pour now <kbd>Enter</kbd></button>
            </div>
            <div className="flash" id="flash" hidden></div>
          </div>
          <div className="pens" role="toolbar" aria-label="Pen">
            <button type="button" className="pen" data-tool="ink" aria-pressed="true"><span className="sw sw-ink"></span>Pen <kbd>1</kbd></button>
            <button type="button" className="pen" data-tool="erase" aria-pressed="false"><span className="sw sw-erase"></span>Eraser <kbd>2</kbd></button>
            <button type="button" className="pen" id="btn-clear">Clear ink <kbd>R</kbd></button>
            <span className="pens-hint">Right-click also erases.</span>
          </div>
        </section>

        <aside className="panel" aria-label="Status">
          <div className="who">
            <div className="who-face" id="face"></div>
            <div>
              <span className="who-name" id="bot-name">Pip</span>
              <span className="who-rank" id="bot-rank">Rookie pourer</span>
            </div>
          </div>
          <p className="bubble" id="bubble" aria-live="polite">Hi.</p>

          <div className="meters">
            <div className="meter"><div className="meter-head"><span>Ink left</span><b id="ink-num">300</b></div><div className="meter-bar ink"><i id="ink-fill"></i></div></div>
            <div className="meter"><div className="meter-head"><span>Laptop</span><b id="lap-num">OK</b></div><div className="meter-bar lap"><i id="lap-fill"></i></div></div>
            <div className="meter"><div className="meter-head"><span>Caught in mugs</span><b id="mug-num">0</b></div><div className="meter-bar mug"><i id="mug-fill"></i><span className="tick" id="tick2"></span><span className="tick" id="tick3"></span></div></div>
            <div className="meter"><div className="meter-head"><span>Coffee in the pot</span><b id="pot-num">100%</b></div><div className="meter-bar potm"><i id="pot-fill"></i></div></div>
          </div>

          <div className="acts">
            <button type="button" className="pill" id="btn-pause">Pause (P)</button>
            <button type="button" className="pill" id="btn-new">New desk (N)</button>
          </div>
          <p className="best" id="best"></p>
        </aside>
      </main>
    </>
  );
}
