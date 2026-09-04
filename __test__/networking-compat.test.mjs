/**
 * Phase 2: ENET Networking Compatibility Tests
 * 
 * Verifies networking parity between growtopia.js and growtopia.wasm-ng:
 * - Host lifecycle (create, bind, service, flush, destroy)
 * - Peer lifecycle (connect, disconnect, state, cleanup)
 * - Packet send/receive across channels
 * - Broadcast
 * - Multiple peers
 * - Error handling and cleanup
 */

import test from "ava";
import { init, NodeENetServer, NodeENetClient, Packet, PacketKind } from "../dist/index.mjs";

// Use non-conflicting port range
let portCounter = 32000;
function getPort() {
  return portCounter++;
}

test.before(async () => {
  await init();
});

const TEST_TIMEOUT = 8000;

// Helper: Wait for event with timeout
function waitForEvent(emitter, eventName, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for ${eventName}`));
    }, timeout);
    
    emitter.on(eventName, (...args) => {
      clearTimeout(timer);
      resolve(args);
    });
  });
}

// ============================================================================
// Host Lifecycle Tests
// ============================================================================

test("Host: create and destroy", async (t) => {
  t.timeout(TEST_TIMEOUT);
  const port = getPort();
  const server = new NodeENetServer("127.0.0.1", port, 10, 2);
  const client = new NodeENetClient("0.0.0.0", 0, 1, 2);
  
  await server.start();
  await client.start();
  
  t.truthy(server.host, "Server host should exist");
  t.truthy(client.host, "Client host should exist");
  t.is(typeof server.host.id, "number");
  t.is(typeof client.host.id, "number");
  t.not(server.host.id, client.host.id, "Host IDs should be unique");
  
  server.destroy();
  client.destroy();
  t.pass();
});

test("Host: peerLimit and channelLimit", async (t) => {
  t.timeout(TEST_TIMEOUT);
  const port = getPort();
  const server = new NodeENetServer("127.0.0.1", port, 5, 3);
  await server.start();
  
  t.is(server.host.peerLimit(), 5);
  t.is(server.host.channelLimit(), 3);
  
  server.destroy();
  t.pass();
});

test("Host: service() returns Event object", async (t) => {
  t.timeout(TEST_TIMEOUT);
  const port = getPort();
  const server = new NodeENetServer("127.0.0.1", port, 10, 2);
  await server.start();
  
  const event = server.host.service();
  t.truthy(event, "service() should return Event");
  t.is(typeof event.eventType, "number");
  t.is(event.eventType, 0, "No events should return eventType 0");
  
  server.destroy();
  t.pass();
});

test("Host: repeated destroy() is safe", async (t) => {
  t.timeout(TEST_TIMEOUT);
  const port = getPort();
  const server = new NodeENetServer("127.0.0.1", port, 10, 2);
  await server.start();
  
  t.notThrows(() => {
    server.destroy();
    server.destroy();
    server.destroy();
  });
  t.pass();
});

// ============================================================================
// Peer Connection Tests
// ============================================================================

test("Peer: connect event", async (t) => {
  t.timeout(TEST_TIMEOUT);
  const port = getPort();
  const server = new NodeENetServer("127.0.0.1", port, 10, 2);
  const client = new NodeENetClient("0.0.0.0", 0, 1, 2);
  
  await server.start();
  await client.start();
  server.startPolling();
  client.startPolling();
  
  const connectPromise = waitForEvent(server.emitter, "connect");
  client.connect("127.0.0.1", port, 2, 0);
  
  const [peer] = await connectPromise;
  t.truthy(peer, "Connect event should provide peer");
  t.is(typeof peer.id, "number");
  
  server.stopPolling();
  client.stopPolling();
  server.destroy();
  client.destroy();
  t.pass();
});

test("Peer: disconnect event", async (t) => {
  t.timeout(TEST_TIMEOUT);
  const port = getPort();
  const server = new NodeENetServer("127.0.0.1", port, 10, 2);
  const client = new NodeENetClient("0.0.0.0", 0, 1, 2);
  
  await server.start();
  await client.start();
  server.startPolling();
  client.startPolling();
  
  const connectPromise = waitForEvent(server.emitter, "connect");
  const clientPeer = client.connect("127.0.0.1", port, 2, 0);
  const [serverPeer] = await connectPromise;
  
  const disconnectPromise = waitForEvent(server.emitter, "disconnect");
  clientPeer.disconnect(0);
  
  const [disconnectedPeer, data] = await disconnectPromise;
  t.is(disconnectedPeer.id, serverPeer.id);
  t.is(typeof data, "number");
  
  server.stopPolling();
  client.stopPolling();
  server.destroy();
  client.destroy();
  t.pass();
});

test("Peer: properties (ip, port, rtt)", async (t) => {
  t.timeout(TEST_TIMEOUT);
  const port = getPort();
  const server = new NodeENetServer("127.0.0.1", port, 10, 2);
  const client = new NodeENetClient("0.0.0.0", 0, 1, 2);
  
  await server.start();
  await client.start();
  server.startPolling();
  client.startPolling();
  
  const connectPromise = waitForEvent(server.emitter, "connect");
  client.connect("127.0.0.1", port, 2, 0);
  const [peer] = await connectPromise;
  
  t.is(typeof peer.ip, "string");
  t.is(typeof peer.port, "number");
  t.is(typeof peer.rtt, "number");
  t.true(peer.ip === "127.0.0.1" || peer.ip.includes("127"));
  
  server.stopPolling();
  client.stopPolling();
  server.destroy();
  client.destroy();
  t.pass();
});

test("Peer: connected state", async (t) => {
  t.timeout(TEST_TIMEOUT);
  const port = getPort();
  const server = new NodeENetServer("127.0.0.1", port, 10, 2);
  const client = new NodeENetClient("0.0.0.0", 0, 1, 2);
  
  await server.start();
  await client.start();
  server.startPolling();
  client.startPolling();
  
  const connectPromise = waitForEvent(server.emitter, "connect");
  client.connect("127.0.0.1", port, 2, 0);
  const [peer] = await connectPromise;
  
  t.true(peer.host.peerConnected(peer.id));
  
  server.stopPolling();
  client.stopPolling();
  server.destroy();
  client.destroy();
  t.pass();
});

// ============================================================================
// Packet Send/Receive Tests
// ============================================================================

test("Packet: client to server", async (t) => {
  t.timeout(TEST_TIMEOUT);
  const port = getPort();
  const server = new NodeENetServer("127.0.0.1", port, 10, 2);
  const client = new NodeENetClient("0.0.0.0", 0, 1, 2);
  
  await server.start();
  await client.start();
  server.startPolling(15, { autoFreePacket: false });
  client.startPolling();
  
  const connectPromise = waitForEvent(server.emitter, "connect");
  const clientPeer = client.connect("127.0.0.1", port, 2, 0);
  await connectPromise;
  
  const receivePromise = waitForEvent(server.emitter, "receive");
  const testData = new Uint8Array([1, 2, 3, 4, 5]);
  clientPeer.sendRaw(testData, 0);
  
  const [peer, packet, channel] = await receivePromise;
  t.truthy(peer);
  t.truthy(packet);
  t.is(channel, 0);
  
  packet.free();
  
  server.stopPolling();
  client.stopPolling();
  server.destroy();
  client.destroy();
  t.pass();
});

test("Packet: server to client", async (t) => {
  t.timeout(TEST_TIMEOUT);
  const port = getPort();
  const server = new NodeENetServer("127.0.0.1", port, 10, 2);
  const client = new NodeENetClient("0.0.0.0", 0, 1, 2);
  
  await server.start();
  await client.start();
  server.startPolling();
  client.startPolling(15, { autoFreePacket: false });
  
  const connectPromise = waitForEvent(server.emitter, "connect");
  const clientPeer = client.connect("127.0.0.1", port, 2, 0);
  const [serverPeer] = await connectPromise;
  
  const receivePromise = waitForEvent(client.emitter, "receive");
  const testData = new Uint8Array([10, 20, 30]);
  serverPeer.sendRaw(testData, 0);
  
  const [, packet] = await receivePromise;
  t.truthy(packet);
  
  packet.free();
  
  server.stopPolling();
  client.stopPolling();
  server.destroy();
  client.destroy();
  t.pass();
});

test("Packet: different channels", async (t) => {
  t.timeout(TEST_TIMEOUT);
  const port = getPort();
  const server = new NodeENetServer("127.0.0.1", port, 10, 2);
  const client = new NodeENetClient("0.0.0.0", 0, 1, 2);
  
  await server.start();
  await client.start();
  server.startPolling(15, { autoFreePacket: false });
  client.startPolling();
  
  const connectPromise = waitForEvent(server.emitter, "connect");
  const clientPeer = client.connect("127.0.0.1", port, 2, 0);
  await connectPromise;
  
  const receivePromise = waitForEvent(server.emitter, "receive");
  clientPeer.sendRaw(new Uint8Array([1, 2]), 1); // Channel 1
  
  const [, , channel] = await receivePromise;
  t.is(channel, 1);
  
  server.stopPolling();
  client.stopPolling();
  server.destroy();
  client.destroy();
  t.pass();
});

// ============================================================================
// Multiple Peers Tests
// ============================================================================

test("Multiple peers: two clients", async (t) => {
  t.timeout(TEST_TIMEOUT);
  const port = getPort();
  const server = new NodeENetServer("127.0.0.1", port, 10, 2);
  const client1 = new NodeENetClient("0.0.0.0", 0, 1, 2);
  const client2 = new NodeENetClient("0.0.0.0", 0, 1, 2);
  
  await server.start();
  await client1.start();
  await client2.start();
  
  server.startPolling();
  client1.startPolling();
  client2.startPolling();
  
  const peers = [];
  const connectPromise = new Promise((resolve) => {
    let count = 0;
    server.emitter.on("connect", (peer) => {
      peers.push(peer);
      count++;
      if (count === 2) resolve();
    });
  });
  
  client1.connect("127.0.0.1", port, 2, 0);
  client2.connect("127.0.0.1", port, 2, 0);
  
  await connectPromise;
  
  t.is(peers.length, 2);
  t.not(peers[0].id, peers[1].id);
  
  server.stopPolling();
  client1.stopPolling();
  client2.stopPolling();
  server.destroy();
  client1.destroy();
  client2.destroy();
  t.pass();
});

test("Multiple peers: three clients", async (t) => {
  t.timeout(TEST_TIMEOUT);
  const port = getPort();
  const server = new NodeENetServer("127.0.0.1", port, 10, 2);
  const clients = [
    new NodeENetClient("0.0.0.0", 0, 1, 2),
    new NodeENetClient("0.0.0.0", 0, 1, 2),
    new NodeENetClient("0.0.0.0", 0, 1, 2)
  ];
  
  await server.start();
  for (const c of clients) await c.start();
  
  server.startPolling();
  for (const c of clients) c.startPolling();
  
  const peers = [];
  const connectPromise = new Promise((resolve) => {
    let count = 0;
    server.emitter.on("connect", (peer) => {
      peers.push(peer);
      count++;
      if (count === 3) resolve();
    });
  });
  
  for (const c of clients) c.connect("127.0.0.1", port, 2, 0);
  
  await connectPromise;
  
  t.is(peers.length, 3);
  // All peer IDs should be unique
  const ids = peers.map(p => p.id);
  t.not(ids[0], ids[1]);
  t.not(ids[1], ids[2]);
  t.not(ids[0], ids[2]);
  
  server.stopPolling();
  for (const c of clients) c.stopPolling();
  server.destroy();
  for (const c of clients) c.destroy();
  t.pass();
});

// ============================================================================
// Broadcast Tests
// ============================================================================

test("Broadcast: to all peers", async (t) => {
  t.timeout(TEST_TIMEOUT);
  const port = getPort();
  const server = new NodeENetServer("127.0.0.1", port, 10, 2);
  const client1 = new NodeENetClient("0.0.0.0", 0, 1, 2);
  const client2 = new NodeENetClient("0.0.0.0", 0, 1, 2);
  
  await server.start();
  await client1.start();
  await client2.start();
  
  server.startPolling();
  client1.startPolling(15, { autoFreePacket: false });
  client2.startPolling(15, { autoFreePacket: false });
  
  // Connect both clients
  const connectPromise = new Promise((resolve) => {
    let count = 0;
    server.emitter.on("connect", () => {
      count++;
      if (count === 2) resolve();
    });
  });
  
  client1.connect("127.0.0.1", port, 2, 0);
  client2.connect("127.0.0.1", port, 2, 0);
  await connectPromise;
  
  // Broadcast from server
  const receive1 = waitForEvent(client1.emitter, "receive");
  const receive2 = waitForEvent(client2.emitter, "receive");
  
  const packet = new Packet(new Uint8Array([99, 88]), PacketKind.Reliable);
  server.host.broadcast(0, packet);
  
  const [, p1] = await receive1;
  const [, p2] = await receive2;
  
  t.truthy(p1);
  t.truthy(p2);
  
  p1.free();
  p2.free();
  
  server.stopPolling();
  client1.stopPolling();
  client2.stopPolling();
  server.destroy();
  client1.destroy();
  client2.destroy();
  t.pass();
});

// ============================================================================
// Cleanup Tests
// ============================================================================

test("Cleanup: disconnect clears peer cache", async (t) => {
  t.timeout(TEST_TIMEOUT);
  const port = getPort();
  const server = new NodeENetServer("127.0.0.1", port, 10, 2);
  const client = new NodeENetClient("0.0.0.0", 0, 1, 2);
  
  await server.start();
  await client.start();
  server.startPolling();
  client.startPolling();
  
  const connectPromise = waitForEvent(server.emitter, "connect");
  const clientPeer = client.connect("127.0.0.1", port, 2, 0);
  await connectPromise;
  
  t.is(server.cache.peers.size, 1);
  
  const disconnectPromise = waitForEvent(server.emitter, "disconnect");
  clientPeer.disconnect(0);
  await disconnectPromise;
  
  t.is(server.cache.peers.size, 0);
  
  server.stopPolling();
  client.stopPolling();
  server.destroy();
  client.destroy();
  t.pass();
});

test("Cleanup: destroy stops polling", async (t) => {
  t.timeout(TEST_TIMEOUT);
  const port = getPort();
  const server = new NodeENetServer("127.0.0.1", port, 10, 2);
  await server.start();
  
  server.startPolling();
  t.truthy(server.timer, "Timer should be set");
  
  server.destroy();
  t.falsy(server.timer, "Timer should be cleared after destroy");
  t.pass();
});

// ============================================================================
// Edge Cases
// ============================================================================

test("Edge case: empty packet", async (t) => {
  t.timeout(TEST_TIMEOUT);
  const port = getPort();
  const server = new NodeENetServer("127.0.0.1", port, 10, 2);
  const client = new NodeENetClient("0.0.0.0", 0, 1, 2);
  
  await server.start();
  await client.start();
  server.startPolling(15, { autoFreePacket: false });
  client.startPolling();
  
  const connectPromise = waitForEvent(server.emitter, "connect");
  const clientPeer = client.connect("127.0.0.1", port, 2, 0);
  await connectPromise;
  
  const receivePromise = waitForEvent(server.emitter, "receive");
  clientPeer.sendRaw(new Uint8Array([]), 0);
  
  const [, packet] = await receivePromise;
  t.truthy(packet, "Empty packet should be received");
  
  packet.free();
  
  server.stopPolling();
  client.stopPolling();
  server.destroy();
  client.destroy();
  t.pass();
});

test("Edge case: ping", async (t) => {
  t.timeout(TEST_TIMEOUT);
  const port = getPort();
  const server = new NodeENetServer("127.0.0.1", port, 10, 2);
  const client = new NodeENetClient("0.0.0.0", 0, 1, 2);
  
  await server.start();
  await client.start();
  server.startPolling();
  client.startPolling();
  
  const connectPromise = waitForEvent(server.emitter, "connect");
  client.connect("127.0.0.1", port, 2, 0);
  const [peer] = await connectPromise;
  
  t.notThrows(() => peer.ping());
  
  server.stopPolling();
  client.stopPolling();
  server.destroy();
  client.destroy();
  t.pass();
});
