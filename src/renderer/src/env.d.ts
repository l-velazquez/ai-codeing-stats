/// <reference types="vite/client" />

import type { AzulCodeBridge } from "../../shared/types";

declare global {
  const __APP_VERSION__: string;

  interface Window {
    azulCode?: AzulCodeBridge;
  }
}

export {};
