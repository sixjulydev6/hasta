# Hasta — Next.js

Next.js (App Router, TypeScript, strict) port of the Hasta scroll-driven 3D page in `../src`.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
npm run typecheck
```

## Layout

```
src/
  app/layout.tsx              metadata, viewport, Google Fonts link, global CSS
  app/page.tsx                composes the page (server component)
  components/hasta/           markup: Stage, TopBar, ChapterTabs, Story, SiteFooter
  components/hasta/HastaRuntime.tsx   client component: starts the engine in useEffect, cleans up on unmount
  lib/hasta/core.ts           maths, lofts, baked textures, materials, environments, post pipeline (was core.js)
  lib/hasta/robot.ts          robot, hands, tray, studio, props (was robot.js)
  lib/hasta/engine.ts         scroll model, chrome, scene, timeline, interactions (was app.js)
  styles/globals.css          was style.css, unchanged
```

The engine still drives the DOM imperatively by id/class, exactly as before, so ids and
class names in the components must stay in sync with `engine.ts`. Test hooks
(`window.__hasta`, `window.__hastaFrameMs`) are unchanged.
