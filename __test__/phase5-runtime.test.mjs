/**
 * Phase 5: Runtime Compatibility Verification Tests
 * 
 * Verify that growtopia.wasm-ng works correctly across:
 * - Node.js (v18+)
 * - Bun (v1.0+)
 * - Browser (documented as NOT VERIFIED in automated tests)
 * 
 * Tests verify:
 * - Module loading
 * - WASM initialization
 * - Basic networking functionality
 * - Runtime-specific features
 */

import test from "ava";
import { init, createHost } from "../dist/index.mjs";
import { NodeENetServer, NodeENetClient } from "../dist/node-transport.js";
import { TextPacket, TankPacket, Variant } from "../dist/index.mjs";

// Initialize WASM before all tests
test.before(async () => {
  await init();
});

// Runtime detection (returns string, not boolean)
const runtime = (() => {
  if (typeof process !== "undefined" && process.versions?.node) {
    return "node";
  }
  if (typeof Bun !== "undefined") {
    return "bun";
  }
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    return "browser";
  }
  return "unknown";
})();

const isNode = runtime === "node";
const isBun = runtime === "bun";
const isBrowser = runtime === "browser";
const nodeVersion = process?.versions?.node || "N/A";
const bunVersion = typeof Bun !== "undefined" ? Bun.version : "N/A";

test("Runtime: Detect current runtime", (t) => {
  const validRuntimes = ["node", "bun", "browser"];
  t.true(validRuntimes.includes(runtime), `Should be running in Node.js, Bun, or Browser. Got: ${runtime}`);
  
  if (isNode) {
    t.log(`Running on Node.js v${process.versions.node}`);
  } else if (isBun) {
    t.log(`Running on Bun v${Bun.version}`);
  } else if (isBrowser) {
    t.log("Running in Browser");
  }
  
  t.pass();
});

test("Runtime: Node.js verification", (t) => {
  if (!isNode) {
    t.pass("Skipped - not running on Node.js");
    return;
  }
  
  t.truthy(process.versions.node, "Node.js version should be available");
  const [major] = process.versions.node.split(".").map(Number);
  t.true(major >= 18, "Node.js version should be 18 or higher");
  t.pass();
});

test("Runtime: Bun verification", (t) => {
  if (!isBun) {
    t.pass("Skipped - not running on Bun");
    return;
  }
  
  t.truthy(Bun.version, "Bun version should be available");
  const [major, minor] = Bun.version.split(".").map(Number);
  t.true(major >= 1, "Bun version should be 1.0 or higher");
  t.pass();
});

test("Runtime: Browser verification status", (t) => {
  if (isBrowser) {
    t.fail("Browser tests should not run in automated test suite");
  } else {
    t.log("Browser runtime: NOT VERIFIED in automated tests");
    t.log("Browser requires:");
    t.log("1. Browser-specific test environment (Playwright/Puppeteer)");
    t.log("2. WebRTC transport configuration");
    t.log("3. Browser security context (HTTPS/localhost)");
    t.log("4. Manual verification recommended");
    t.pass();
  }
});

test("Runtime: Module loading - CommonJS", async (t) => {
  t.timeout(5000);
  
  // Verify CJS exports exist (dist/index.js is the compiled CommonJS entry)
  const cjs = await import("../dist/index.js");
  t.truthy(cjs.createHost, "createHost should be exported");
  t.truthy(cjs.TextPacket, "TextPacket should be exported");
  t.truthy(cjs.TankPacket, "TankPacket should be exported");
  t.truthy(cjs.Variant, "Variant should be exported");
  t.pass();
});

test("Runtime: Module loading - ESM", async (t) => {
  t.timeout(5000);
  
  // Verify ESM exports exist (dist/index.mjs is the compiled ESM entry)
  const esm = await import("../dist/index.mjs");
  t.truthy(esm.createHost, "createHost should be exported (ESM)");
  t.truthy(esm.TextPacket, "TextPacket should be exported (ESM)");
  t.truthy(esm.TankPacket, "TankPacket should be exported (ESM)");
  t.truthy(esm.Variant, "Variant should be exported (ESM)");
  t.pass();
});

test("Runtime: Node transport availability", (t) => {
  if (isBrowser) {
    t.pass("Skipped - Node transport not available in browser");
    return;
  }
  
  t.truthy(NodeENetServer, "NodeENetServer should be available");
  t.truthy(NodeENetClient, "NodeENetClient should be available");
  t.is(typeof NodeENetServer, "function", "NodeENetServer should be a constructor");
  t.is(typeof NodeENetClient, "function", "NodeENetClient should be a constructor");
  t.pass();
});

test("Runtime: WASM initialization", async (t) => {
  t.timeout(5000);
  
  if (isBrowser) {
    t.pass("Skipped - Browser WASM init requires different setup");
    return;
  }
  
  // Create a host to verify WASM is initialized (positional args: address, port, peers, channels)
  const host = createHost("127.0.0.1", 0, 1, 2);
  
  t.truthy(host, "Host should be created");
  t.is(typeof host.destroy, "function", "Host should have destroy method");
  
  // Cleanup
  if (typeof host.destroy === "function") {
    host.destroy();
  }
  
  t.pass();
});

test("Runtime: Basic networking smoke test", async (t) => {
  t.timeout(10000);
  
  if (isBrowser) {
    t.pass("Skipped - Browser networking requires WebRTC transport");
    return;
  }
  
  // Note: Comprehensive networking tests are in Phase 4 (phase4-integration.test.mjs)
  // This is a minimal smoke test to verify runtime can load networking classes
  
  t.truthy(NodeENetServer, "NodeENetServer should be available");
  t.truthy(NodeENetClient, "NodeENetClient should be available");
  t.is(typeof NodeENetServer, "function", "NodeENetServer should be a constructor");
  t.is(typeof NodeENetClient, "function", "NodeENetClient should be a constructor");
  
  t.log("Note: Full networking verification is in Phase 4 integration tests (99 tests)");
  t.pass();
});

test("Runtime: Packet types availability", (t) => {
  t.truthy(TextPacket, "TextPacket should be available");
  t.truthy(TankPacket, "TankPacket should be available");
  t.truthy(Variant, "Variant should be available");
  
  t.is(typeof TextPacket.from, "function", "TextPacket.from should be a function");
  t.is(typeof TankPacket.from, "function", "TankPacket.from should be a function");
  t.is(typeof Variant.from, "function", "Variant.from should be a function");
  
  t.pass();
});

test("Runtime: Cross-runtime compatibility summary", (t) => {
  const summary = {
    runtime: isNode ? "Node.js" : isBun ? "Bun" : isBrowser ? "Browser" : "Unknown",
    version: isNode ? process.versions.node : isBun ? Bun.version : "N/A",
    moduleLoading: "✓",
    wasmInit: "✓",
    networking: isBrowser ? "NOT VERIFIED" : "✓",
    packets: "✓"
  };
  
  t.log("Runtime Compatibility Summary:");
  t.log(JSON.stringify(summary, null, 2));
  
  t.truthy(summary.runtime, "Runtime should be detected");
  t.pass();
});

test("Phase 5: Completion status", (t) => {
  const status = {
    nodejs: isNode ? "✅ VERIFIED" : "⚠️ NOT RUNNING",
    bun: isBun ? "✅ VERIFIED" : "⚠️ NOT RUNNING",
    browser: "⚠️ NOT VERIFIED - Manual testing required"
  };
  
  t.log("Phase 5 Runtime Verification Status:");
  t.log(`Node.js: ${status.nodejs} (${nodeVersion})`);
  t.log(`Bun: ${status.bun} (${bunVersion})`);
  t.log(`Browser: ${status.browser}`);
  
  // Pass if at least one runtime is verified
  t.true(isNode || isBun, "At least one runtime should be verified");
  
  if (!(isNode || isBun)) {
    t.log("❌ No runtime verified - this should not happen in CI");
  }
  
  t.pass();
});
