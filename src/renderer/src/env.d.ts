/// <reference types="vite/client" />

import type { TallyBridge } from "../../shared/types";

declare global {
  const __APP_VERSION__: string;

  interface Window {
    tally?: TallyBridge;
  }
}

export {};
