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

for (const asset of ["trayTemplate.png", "trayTemplate@2x.png"]) {
  if (!existsSync(resolve("resources", asset))) throw new Error(`Missing menu bar asset: ${asset}`);
  if (!readFileSync(mainPath, "utf8").includes(`../../resources/${asset}`)) throw new Error(`Missing menu bar asset reference: ${asset}`);
}
const manifest = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
if (!manifest.build.files.includes("resources/*.png")) throw new Error("Menu bar icons must be included in the packaged app.");
console.log("Verified standard and Retina menu bar icons.");

for (const file of ["LICENSE", "NOTICE", "THIRD_PARTY_NOTICES.md", "licenses/IBM-Plex-Mono-OFL.txt"]) {
  if (!existsSync(resolve(file))) throw new Error(`Missing distribution notice: ${file}`);
}
for (const pattern of ["LICENSE", "NOTICE", "THIRD_PARTY_NOTICES.md", "licenses/**/*"]) {
  if (!manifest.build.files.includes(pattern)) throw new Error(`Distribution notices must be packaged: ${pattern}`);
}
console.log("Verified distribution licenses and notices.");
