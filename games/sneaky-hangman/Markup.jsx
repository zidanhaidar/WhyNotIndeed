/* Sneaky Hangman: the page structure. game.js fills it in once it mounts. */
export default function Markup() {
  return (
    <>
      <header id="bar"></header>

      <main className="game">
        <section className="sky" aria-label="The robot and its balloons">
          <svg id="stage" viewBox="0 0 420 400" role="img" aria-label="The robot hangs from balloons. Each wrong guess pops one."></svg>
          <div className="tiles" id="tiles" aria-label="Your word as the robot sees it"></div>
          <p className="missed" id="missed"></p>
          <p className="source" id="source"></p>
        </section>

        <aside className="panel" aria-label="Your answers">
          <div className="who">
            <div className="who-face" id="face"></div>
            <div>
              <span className="who-name" id="bot-name">Pip</span>
              <span className="who-rank" id="bot-rank">Rookie guesser</span>
            </div>
            <div className="guess-card" id="guess-card" aria-live="polite"><span>?</span></div>
          </div>
          <p className="bubble" id="bubble" aria-live="polite">Hi.</p>

          <div className="answers">
            <h2 id="ask">How do you answer?</h2>
            <div className="opts" id="opts"></div>
          </div>

          <div className="secret">
            <div className="secret-head"><span>Your secret word right now</span><button type="button" className="link" id="btn-peek">See other words</button></div>
            <div className="secret-word" id="secret-word"></div>
            <p className="secret-note" id="secret-note"></p>
            <div className="peek" id="peek" hidden></div>
          </div>

          <div className="foot-row">
            <button type="button" className="pill" id="btn-new">New word (N)</button>
            <p className="best" id="best"></p>
          </div>
        </aside>
      </main>
    </>
  );
}
