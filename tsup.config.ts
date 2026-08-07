import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "lib/index.ts",
    "node-transport": "lib/src/node-transport.ts",
    "browser-transport": "lib/src/browser-transport.ts",
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
    ".wasm": "copy",
  },
  async onSuccess() {
    // Copy the generated WASM file into dist
    const fs = await import("fs");
    fs.copyFileSync(
      "pkg/growtopia_wasm_bg.wasm",
      "dist/growtopia_wasm_bg.wasm",
    );
    fs.copyFileSync(
      "pkg/growtopia_wasm_bg.wasm.d.ts",
      "dist/growtopia_wasm_bg.wasm.d.ts",
    );
    fs.copyFileSync("pkg/growtopia_wasm.d.ts", "dist/growtopia_wasm.d.ts");
    console.log("Copied every WASM file & type definitions into dist");
  },
});
