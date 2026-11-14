/** Fixed 3D stage: stacked backdrops, the hero title behind the canvas, the WebGL canvas and the vision HUD. */
export const Stage = () => (
  <div className="stage" id="stage" aria-hidden="true">
    <div className="bg b0"></div><div className="bg b1"></div><div className="bg b2"></div><div className="bg b3"></div>
    <div className="bg b4"></div><div className="bg b5"></div><div className="bg b6"></div><div className="bg b7"></div>
    <p className="hero-title">Strength is solved.<br />Hands aren’t.</p>
    <canvas id="gl" />
    <div className="vig"></div>
    <div className="hud" id="hud">
      <div className="sweep"></div>
      <div className="box" id="box-tray"><span className="chip"><b>Tray</b> 40 × 27 cm</span></div>
      <div className="box" id="box-egg"><span className="chip hot"><b>Egg</b> 57 mm · fragile</span></div>
      <div className="hud-tag">Hasta view · depth</div>
    </div>
    {/* narrow screens: top fog behind the chapter headlines, one layer per chapter, crossfaded from scroll */}
    <div className="fog f1" data-ch="1"></div><div className="fog f2" data-ch="2"></div><div className="fog f3" data-ch="3"></div>
    <div className="fog f4" data-ch="4"></div><div className="fog f5" data-ch="5"></div><div className="fog f6" data-ch="6"></div>
  </div>
);
