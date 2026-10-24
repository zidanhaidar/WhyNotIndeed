/* Copycat: the page structure. game.js fills it in once it mounts. */
export default function Markup() {
  return (
    <>
      <header id="bar"></header>

      <main className="disco">
        <section className="stage" aria-label="The dance floor">
          <div className="floor-frame">
            <svg id="floor" role="img" aria-label="An 8 by 8 dance floor. Arrow keys move your dancer."></svg>
            <div className="cue" id="cue" hidden></div>
          </div>
          <div className="tape" aria-label="Moves">
            <div className="tape-row"><span className="tape-label">Your last moves</span><span className="tape-cards" id="tape-you"></span></div>
            <div className="tape-row"><span className="tape-label" id="tape-bot-label">It repeats next</span><span className="tape-cards" id="tape-bot"></span></div>
          </div>
          <div className="pad" aria-label="Dance moves">
            <button type="button" className="pad-btn" data-move="up" aria-label="Up">&#9650;</button>
            <button type="button" className="pad-btn" data-move="left" aria-label="Left">&#9664;</button>
            <button type="button" className="pad-btn stay" data-move="stay" aria-label="Stay put">Stay</button>
            <button type="button" className="pad-btn" data-move="right" aria-label="Right">&#9654;</button>
            <button type="button" className="pad-btn" data-move="down" aria-label="Down">&#9660;</button>
          </div>
        </section>

        <aside className="panel" aria-label="Score">
          <div className="who">
            <div className="who-face" id="face"></div>
            <div>
              <span className="who-name" id="bot-name">Pip</span>
              <span className="who-rank" id="bot-rank">Rookie copycat</span>
            </div>
          </div>
          <p className="bubble" id="bubble" aria-live="polite">Hi.</p>

          <div className="score">
            <div className="score-side you"><span>You</span><b id="tiles-you">1</b></div>
            <div className="score-vs">tiles</div>
            <div className="score-side bot"><span id="bot-short">Pip</span><b id="tiles-bot">1</b></div>
          </div>
          <div className="share" aria-hidden="true"><i id="share-you"></i><i id="share-bot"></i></div>

          <div className="beats">
            <div className="beats-head"><span>Beats left in the song</span><b id="beats-left">32</b></div>
            <div className="beats-bar"><i id="beats-fill"></i></div>
            <p className="skips" id="skips"></p>
          </div>

          <ul className="tips" id="tips"></ul>
          <div className="acts">
            <button type="button" className="pill" id="btn-new">New dance (N)</button>
          </div>
          <p className="best" id="best"></p>
        </aside>
      </main>
    </>
  );
}
