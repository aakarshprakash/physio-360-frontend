import { applyTheme, createI18n } from '@physio/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { en } from './i18n/en';
import './styles.css';

applyTheme();

// English ships in the bundle; Arabic and Malayalam load when chosen.
void createI18n({
  en,
  ar: () => import('./i18n/ar').then((m) => m.ar),
  ml: () => import('./i18n/ml').then((m) => m.ml),
}).then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
