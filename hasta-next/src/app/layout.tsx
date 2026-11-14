import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Hasta',
  description: "Strength is solved. Hands aren't. A scroll-driven look at Hasta, a concept service robot built around its hands.",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#fffdfd',
};

/* Fonts load from Google Fonts by family name (not next/font) because the 3D decals
   draw "Geist Mono" onto canvases by that exact name. */
const FONTS = 'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;700&family=Geist+Mono:wght@400;500&display=swap';

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html lang="en">
    <head>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={FONTS} />
    </head>
    <body>{children}</body>
  </html>
);

export default RootLayout;
