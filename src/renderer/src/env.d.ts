/// <reference types="vite/client" />

import type { TokenaryBridge } from "../../shared/types";

declare global {
  const __APP_VERSION__: string;

  interface Window {
    tokenary?: TokenaryBridge;
  }
}

export {};
