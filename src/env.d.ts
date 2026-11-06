/// <reference types="vite/client" />
import type { DriftApi } from '../shared/types';

declare global {
  interface Window {
    drift: DriftApi;
  }
}

export {};
