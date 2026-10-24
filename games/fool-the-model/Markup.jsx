/* Fool the Model: the page structure. game.js fills it in once it mounts. */
export default function Markup() {
  return (
    <>
      <header id="bar"></header>

      <main className="office">
        <section className="envelope" aria-label="The letter">
          <div className="env-inner">
            <div className="env-top">
              <div className="slip">
                <span className="slip-label">Written digit</span>
                <span className="slip-value" id="true-digit">5</span>
              </div>
              <div className="slip slip-route">
                <span className="slip-label" id="route-label">Route it to</span>
                <span className="slip-value" id="target-digit">3</span>
              </div>
              <div className="postmark" id="postmark" aria-hidden="true">
                <span id="postmark-round">Letter 1 of 5</span>
              </div>
            </div>

            <div className="paper-wrap">
              <div className="grid" id="grid" role="grid" aria-label="8 by 8 handwritten digit. Click or drag to change pixels."></div>
              <div className="side">
                <div className="human">
                  <span className="small-label">How a person sees it</span>
                  <div className="human-pair">
                    <figure><canvas id="thumb-orig" width="8" height="8"></canvas><figcaption>Before</figcaption></figure>
                    <figure><canvas id="thumb-now" width="8" height="8"></canvas><figcaption>Now</figcaption></figure>
                  </div>
                </div>
                <div className="budget">
                  <span className="small-label">Pixels changed</span>
                  <span className="budget-num"><b id="used">0</b> of <span id="budget">8</span></span>
                  <div className="budget-cells" id="budget-cells"></div>
                </div>
                <div className="side-acts">
                  <button type="button" className="act" id="btn-undo">Undo <kbd>Z</kbd></button>
                  <button type="button" className="act" id="btn-reset">Start over</button>
                  <button type="button" className="act act-hint" id="btn-hint" aria-pressed="false">Hint <kbd>H</kbd></button>
                </div>
              </div>
            </div>

            <div className="tools" role="toolbar" aria-label="Pen">
              <button type="button" className="tool" data-tool="16" aria-pressed="true"><span className="sw sw-ink"></span>Ink <kbd>1</kbd></button>
              <button type="button" className="tool" data-tool="8" aria-pressed="false"><span className="sw sw-gray"></span>Smudge <kbd>2</kbd></button>
              <button type="button" className="tool" data-tool="0" aria-pressed="false"><span className="sw sw-erase"></span>Erase <kbd>3</kbd></button>
              <button type="button" className="tool" data-tool="orig" aria-pressed="false"><span className="sw sw-orig"></span>Restore <kbd>4</kbd></button>
            </div>
          </div>
        </section>

        <section className="machine" aria-label="The sorting machine">
          <div className="machine-head">
            <div className="stamp" id="stamp"></div>
            <div className="operator">
              <span className="op-name" id="op-name">Pip</span>
              <span className="op-model" id="op-model">Plain linear model</span>
              <p className="bubble" id="bubble" aria-live="polite"></p>
            </div>
          </div>

          <div className="reading">
            <span className="small-label">Machine reads</span>
            <span className="reading-val"><b id="read-digit">5</b> <small id="read-conf">98% sure</small></span>
          </div>

          <div className="bins" id="bins" aria-label="Confidence for each digit"></div>
          <p className="rule" id="rule"></p>

          <div className="status" id="status" aria-live="polite"></div>

          <div className="rounds" id="rounds" aria-label="Letters this run"></div>
          <div className="machine-btns">
            <button type="button" className="big" id="btn-next" disabled>Next letter</button>
            <button type="button" className="quiet" id="btn-skip">Skip this letter</button>
          </div>
        </section>
      </main>
    </>
  );
}
