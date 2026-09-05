/// <reference types="vite/client" />

import type { TokenaryBridge } from "../../shared/types";

declare global {
  interface Window {
    tokenary?: TokenaryBridge;
  }
}

export {};
