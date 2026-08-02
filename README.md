# growtopia.wasm

[![NPM Version](https://img.shields.io/npm/v/growtopia.wasm?style=flat-square)](https://npmjs.com/package/growtopia.wasm)
[![NPM Downloads](https://img.shields.io/npm/dw/growtopia.wasm?style=flat-square&color=blue)](https://npmjs.com/package/growtopia.wasm)
[![Build Status](https://img.shields.io/github/actions/workflow/status/StileDevs/growtopia.wasm/CI.yml?branch=main&style=flat-square)](https://github.com/StileDevs/growtopia.wasm/actions)

A universal Growtopia ENet library compiled to WebAssembly (WASM) for Node.js, Bun.js. Designed as a cross-platform replacement for [growtopia.js](https://github.com/StileDevs/growtopia.js).

## Why replacement of growtopia.js?

[growtopia.js](https://github.com/StileDevs/growtopia.js) relied on native Rust bindings compiled via [napi-rs](https://napi.rs/), requiring platform-specific binary builds and causing compatibility issues across different platforms. [growtopia-wasm](https://github.com/StileDevs/growtopia.wasm) solves this by compiling the Rust core ENet library directly into WebAssembly, guaranteeing seamless execution across Node.js, Bun.js environments.

## Differences between growtopia.js and growtopia.wasm

| Feature / Aspect      | `growtopia.js`                                              | `growtopia.wasm`                                                  |
| --------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| **Core Engine**       | Native Node.js bindings (`napi-rs` / `.node`)               | Rust compiled to WebAssembly (`wasm-pack`)                        |
| **Platform Support**  | Requires OS/CPU specific native binaries                    | Single WASM binary (Runs on Windows, Linux, macOS, Android, etc.) |
| **Runtimes**          | Node.js only                                                | Node.js, Bun.js, and Web Browsers                                 |
| **Installation**      | Heavy; may fail on unsupported OS/arch without C++ compiler | Zero native compilation; instant install                          |
| **Network Transport** | Native C ENet sockets                                       | TS transport bridge (`dgram` for Node/Bun)                        |

## Installation

```bash
npm install growtopia.wasm
```

or with Bun:

```bash
bun add growtopia.wasm
```

### ENet Server Example

```js
import { NodeENetServer, init, Packet, PacketKind } from "growtopia.wasm";

async function main() {
  // Initialize WebAssembly core
  await init();

  // Initialize ENet server host (IP, Port, Max Peers, Channels)
  const server = new NodeENetServer("127.0.0.1", 17091, 1024, 2);
  await server.start();

  // Start event polling loop
  server.startPolling(15);

  server.emitter.on("connect", (peer) => {
    console.log(`Client connected: ID ${peer.id} from ${peer.ip}:${peer.port}`);

    // Send Hello packet (Type 1)
    const helloPayload = new Uint8Array([1, 0, 0, 0, 0]);
    const helloPacket = new Packet(helloPayload, PacketKind.Reliable);
    peer.send(helloPacket);
  });

  server.emitter.on("disconnect", (peer, data) => {
    console.log(`Client disconnected: ID ${peer.id}, code: ${data}`);
  });

  server.emitter.on("receive", (peer, packet, channelId) => {
    const data = packet.data();
    console.log(
      `Received ${data.length} bytes on channel ${channelId} from peer ${peer.id}`,
    );
  });
}

main();
```

### ENet Client Example

```js
import { NodeENetClient, init } from "growtopia.wasm";

async function main() {
  await init();

  const client = new NodeENetClient("0.0.0.0", 0, 1, 2);
  await client.start();

  const peer = client.connect("127.0.0.1", 17091, 2, 0);
  client.startPolling(15);

  client.emitter.on("connect", (p) => {
    console.log(`Connected to server! Peer ID: ${p.id}`);
  });

  client.emitter.on("disconnect", (p, data) => {
    console.log(`Disconnected from server. Code: ${data}`);
  });

  client.emitter.on("receive", (p, packet, channelId) => {
    const data = packet.data();
    console.log(
      `Received packet on channel ${channelId}: ${data.length} bytes`,
    );
  });
}

main();
```

### Packet Serialization Example

```js
import { TextPacket, TankPacket, Variant } from "growtopia.wasm";

// Text Packet (Action / Login)
const textPacket = TextPacket.from(3, "action|refresh_item_data", "");
const textBuf = textPacket.parse();

// Tank Packet (State / Motion)
const tankPacket = TankPacket.from({
  type: 0x3,
  netID: 10,
  xPos: 100.5,
  yPos: 200.25,
});
const tankBuf = tankPacket.parse();

// Variant List Packet
const variant = Variant.from(
  { netID: 1, delay: 0 },
  "OnConsoleMessage",
  "Hello Growtopia!",
);
const variantTankPacket = variant.parse();
```

## Links

- [Documentation](https://gt-wasm.jad.li/)
- [Discord Community](https://discord.gg/sGrxfKZY5t)
