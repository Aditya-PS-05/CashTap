import { build } from "esbuild";
import { copyFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes("--watch");

async function run() {
  const ctx = await build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    format: "iife",
    globalName: "BCHPay",
    outfile: "dist/bchpay.js",
    minify: !watch,
    sourcemap: false,
    target: "es2020",
    platform: "browser",
    ...(watch ? {} : {}),
  });

  // Copy to web/public for serving
  const webPublicDir = resolve(__dirname, "../web/public");
  if (existsSync(webPublicDir)) {
    copyFileSync(
      resolve(__dirname, "dist/bchpay.js"),
      resolve(webPublicDir, "sdk.js")
    );
    console.log("Copied sdk.js to web/public/");
  }

  console.log("SDK build complete");
}

run().catch(console.error);
