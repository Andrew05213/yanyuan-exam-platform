import { spawnSync } from "node:child_process";
import { createRelease,verifyRelease } from "./release-assets.mjs";
import { fileURLToPath } from "node:url";
import { readExecutionProfile } from "./execution-profile.mjs";

const [command, ...args] = process.argv.slice(2);
if (!["dev", "build"].includes(command)) throw new Error("Expected dev or build.");
// The browser imports PDF.js and the OCR worker as same-origin static assets.
await import("./prepare-ocr.mjs");
const managedLinux = readExecutionProfile() === "managed-linux";
const revisionResult=spawnSync("git",["rev-parse","HEAD"],{encoding:"utf8"});
const revision=revisionResult.status===0&&/^[a-f0-9]{40}$/.test(revisionResult.stdout.trim())?revisionResult.stdout.trim():"unknown";
process.env.VITE_YANYUAN_RELEASE=revision;
function finalizeRelease(){createRelease(fileURLToPath(new URL("../dist/client",import.meta.url)),revision);verifyRelease(fileURLToPath(new URL("../dist/client",import.meta.url)),revision);console.log("Verified release assets for "+revision);}
if (command === "build" || process.env.YANYUAN_LAN_AUTH === "1") {
  const result = spawnSync(process.execPath, [
    fileURLToPath(new URL("./prepare-literature.mjs", import.meta.url)),
  ], {stdio: "inherit"});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (managedLinux && command === "build") {
  const result = spawnSync("bash", [
    fileURLToPath(new URL("./build-verified.sh", import.meta.url)), ...args,
  ], { stdio: "inherit" });
  if (result.error) throw result.error;
  if(result.status===0)finalizeRelease();
  process.exit(result.status ?? 1);
}

// Import in this process so the preview owner retains its PID and signals.
const cli = new URL(managedLinux
  ? "../node_modules/vite/bin/vite.js"
  : "../node_modules/vinext/dist/cli.js", import.meta.url);
process.argv = [process.execPath, fileURLToPath(cli), command,
  ...(!managedLinux && command === "dev" ? ["--port", "5173"] : []), ...args];
if(command==="build"){
  const result=spawnSync(process.execPath,process.argv.slice(1),{stdio:"inherit",env:process.env});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status??1);
  finalizeRelease();
}else await import(cli.href);
