/* Badge Check: the page structure. game.js fills it in once it mounts.
   The left side is the turnstile (who you are up against, the visitor, your calls); the right side is a clipboard
   with everything you check against. Both fit on one laptop screen, so nothing needs scrolling while you play. */
export default function Markup() {
  return (
    <>
      <header id="bar"></header>

      <main className="lobbydesk">
        <section className="stage" aria-label="The turnstile">
          <div className="status">
            <div className="who">
              <div className="who-face" id="face"></div>
              <div>
                <span className="who-name" id="bot-name">Pip</span>
                <span className="who-rank" id="bot-rank">Rookie forger</span>
              </div>
            </div>
            <p className="bubble" id="bubble" aria-live="polite">Hi.</p>
            <div className="tally">
              <div className="count"><span>Correct</span><b id="correct">0</b><small id="streak"></small></div>
              <div className="count strikes-box"><span>Mistakes</span><div className="strike-row" id="strikes"></div></div>
            </div>
          </div>

          <div className="desk-scene">
            <div className="timer" aria-hidden="true"><i id="timer-fill"></i></div>
            <div className="queue" id="queue" aria-hidden="true"></div>
            <div className="meet">
              <div className="person" id="person" aria-label="The visitor"></div>
              <div className="badge" id="badge" aria-label="Their badge"></div>
            </div>
            <div className="cue" id="cue" hidden></div>
            <div className="start-card" id="start-card">
              <h2>Your shift starts now</h2>
              <p>Check every badge against the clipboard: the staff directory, the floors, today's date and this week's stamp. Let the real coworkers in. Stop the fakes.</p>
              <button type="button" className="go" id="btn-start">Open the turnstile (Enter)</button>
            </div>
          </div>
          <div className="calls">
            <button type="button" className="call stop" id="btn-stop">Stop <kbd>&larr;</kbd></button>
            <button type="button" className="call let" id="btn-let">Let in <kbd>&rarr;</kbd></button>
          </div>
        </section>

        <aside className="panel clipboard" aria-label="Your clipboard">
          <div className="clip" aria-hidden="true"></div>
          <div className="today">
            <div><span id="today-day">Today</span><b id="today">-</b></div>
            <div><span>Stamp of the week</span><b id="stamp"></b></div>
          </div>
          <div className="ref">
            <h3>Floors</h3>
            <div className="floors" id="floors"></div>
          </div>
          <div className="ref">
            <h3>Staff directory</h3>
            <div className="directory" id="directory"></div>
          </div>
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
