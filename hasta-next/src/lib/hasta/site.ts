/* Site-wide metadata shared by the root layout, robots.txt and sitemap.xml.
   Set NEXT_PUBLIC_SITE_URL to the production origin (e.g. https://hasta.example.com);
   on Vercel the production domain is picked up automatically. */
const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? (vercelHost ? `https://${vercelHost}` : 'http://localhost:3000')
).replace(/\/$/, '');

export const SITE_NAME = 'Hasta';
export const SITE_TITLE = "Hasta — Strength is solved. Hands aren't.";
export const SITE_DESCRIPTION =
  "Strength is solved. Hands aren't. A scroll-driven look at Hasta, a concept service robot built around its hands.";
export const SITE_KEYWORDS = ['Hasta', 'robot', 'service robot', 'robotic hands', 'dexterity', 'three.js', '3D'];
