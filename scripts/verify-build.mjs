import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const preloadPath = resolve("out/preload/index.cjs");
const mainPath = resolve("out/main/index.js");

if (!existsSync(preloadPath)) {
  throw new Error(`Missing sandboxed preload bundle: ${preloadPath}`);
}

if (!existsSync(mainPath) || !readFileSync(mainPath, "utf8").includes("../preload/index.cjs")) {
  throw new Error("The Electron main bundle does not point to out/preload/index.cjs.");
}

console.log("Verified Electron preload bridge bundle.");
