import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadLocale } from './i18n';
import './styles/app.css';

document.documentElement.dataset.platform = window.drift.platform;

// Load the language first so the first paint is already translated (and RTL for Hebrew).
void loadLocale().finally(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
