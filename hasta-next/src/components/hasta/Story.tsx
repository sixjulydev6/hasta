/** All chapters (.ch, sticky copy over the stage) and flat sections (.sec, opaque). */
export const Story = () => (
  <main id="story">
    <section className="ch hero" id="top" data-tone="dark">
      <div className="pin">
        <h1 className="vh">Strength is solved. Hands aren’t.</h1>
        <div className="hero-foot">
          <p>Robots have lifted heavy things for decades. Picking up an egg without cracking it is still the hard part.</p>
          <a className="chipbtn cta" href="#hands"><span>Meet the hands</span><i aria-hidden="true">↓</i></a>
        </div>
      </div>
    </section>

    <section className="sec light statement" id="intro" data-tone="light">
      <div className="wrap">
        <h2 className="mega shimmer">Look. Hold.<br /><span className="shine">Hand over.</span></h2>
        <div className="tri">
          <p className="k">Hasta service robot</p>
          <div>
            <p>Hasta is a service robot designed from the fingertips back. It sees what it is about to touch, closes on it with less force than you would use, and passes it to a person the way a person would.</p>
            <p className="strong">Twenty motors in each hand. One job: get it there whole.</p>
          </div>
          <div><a className="btn" href="#hands">See the hands <span aria-hidden="true">↓</span></a></div>
        </div>
      </div>
    </section>

    <section className="ch" id="hands" data-tone="dark">
      <div className="pin">
        <div className="head">
          <p className="eyebrow">Hands</p>
          <h2>Every finger moves on its own.</h2>
          <p className="lede">Twenty motors in each hand, and a touch sensor under every pad.</p>
          <button className="link" id="fiveBtn" type="button">Tap for a high-five</button>
        </div>
      </div>
    </section>

    <section className="ch" id="vision" data-tone="dark">
      <div className="pin">
        <div className="head">
          <p className="eyebrow">Vision</p>
          <h2>First, it looks.</h2>
          <p className="lede">Before a finger moves, it knows what the egg is, how far away it sits and where each fingertip will go.</p>
        </div>
      </div>
    </section>

    <section className="ch" id="grip" data-tone="light">
      <div className="pin">
        <div className="head">
          <p className="eyebrow">Grip</p>
          <h2>Firm enough to lift. Gentle enough not to crack.</h2>
          <p className="lede">An egg cracks at about 45 newtons. Hasta holds it with less than one in each fingertip.</p>
        </div>
        <aside className="force glass" id="force" aria-label="Fingertip force, live">
          <header><span>Fingertip force</span><span>N</span></header>
          <div className="row"><span>Thumb</span><i><b></b></i><output>0.00</output></div>
          <div className="row"><span>Index</span><i><b></b></i><output>0.00</output></div>
          <div className="row"><span>Middle</span><i><b></b></i><output>0.00</output></div>
          <footer>Each bar ends at 45 N</footer>
        </aside>
      </div>
    </section>

    <section className="ch" id="touch" data-tone="light">
      <div className="pin">
        <div className="head">
          <p className="eyebrow">Touch</p>
          <h2>Its fingertips can feel.</h2>
          <p className="lede">Ribbed pads read pressure 1,000 times a second and catch a slip before it shows.</p>
        </div>
      </div>
    </section>

    <section className="ch" id="handover" data-tone="light">
      <div className="pin">
        <div className="head">
          <p className="eyebrow">Made for people</p>
          <h2>It hands things over the way a person would.</h2>
          <p className="lede">Slowly, palm up, at a height you can reach.</p>
        </div>
      </div>
    </section>

    <section className="ch" id="rounds" data-tone="light">
      <div className="pin">
        <div className="head">
          <p className="eyebrow">Hasta in hospitals and hotels</p>
          <h2>Built for the rounds nobody has time for.</h2>
          <p className="lede">Meals, medicines and linen, carried down the corridor, so your staff can stay with people.</p>
        </div>
      </div>
    </section>

    <section className="sec dark places" id="places" data-tone="dark">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <p className="k dash">Where it works</p>
            <h2 className="shimmer">Wherever<br /><span className="shine">hands are short.</span></h2>
          </div>
          <div>
            <p className="k">One robot. The same careful grip in every building.</p>
            <p className="lede">Hasta does the carrying that pulls trained people away from the people they trained for. It fits through a standard door, takes the lift, and works the same corridor twice without getting bored.</p>
          </div>
        </div>
      </div>
      <div className="rail" id="rail" tabIndex={0} role="group" aria-label="Places Hasta works">
        <article className="card"><div className="shot c-tan" data-shot="0"></div><h3>Hospital wards</h3><p>Medicine cups and water to the bedside, for the right patient, so nurses stay on the ward.</p></article>
        <article className="card"><div className="shot c-sage" data-shot="1"></div><h3>Care homes</h3><p>A cup of tea held out slowly, palm up, at chair height. The fortieth round as gentle as the first.</p></article>
        <article className="card"><div className="shot c-moss" data-shot="2"></div><h3>Hotels</h3><p>A covered plate carried level from the kitchen to the door, at any hour.</p></article>
        <article className="card"><div className="shot c-ember" data-shot="3"></div><h3>Laboratories</h3><p>Sample jars moved between benches without a tremor or a dropped rack.</p></article>
        <article className="card"><div className="shot c-cream" data-shot="4"></div><h3>Kitchens</h3><p>Lifted from the cup and set down whole. Eggs survive the trip.</p></article>
      </div>
    </section>

    <section className="sec light shift" id="shift" data-tone="light">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <p className="k dash">A shift</p>
            <h2 className="shimmer">Ten hours on a ward,<br /><span className="shine">hour by hour.</span></h2>
          </div>
        </div>
        <ol className="hours">
          <li><time>07:00</time><h3>Breakfast trays</h3><p className="k">Meals</p><p>Twenty-four trays from the kitchen lift to the bedside tables, lids left on.</p></li>
          <li><time>09:30</time><h3>Morning medicines</h3><p className="k">Medicines</p><p>Sealed cups carried beside the nurse, handed over one name at a time.</p></li>
          <li><time>11:00</time><h3>Linen run</h3><p className="k">Linen</p><p>Fresh stacks out to each bay, used bags back to the chute.</p></li>
          <li><time>12:30</time><h3>Lunch, then water</h3><p className="k">Meals</p><p>Plates out, jugs refilled, cups placed where each person can reach them.</p></li>
          <li><time>16:00</time><h3>Pack swap</h3><p className="k">Power</p><p>Two minutes at the dock for a fresh pack, then the evening round.</p></li>
        </ol>
      </div>
    </section>

    <section className="sec dark specs" id="specs" data-tone="dark">
      <div className="wrap">
        <div className="specs-head">
          <p className="k dash">In brief</p>
          <h2 className="shimmer">One robot,<br /><span className="shine">two hands.</span></h2>
        </div>
        <dl className="cells">
          <div><dt>Motors in each hand</dt><dd>20</dd></div>
          <div><dt>Touch readings per fingertip</dt><dd>1,000<small>/s</small></dd></div>
          <div><dt>Grip on an egg, per fingertip</dt><dd>&lt; 1<small>N</small></dd></div>
          <div><dt>Shift on one pack</dt><dd>10<small>h</small></dd></div>
        </dl>
      </div>
    </section>

    <section className="ch finale" id="finale" data-tone="dark">
      <div className="pin">
        <div className="head">
          <p className="eyebrow">The robot</p>
          <h2>Two hands.<br />One job.</h2>
          <a className="btn" href="#top">Start again <span aria-hidden="true">↑</span></a>
        </div>
      </div>
    </section>
  </main>
);
