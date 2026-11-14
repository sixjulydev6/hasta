// Screenshot a chapter state. Needs Playwright + Chromium.
//   python3 build.py test.html && node tools_screenshot.js out "0,1.25,3.32,7.3"
// Positions are on the scroll timeline: 0 hero, 1.25 hands, 2.3 vision, 3.32 grip, 4.25 touch, 5.25 handover, 6.25 rounds, 7.3 finale.
const { chromium } = require('playwright');
(async () => {
  const [prefix = 'shot', taus = '0', w = 1440, h = 900] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  p.on('pageerror', e => console.log('PAGEERR', e.message.slice(0, 400)));
  await p.addInitScript(() => { window.__hastaFrameMs = 5000; });      // cap the frame rate so software rendering keeps up
  await p.goto('file://' + __dirname + '/test.html');
  await p.addStyleTag({ content: '*{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}' });
  await p.waitForTimeout(3000);
  for (const t of taus.split(',')) {
    await p.evaluate(tau => {
      const ch = [...document.querySelectorAll('.ch')], vh = innerHeight, i = Math.min(ch.length - 1, Math.floor(tau)), f = tau - i;
      const top = ch[i].getBoundingClientRect().top + scrollY, hgt = ch[i].offsetHeight, hold = (hgt - vh) / hgt;
      document.documentElement.style.scrollBehavior = 'auto';
      scrollTo(0, top + (f < 0.5 ? f / 0.5 * hold : hold + (f - 0.5) / 0.5 * (1 - hold)) * hgt);
      window.__hasta.tau(tau);                                           // pin the 3D timeline to this position
    }, +t);
    await p.waitForTimeout(17000);
    await p.screenshot({ path: `${__dirname}/${prefix}_${t}.png` });
  }
  await b.close();
})();
