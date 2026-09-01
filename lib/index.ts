import initWasm, { Packet, Host, PeerState, PacketKind, mtuMax, crc32, timeSinceEpoch } from "./pkg/growtopia_wasm.js";
import { Peer } from "./src/Peer";
import { NodeENetHost, NodeENetClient, NodeENetServer } from "./src/node-transport";
import { BrowserENetHost, BrowserENetClient, BrowserENetServer } from "./src/browser-transport";
import { ExtendBuffer } from "./utils/ExtendBuffer";
import { Collection } from "./utils/Collection";
import { TankPacket } from "./src/packets/TankPacket";
import { TextPacket } from "./src/packets/TextPacket";
import { Variant } from "./src/packets/Variant";
import { VariantTypes, PacketTypes } from "./src/Constants";
import { CompatHost, createHost } from "./src/compat";

/**
 * Initializes the WebAssembly core environment for the ENet library.
 * Must be invoked prior to instantiating any ENet client or server.
 * In Node.js environments, it automatically locates and reads the compiled WASM binary.
 *
 * @param input - Optional WASM binary ArrayBuffer, Buffer, or WebAssembly Module instance.
 */
export async function init(input?: any): Promise<void> {
  if (!input && typeof process !== "undefined" && process.versions && process.versions.node) {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const { fileURLToPath } = await import("url");

      let wasmPath = "";
      if (typeof __dirname !== "undefined") {
        wasmPath = path.join(__dirname, "pkg", "growtopia_wasm_bg.wasm");
      } else if (import.meta && import.meta.url) {
        wasmPath = fileURLToPath(new URL("pkg/growtopia_wasm_bg.wasm", import.meta.url));
      }

      if (wasmPath && fs.existsSync(wasmPath)) {
        input = fs.readFileSync(wasmPath);
      }
    } catch {
      // Fallback to default initWasm behavior
    }
  }
  await initWasm(input);
}

export {
  Packet,
  Peer,
  Host,
  PeerState,
  PacketKind,
  mtuMax,
  crc32,
  timeSinceEpoch,
  NodeENetHost,
  NodeENetClient,
  NodeENetServer,
  BrowserENetHost,
  BrowserENetClient,
  BrowserENetServer,
  ExtendBuffer,
  Collection,
  TankPacket,
  TextPacket,
  Variant,
  VariantTypes,
  PacketTypes,
  CompatHost,
  createHost
};

export type * from "./src/types";
