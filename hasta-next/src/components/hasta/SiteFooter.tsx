/** Footer links and the note about the concept. */
export const SiteFooter = () => (
  <footer className="foot" id="about">
    <div className="wrap">
      <div className="foot-cols">
        <div>
          <p className="k">The story</p>
          <a href="#hands">Hands</a><a href="#grip">Grip</a><a href="#handover">Handover</a>
        </div>
        <div>
          <p className="k">The robot</p>
          <a href="#rounds">Rounds</a><a href="#places">Where it works</a><a href="#specs">In brief</a>
        </div>
        <div>
          <p className="k">About the concept</p>
          <p className="note">Hasta is a fictional robot. The figures are typical for dexterous robot hands and service robots, not test results. Everything here is drawn live in your browser, with no image or video files.</p>
        </div>
      </div>
    </div>
  </footer>
);
