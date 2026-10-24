/* Excel Dungeon: the page structure. game.js fills it in once it mounts. */
export default function Markup() {
  return (
    <>
      <header id="bar"></header>

      <main className="dungeon">
        <section className="hud" aria-label="Your stats">
          <div className="stat hpstat">
            <span className="ic" id="ic-heart"></span>
            <div className="bar-wrap"><span className="lbl">Health</span><div className="hp-bar"><i id="hp-fill"></i><span id="hp-text">30 / 30</span></div></div>
          </div>
          <div className="stat"><span className="ic" id="ic-atk"></span><span><b id="atk">4</b><span className="lbl">Attack</span></span></div>
          <div className="stat"><span className="ic" id="ic-def"></span><span><b id="def">0</b><span className="lbl">Defense</span></span></div>
          <div className="stat lvl">
            <span className="badge" id="lvl">1</span>
            <div className="bar-wrap"><span className="lbl">Level, <span id="xp-text">0 / 14 XP</span></span><div className="xp-bar"><i id="xp-fill"></i></div></div>
          </div>
          <div className="stat"><span className="ic" id="ic-coffee"></span><span><b id="coffee">1</b><span className="lbl">Coffee</span></span>
            <button type="button" className="btn small" id="btn-drink">Drink (Q)</button></div>
          <div className="stat"><span className="ic" id="ic-cash"></span><span><b id="cash">$0</b><span className="lbl">Found</span></span></div>
          <div className="stat where"><span><b id="cell">G6</b><span className="lbl">Your cell</span></span></div>
        </section>

        <section className="play" aria-label="Dungeon">
          <nav className="tabs" id="tabs" aria-label="Sheets"></nav>
          <div className="view" id="view">
            <div className="map" id="map">
              <div className="tiles" id="tiles"></div>
              <div className="ents" id="ents"></div>
            </div>
            <div className="note" id="note" hidden></div>
          </div>
        </section>

        <aside className="side" aria-label="Info">
          <div className="who" id="who" aria-live="polite"></div>
          <div className="log-card">
            <h3>What happened</h3>
            <ol className="log" id="log"></ol>
          </div>
          <div className="pad" aria-label="Move">
            <button type="button" className="pb up" data-d="0" aria-label="Move up">&#9650;</button>
            <button type="button" className="pb left" data-d="3" aria-label="Move left">&#9664;</button>
            <button type="button" className="pb wait" data-d="wait" aria-label="Wait a turn">Wait</button>
            <button type="button" className="pb right" data-d="1" aria-label="Move right">&#9654;</button>
            <button type="button" className="pb down" data-d="2" aria-label="Move down">&#9660;</button>
          </div>
          <button type="button" className="btn ghost" id="btn-new">New dungeon (N)</button>
        </aside>
      </main>
    </>
  );
}
