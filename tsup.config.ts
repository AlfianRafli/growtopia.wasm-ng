import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "lib/index.ts",
    "node-transport": "lib/src/node-transport.ts",
    "browser-transport": "lib/src/browser-transport.ts"
  },
  splitting: false,
  sourcemap: true,
  format: ["cjs", "esm"],
  dts: false,
  bundle: true,
  clean: true,
  shims: true,
  noExternal: ["nanoevents"],
  loader: {
    ".wasm": "copy"
  },
  async onSuccess() {
    // Copy the generated WASM file into dist
    const { copyFileSync, mkdirSync } = await import("fs");
    mkdirSync("dist/pkg", { recursive: true });
    copyFileSync("lib/pkg/growtopia_wasm.js", "dist/pkg/growtopia_wasm.js");
    copyFileSync("lib/pkg/growtopia_wasm.d.ts", "dist/pkg/growtopia_wasm.d.ts");
    copyFileSync("lib/pkg/growtopia_wasm_bg.wasm", "dist/pkg/growtopia_wasm_bg.wasm");
    copyFileSync("lib/pkg/growtopia_wasm_bg.wasm.d.ts", "dist/pkg/growtopia_wasm_bg.wasm.d.ts");
    console.log("Copied every WASM file & type definitions into dist");
  }
});
