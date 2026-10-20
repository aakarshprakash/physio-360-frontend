import { applyTheme, createI18n } from '@physio/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

applyTheme();
// Internal operator tool: English UI (the shared "common" namespace still supports other languages).
void createI18n({ en: {} }).then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
