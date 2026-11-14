'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

/**
 * Lenis smooth scrolling for the whole page. It eases the real window scroll, so the
 * engine (which reads scrollY every frame) follows it with no changes. Skipped for
 * prefers-reduced-motion; in-page anchor links (nav, chapter tabs) glide via Lenis too.
 */
export const SmoothScroll = () => {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({
      autoRaf: true,
      lerp: 0.1,
      anchors: true,
      allowNestedScroll: true,   /* sideways swipes on the card rail / chapter tabs still scroll them */
    });
    return () => lenis.destroy();
  }, []);
  return null;
};
