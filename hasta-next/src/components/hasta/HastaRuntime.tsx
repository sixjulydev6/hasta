'use client';

import { useEffect } from 'react';
import { startHasta } from '@/lib/hasta/engine';

/**
 * Boots the scroll timeline, page chrome and three.js stage once the server-rendered
 * markup is in the DOM. The engine drives the page imperatively (by id and class),
 * so this renders nothing; the returned cleanup tears every listener, frame loop and
 * GPU resource down again (React Strict Mode mounts it twice in development).
 */
export const HastaRuntime = () => {
  useEffect(() => startHasta(), []);
  return null;
};
