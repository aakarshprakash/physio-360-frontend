import { resolvedTheme } from '@physio/core';
import { useEffect, useState } from 'react';

/*
 * Chart palette, validated with the dataviz palette checker (lightness band,
 * chroma floor, CVD + normal-vision separation, contrast) separately for each
 * surface. Series 1 is the brand sage, saturated enough to read as a hue.
 *   light (#fcfcfb surface): #0F8A63, #3D6FD6
 *   dark  (#10242B surface): #2BA57E, #5B8CF0
 */
const PALETTES = {
  light: { series: ['#0F8A63', '#3D6FD6'], grid: '#E3ECE8', axis: '#718489', text: '#4F6369', surface: '#FFFFFF', cursor: '#C3D4CD' },
  dark: { series: ['#2BA57E', '#5B8CF0'], grid: '#1F3B45', axis: '#87A09A', text: '#A8BDB8', surface: '#10242B', cursor: '#2F5866' },
} as const;

export type ChartPalette = (typeof PALETTES)['light' | 'dark'];

/** Current chart colours; updates when the theme toggles or the OS scheme changes. */
export function useChartPalette(): ChartPalette {
  const [mode, setMode] = useState(resolvedTheme());

  useEffect(() => {
    const update = () => setMode(resolvedTheme());
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', update);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', update);
    };
  }, []);

  return PALETTES[mode];
}
