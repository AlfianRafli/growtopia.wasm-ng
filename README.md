# @alfianrafli/growtopia.wasm

[![NPM Version](https://img.shields.io/npm/v/@alfianrafli/growtopia.wasm?style=flat-square)](https://npmjs.com/package/@alfianrafli/growtopia.wasm)
[![NPM Downloads](https://img.shields.io/npm/dw/@alfianrafli/growtopia.wasm?style=flat-square&color=blue)](https://npmjs.com/package/@alfianrafli/growtopia.wasm)
[![Build Status](https://img.shields.io/github/actions/workflow/status/AlfianRafli/growtopia.wasm-ng/CI.yml?branch=main&style=flat-square)](https://github.com/AlfianRafli/growtopia.wasm-ng/actions)

A universal Growtopia ENet library compiled to WebAssembly (WASM) for Node.js and Bun.js. Designed as a cross-platform replacement for [growtopia.js](https://github.com/StileDevs/growtopia.js).

**This project is based on and derived from the original [growtopia.wasm](https://github.com/StileDevs/growtopia.wasm) project by [StileDevs](https://github.com/StileDevs).**

## Why replacement of growtopia.js?

[growtopia.js](https://github.com/StileDevs/growtopia.js) relied on native Rust bindings compiled via [napi-rs](https://napi.rs/), requiring platform-specific binary builds and causing compatibility issues across different platforms. `@alfianrafli/growtopia.wasm` solves this by compiling the Rust core ENet library directly into WebAssembly, guaranteeing seamless execution across Node.js and Bun.js environments without native dependencies.

## Differences between growtopia.js and @alfianrafli/growtopia.wasm

| Feature / Aspect      | `growtopia.js`                                              | `@alfianrafli/growtopia.wasm`                                                  |
| --------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| **Core Engine**       | Native Node.js bindings (`napi-rs` / `.node`)               | Rust compiled to WebAssembly (`wasm-pack`)                        |
| **Platform Support**  | Requires OS/CPU specific native binaries                    | Single WASM binary (Runs on Windows, Linux, macOS, Android, etc.) |
| **Installation**      | Heavy; may fail on unsupported OS/arch without C++ compiler | Zero native compilation; instant install                          |
| **Network Transport** | Native C ENet sockets                                       | TypeScript transport bridge (`dgram` for Node/Bun)                        |

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
  - [ENet Server Example](#enet-server-example)
  - [ENet Client Example](#enet-client-example)
- [API Reference](#api-reference)
  - [Initialization](#initialization)
  - [Node.js API](#nodejs-api)
  - [Browser API](#browser-api)
  - [Peer API](#peer-api)
  - [Packet API](#packet-api)
  - [Packet Serialization](#packet-serialization)
  - [Utilities](#utilities)
- [Lifecycle & Resource Management](#lifecycle--resource-management)
- [Environment Support](#environment-support)
- [Links](#links)
- [License & Credits](#license--credits)

---

## Installation

```bash
npm install @alfianrafli/growtopia.wasm
```

or with Bun:

```bash
bun add @alfianrafli/growtopia.wasm
```

---

## Quick Start

### ENet Server Example

```js
import { NodeENetServer, init, Packet, PacketKind } from "@alfianrafli/growtopia.wasm";

async function main() {
  // Initialize WebAssembly core
  await init();

  // Initialize ENet server host (IP, Port, Max Peers, Channels)
  const server = new NodeENetServer("127.0.0.1", 17091, 1024, 2);
  await server.start();

  // Start event polling loop
  server.startPolling(15);

  server.emitter.on("connect", peer => {
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
    console.log(`Received ${data.length} bytes on channel ${channelId} from peer ${peer.id}`);
  });
}

main();
```

### ENet Client Example

```js
import { NodeENetClient, init } from "@alfianrafli/growtopia.wasm";

async function main() {
  await init();

  const client = new NodeENetClient("0.0.0.0", 0, 1, 2);
  await client.start();

  const peer = client.connect("127.0.0.1", 17091, 2, 0);
  client.startPolling(15);

  client.emitter.on("connect", p => {
    console.log(`Connected to server! Peer ID: ${p.id}`);
  });

  client.emitter.on("disconnect", (p, data) => {
    console.log(`Disconnected from server. Code: ${data}`);
  });

  client.emitter.on("receive", (p, packet, channelId) => {
    const data = packet.data();
    console.log(`Received packet on channel ${channelId}: ${data.length} bytes`);
  });
}

main();
```

---

## API Reference

### Initialization

#### `init(input?: any): Promise<void>`

Initializes the WebAssembly core environment for the ENet library. **Must be invoked prior to instantiating any ENet client or server.**

In Node.js/Bun environments, it automatically locates and reads the compiled WASM binary.

**Parameters:**
- `input` (optional): WASM binary ArrayBuffer, Buffer, or WebAssembly Module instance.

**Example:**
```js
import { init } from "@alfianrafli/growtopia.wasm";

await init();
```

---

### Node.js API

#### `NodeENetServer`

High-level Node.js ENet Server host configured for server protocol specs.

**Constructor:**
```ts
constructor(
  bindIp: string,
  bindPort: number,
  peerCount: number,
  channelLimit: number
)
```

**Parameters:**
- `bindIp`: IP address to bind (e.g., `"0.0.0.0"` or `"127.0.0.1"`)
- `bindPort`: UDP port number (e.g., `17091`)
- `peerCount`: Maximum number of peers (e.g., `1024`)
- `channelLimit`: Number of ENet channels (typically `2`)

**Properties:**
- `emitter: Emitter<ENetEvents>` - Event emitter for `connect`, `disconnect`, `receive` events
- `host: Host` - Underlying WebAssembly Host instance
- `cache.peers: Collection<number, Peer>` - Active peer cache

**Methods:**

##### `start(): Promise<void>`
Binds the underlying UDP socket to the configured IP address and port.

##### `startPolling(ms?: number, options?: PollingOptions): void`
Starts an asynchronous polling loop to process incoming and outgoing ENet events at regular intervals.

**Parameters:**
- `ms`: Polling interval in milliseconds (default: `15`)
- `options.autoFreePacket`: Automatically free packets after receive event (default: `true`)
- `options.autoFreePeer`: Reserved for future use

##### `stopPolling(): void`
Stops the active event polling loop.

##### `service(): Event | null`
Dispatches pending ENet network events synchronously. Returns event object or null.

##### `checkEvents(): Event | null`
Checks for queued ENet events without waiting.

##### `connect(ip: string, port: number, channelCount: number, data: number): Peer`
Connects to a remote ENet host endpoint.

**Parameters:**
- `ip`: Target host IP address
- `port`: Target host UDP port
- `channelCount`: Number of ENet channels to allocate
- `data`: User data integer passed in connect request

**Returns:** Connected `Peer` wrapper instance

##### `destroy(): void`
Releases all resources held by this host: stops polling, closes the underlying UDP socket, and clears the peer cache. **Safe to call multiple times (idempotent).**

**Events:**
```ts
interface ENetEvents {
  connect: (peer: Peer) => void;
  disconnect: (peer: Peer, data: number) => void;
  receive: (peer: Peer, packet: Packet, channel: number) => void;
}
```

**Example:**
```js
import { NodeENetServer, init } from "@alfianrafli/growtopia.wasm";

await init();
const server = new NodeENetServer("0.0.0.0", 17091, 1024, 2);
await server.start();
server.startPolling(15);

server.emitter.on("connect", peer => {
  console.log(`Peer ${peer.id} connected`);
});

// Cleanup when done
server.destroy();
```

---

#### `NodeENetClient`

High-level Node.js ENet Client host configured for client protocol specs.

**Constructor:**
```ts
constructor(
  bindIp?: string,
  bindPort?: number,
  peerCount?: number,
  channelLimit?: number
)
```

**Parameters:**
- `bindIp`: IP address to bind (default: `"0.0.0.0"`)
- `bindPort`: UDP port number (default: `0` for automatic assignment)
- `peerCount`: Maximum number of peers (default: `1`)
- `channelLimit`: Number of ENet channels (default: `2`)

**Methods:** Same as `NodeENetServer` (inherits from `NodeENetHost`)

**Example:**
```js
import { NodeENetClient, init } from "@alfianrafli/growtopia.wasm";

await init();
const client = new NodeENetClient();
await client.start();

const peer = client.connect("127.0.0.1", 17091, 2, 0);
client.startPolling(15);

client.emitter.on("connect", p => {
  console.log("Connected!");
});

// Cleanup
client.destroy();
```

---

### Browser API

#### `BrowserENetServer` / `BrowserENetClient`

High-level Browser ENet Host wrapper using WebRTC RTCDataChannel transport.

**Constructor:**
```ts
// Server
constructor(peerCount: number, channelLimit: number)

// Client
constructor(peerCount?: number, channelLimit?: number)
```

**Parameters:**
- `peerCount`: Maximum number of peers
- `channelLimit`: Number of ENet channels

**Properties:**
- `emitter: Emitter<ENetEvents>` - Event emitter
- `host: Host` - Underlying WebAssembly Host instance
- `cache.peers: Collection<number, Peer>` - Active peer cache

**Methods:**

##### `attachDataChannel(channel: RTCDataChannel): void`
Attaches a WebRTC RTCDataChannel for transporting ENet packet payloads.

**Parameters:**
- `channel`: Open RTCDataChannel instance

**Important:** Must be called before starting polling.

##### `startPolling(ms?: number, options?: PollingOptions): void`
Starts polling loop (default: 15ms).

##### `stopPolling(): void`
Stops the active event polling loop.

##### `connect(ip: string, port: number, channelCount: number, data: number): Peer`
Initiates a connection request to a peer endpoint over WebRTC.

##### `destroy(): void`
Releases all resources held by this host:
- Stops polling
- Removes all event listeners from dataChannel
- Frees WASM Host
- Clears peer cache
- Closes dataChannel if open

**Safe to call multiple times (idempotent).**

**Example:**
```js
import { BrowserENetClient } from "@alfianrafli/growtopia.wasm/browser";

const client = new BrowserENetClient(1, 2);

// Setup WebRTC DataChannel
const pc = new RTCPeerConnection();
const dc = pc.createDataChannel("enet");

client.attachDataChannel(dc);
client.startPolling(15);

client.emitter.on("connect", peer => {
  console.log("Connected via WebRTC!");
});

// Cleanup
client.destroy();
```

---

### Peer API

#### `Peer`

Wrapper around an ENet peer connection.

**Properties:**
- `id: number` - Peer ID
- `ip: string` - Remote IP address
- `port: number` - Remote port number
- `rtt: number` - Round-trip time in milliseconds

**Methods:**

##### `send(packet: Packet): void`
Sends an ENet packet to this peer.

**Parameters:**
- `packet`: Packet instance (created with `new Packet(data, kind)`)

##### `disconnect(data?: number): void`
Initiates a graceful disconnect.

**Parameters:**
- `data`: Optional disconnect reason code (default: `0`)

##### `disconnectNow(data?: number): void`
Immediately disconnects without waiting for acknowledgment.

##### `disconnectLater(data?: number): void`
Disconnects after all queued packets are sent.

##### `reset(): void`
Forcefully resets the connection without notification.

**Example:**
```js
server.emitter.on("connect", peer => {
  console.log(`Peer ID: ${peer.id}`);
  console.log(`IP: ${peer.ip}:${peer.port}`);
  console.log(`RTT: ${peer.rtt}ms`);
  
  const packet = new Packet(new Uint8Array([1, 2, 3]), PacketKind.Reliable);
  peer.send(packet);
  
  // Disconnect after 5 seconds
  setTimeout(() => peer.disconnect(0), 5000);
});
```

---

### Packet API

#### `Packet`

Represents an ENet packet.

**Constructor:**
```ts
constructor(data: Uint8Array, kind: PacketKind)
```

**Parameters:**
- `data`: Packet payload as Uint8Array
- `kind`: Packet delivery kind (see `PacketKind` enum)

**Methods:**

##### `data(): Uint8Array`
Returns the packet payload.

##### `free(): void`
Frees the packet memory. **Important:** Call this after processing received packets if `autoFreePacket` is disabled.

**Example:**
```js
import { Packet, PacketKind } from "@alfianrafli/growtopia.wasm";

const payload = new Uint8Array([1, 0, 0, 0, 0]);
const packet = new Packet(payload, PacketKind.Reliable);

peer.send(packet);
```

#### `PacketKind` (enum)

- `PacketKind.Reliable` - Guaranteed delivery, ordered
- `PacketKind.Unreliable` - No delivery guarantee
- `PacketKind.UnreliableFragment` - Unreliable, fragmented
- `PacketKind.ReliableFragment` - Reliable, fragmented

---

### Packet Serialization

#### `TextPacket`

Represents Growtopia text-based packets (action packets, login).

**Static Methods:**

##### `TextPacket.from(type: number, data: string, extra?: string): TextPacket`
Creates a TextPacket from raw data.

**Parameters:**
- `type`: Packet type (typically `3` for action packets)
- `data`: Main payload string
- `extra`: Optional extra data string

##### `parse(): Uint8Array`
Serializes the TextPacket into a Uint8Array buffer.

**Example:**
```js
import { TextPacket } from "@alfianrafli/growtopia.wasm";

const textPacket = TextPacket.from(3, "action|refresh_item_data", "");
const buffer = textPacket.parse();

const packet = new Packet(buffer, PacketKind.Reliable);
peer.send(packet);
```

---

#### `TankPacket`

Represents Growtopia tank packets (state/motion packets).

**Static Methods:**

##### `TankPacket.from(options: Tank): TankPacket`
Creates a TankPacket from options.

**Parameters:**
- `options`: Tank packet fields (see `Tank` interface below)

##### `parse(): Uint8Array`
Serializes the TankPacket into a Uint8Array buffer.

**Tank Interface:**
```ts
interface Tank {
  packetType?: number;
  type?: number;
  punchID?: number;
  buildRange?: number;
  punchRange?: number;
  netID?: number;
  targetNetID?: number;
  state?: number;
  info?: number;
  xPos?: number;
  yPos?: number;
  xSpeed?: number;
  ySpeed?: number;
  xPunch?: number;
  yPunch?: number;
  data?: () => Buffer;
}
```

**Example:**
```js
import { TankPacket } from "@alfianrafli/growtopia.wasm";

const tankPacket = TankPacket.from({
  type: 0x3,
  netID: 10,
  xPos: 100.5,
  yPos: 200.25
});

const buffer = tankPacket.parse();
const packet = new Packet(buffer, PacketKind.Reliable);
peer.send(packet);
```

---

#### `Variant`

Represents Growtopia variant list packets.

**Static Methods:**

##### `Variant.from(options: VariantOptions, functionName: string, ...args: VariantArg[]): Variant`
Creates a Variant packet.

**Parameters:**
- `options`: Variant options (`netID`, `delay`)
- `functionName`: Variant function name (e.g., `"OnConsoleMessage"`)
- `args`: Variant arguments (string, number, or number[])

##### `parse(): TankPacket`
Serializes the Variant into a TankPacket.

**VariantOptions Interface:**
```ts
interface VariantOptions {
  netID?: number;   // Target netID (default: -1)
  delay?: number;   // Delay in ms before execution on client
}
```

**Example:**
```js
import { Variant } from "@alfianrafli/growtopia.wasm";

const variant = Variant.from(
  { netID: 1, delay: 0 },
  "OnConsoleMessage",
  "Hello Growtopia!"
);

const tankPacket = variant.parse();
const buffer = tankPacket.parse();
const packet = new Packet(buffer, PacketKind.Reliable);
peer.send(packet);
```

---

### Utilities

#### `Collection<K, V>`

Generic Map wrapper with additional utility methods.

**Methods:**
- `set(key: K, value: V): void`
- `get(key: K): V | undefined`
- `has(key: K): boolean`
- `delete(key: K): boolean`
- `clear(): void`
- `size: number`
- `forEach(fn: (value: V, key: K) => void): void`
- `map<T>(fn: (value: V, key: K) => T): T[]`
- `filter(fn: (value: V, key: K) => boolean): V[]`
- `find(fn: (value: V, key: K) => boolean): V | undefined`

---

#### `ExtendBuffer`

Extended Buffer utility with additional read/write methods for Growtopia packet structures.

---

#### `crc32(data: Uint8Array): number`

Computes CRC32 checksum.

---

#### `timeSinceEpoch(): number`

Returns current Unix timestamp in milliseconds.

---

#### `mtuMax: number`

Maximum MTU size constant.

---

## Lifecycle & Resource Management

### Initialization

1. **Always call `init()` before instantiating any ENet hosts:**
   ```js
   await init();
   ```

2. **In Node.js/Bun, WASM is auto-initialized on import for synchronous APIs like `NodeENetServer`**

### Event Handling

3. **Subscribe to events using `emitter.on()`:**
   ```js
   server.emitter.on("connect", peer => { /* ... */ });
   server.emitter.on("disconnect", (peer, data) => { /* ... */ });
   server.emitter.on("receive", (peer, packet, channelId) => { /* ... */ });
   ```

4. **Start polling to process events:**
   ```js
   server.startPolling(15);
   ```

### Cleanup

5. **Always call `destroy()` when done:**
   ```js
   server.destroy();
   ```

   **What `destroy()` does:**
   - **Node.js:** Stops polling, closes UDP socket, clears peer cache
   - **Browser:** Stops polling, removes dataChannel listeners, closes dataChannel, frees WASM Host, clears peer cache

6. **`destroy()` is idempotent** - safe to call multiple times

7. **After `destroy()`, the host instance cannot be reused. Create a new instance if needed.**

### Packet Memory Management

8. **Packets are auto-freed by default** when using `startPolling()` with `autoFreePacket: true` (default)

9. **Manual packet freeing** (if `autoFreePacket: false`):
   ```js
   server.emitter.on("receive", (peer, packet, channelId) => {
     const data = packet.data();
     // ... process data ...
     packet.free(); // Free packet memory manually
   });
   ```

### Best Practices

- **Don't reuse destroyed hosts** - always create new instances
- **Call `destroy()` in cleanup handlers** (e.g., `process.on('SIGINT')`, `window.onbeforeunload`)
- **For Browser API:** Attach dataChannel before starting polling
- **For Browser API:** Ensure dataChannel is open before calling `connect()` or sending packets

---

## Environment Support

| Environment | Supported | API |
|-------------|-----------|-----|
| Node.js ≥ 10 | ✅ Yes | `@alfianrafli/growtopia.wasm` |
| Bun.js | ✅ Yes | `@alfianrafli/growtopia.wasm` |
| Browser (WebRTC) | ✅ Yes | `@alfianrafli/growtopia.wasm/browser` |
| Deno | ⚠️ Untested | - |

**Platform:**
- Windows ✅
- Linux ✅
- macOS ✅
- Android (Node.js/Bun) ✅

---

## Links

- **npm Package:** [npmjs.com/package/@alfianrafli/growtopia.wasm](https://npmjs.com/package/@alfianrafli/growtopia.wasm)
- **Repository:** [github.com/AlfianRafli/growtopia.wasm-ng](https://github.com/AlfianRafli/growtopia.wasm-ng)
- **Issues:** [github.com/AlfianRafli/growtopia.wasm-ng/issues](https://github.com/AlfianRafli/growtopia.wasm-ng/issues)
- **Discord Community:** [discord.gg/sGrxfKZY5t](https://discord.gg/sGrxfKZY5t)

---

## License & Credits

This project is open-source software licensed under the [MIT License](LICENSE).

**This project is based on and derived from the original [growtopia.wasm](https://github.com/StileDevs/growtopia.wasm) project by [StileDevs](https://github.com/StileDevs).** Massive thanks to them for laying the foundation.

All modifications and current maintenance by [Rafli](https://github.com/AlfianRafli).
