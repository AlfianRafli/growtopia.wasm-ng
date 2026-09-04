/**
 * Event Compatibility Tests
 * 
 * Verifies that growtopia.wasm-ng event API provides full compatibility
 * with growtopia.js event patterns, particularly:
 * - Peer object vs netID compatibility
 * - Event emitter patterns
 * - Event naming
 */

import test from "ava";
import { init, NodeENetServer, NodeENetClient } from "../dist/index.mjs";
import { createSocket } from "dgram";

const PORTS = {
  test1: 27091,
  test2: 27092,
  test3: 27093,
  test4: 27094,
  test5: 27095,
  test6: 27096,
  test7: 27097
};

test.before(async () => {
  await init();
});

// Timeout for each test to prevent hanging
const TEST_TIMEOUT = 10000; // 10 seconds

test("Peer object exposes id property equivalent to netID", async (t) => {
  t.timeout(TEST_TIMEOUT);
  const server = new NodeENetServer("127.0.0.1", PORTS.test1, 10, 2);
  await server.start();
  server.startPolling();

  const client = new NodeENetClient("0.0.0.0", 0, 1, 2);
  await client.start();
  client.startPolling();

  const connectPromise = new Promise((resolve) => {
    server.emitter.on("connect", (peer) => {
      // Verify peer.id is a number (equivalent to netID)
      t.is(typeof peer.id, "number", "peer.id should be a number like netID");
      t.true(peer.id >= 0, "peer.id should be non-negative like netID");
      resolve(peer);
    });
  });

  client.connect("127.0.0.1", PORTS.test1, 2, 0);
  const peer = await connectPromise;

  // Verify peer object has additional capabilities beyond netID
  t.is(typeof peer.send, "function", "Peer should have send() method");
  t.is(typeof peer.sendRaw, "function", "Peer should have sendRaw() method");
  t.is(typeof peer.disconnect, "function", "Peer should have disconnect() method");

  server.stopPolling();
  client.stopPolling();
  server.destroy();
  client.destroy();
  t.pass();
});

test("Event signature: connect event provides peer with id", async (t) => {
  t.timeout(TEST_TIMEOUT);
  const server = new NodeENetServer("127.0.0.1", PORTS.test2, 10, 2);
  await server.start();
  server.startPolling();

  const client = new NodeENetClient("0.0.0.0", 0, 1, 2);
  await client.start();
  client.startPolling();

  const eventPromise = new Promise((resolve) => {
    server.emitter.on("connect", (peer) => {
      // Migration pattern: extract netID from peer
      const netID = peer.id;
      t.is(typeof netID, "number");
      resolve(netID);
    });
  });

  client.connect("127.0.0.1", PORTS.test2, 2, 0);
  const netID = await eventPromise;

  t.is(typeof netID, "number");
  server.stopPolling();
  client.stopPolling();
  server.destroy();
  client.destroy();
});

test("Event signature: disconnect event provides peer with id", async (t) => {
  t.timeout(TEST_TIMEOUT);
  const server = new NodeENetServer("127.0.0.1", PORTS.test3, 10, 2);
  await server.start();
  server.startPolling();

  const client = new NodeENetClient("0.0.0.0", 0, 1, 2);
  await client.start();
  client.startPolling();

  let connectedPeer = null;

  const connectPromise = new Promise((resolve) => {
    server.emitter.on("connect", (peer) => {
      connectedPeer = peer;
      resolve();
    });
  });

  const disconnectPromise = new Promise((resolve) => {
    server.emitter.on("disconnect", (peer, data) => {
      // Verify same peer object with same id
      t.is(peer.id, connectedPeer.id, "Disconnect peer.id should match connected peer.id");
      t.is(typeof data, "number", "Disconnect data should be a number");
      resolve(peer.id);
    });
  });

  const serverPeer = client.connect("127.0.0.1", PORTS.test3, 2, 0);
  await connectPromise;
  
  serverPeer.disconnect(0);
  await disconnectPromise;

  server.stopPolling();
  client.stopPolling();
  server.destroy();
  client.destroy();
  t.pass();
});

test("Event signature: receive event provides peer, packet, channel", async (t) => {
  t.timeout(TEST_TIMEOUT);
  const server = new NodeENetServer("127.0.0.1", PORTS.test4, 10, 2);
  await server.start();
  server.startPolling(15, { autoFreePacket: false });

  const client = new NodeENetClient("0.0.0.0", 0, 1, 2);
  await client.start();
  client.startPolling(15, { autoFreePacket: false });

  let serverPeerInstance = null;

  const connectPromise = new Promise((resolve) => {
    server.emitter.on("connect", (peer) => {
      serverPeerInstance = peer;
      resolve();
    });
  });

  const receivePromise = new Promise((resolve) => {
    server.emitter.on("receive", (peer, packet, channel) => {
      // Verify event signature matches growtopia.js pattern (netID, channel, data)
      // but with peer object instead of netID
      t.is(typeof peer.id, "number", "peer.id should be number (like netID)");
      t.truthy(packet, "packet should be provided");
      t.is(typeof channel, "number", "channel should be number");
      
      // Verify peer is the same instance
      t.is(peer.id, serverPeerInstance.id);
      
      packet.free();
      resolve();
    });
  });

  const clientPeer = client.connect("127.0.0.1", PORTS.test4, 2, 0);
  await connectPromise;

  // Send a test packet (use sendRaw for Uint8Array)
  const testData = new Uint8Array([1, 2, 3, 4, 5]);
  clientPeer.sendRaw(testData, 0);

  await receivePromise;

  server.stopPolling();
  client.stopPolling();
  server.destroy();
  client.destroy();
  t.pass();
});

test("Migration pattern: growtopia.js to growtopia.wasm-ng", async (t) => {
  t.timeout(TEST_TIMEOUT);
  const server = new NodeENetServer("127.0.0.1", PORTS.test5, 10, 2);
  await server.start();
  server.startPolling();

  const client = new NodeENetClient("0.0.0.0", 0, 1, 2);
  await client.start();
  client.startPolling();

  // Simulate growtopia.js migration pattern
  const connectedPeers = new Set();

  const connectPromise = new Promise((resolve) => {
    server.emitter.on("connect", (peer) => {
      // OLD growtopia.js pattern:
      // (netID) => { connectedPeers.add(netID); }
      
      // NEW growtopia.wasm-ng pattern (one-line change):
      const netID = peer.id;
      connectedPeers.add(netID);
      
      t.true(connectedPeers.has(netID), "netID should be tracked");
      resolve();
    });
  });

  const disconnectPromise = new Promise((resolve) => {
    server.emitter.on("disconnect", (peer) => {
      // OLD: (netID) => { connectedPeers.delete(netID); }
      // NEW:
      const netID = peer.id;
      connectedPeers.delete(netID);
      
      t.false(connectedPeers.has(netID), "netID should be removed");
      resolve();
    });
  });

  const serverPeer = client.connect("127.0.0.1", PORTS.test5, 2, 0);
  await connectPromise;
  
  serverPeer.disconnect(0);
  await disconnectPromise;

  server.stopPolling();
  client.stopPolling();
  server.destroy();
  client.destroy();
  t.pass();
});

test("Peer object provides enhanced capabilities over netID", async (t) => {
  t.timeout(TEST_TIMEOUT);
  const server = new NodeENetServer("127.0.0.1", PORTS.test6, 10, 2);
  await server.start();
  server.startPolling();

  const client = new NodeENetClient("0.0.0.0", 0, 1, 2);
  await client.start();
  client.startPolling();

  const connectPromise = new Promise((resolve) => {
    server.emitter.on("connect", (peer) => {
      // With growtopia.js, you only get netID
      // With growtopia.wasm-ng, you get the full Peer object
      
      // Basic compatibility: peer.id
      t.is(typeof peer.id, "number");
      
      // Enhanced capabilities:
      t.is(typeof peer.send, "function");
      t.is(typeof peer.sendRaw, "function");
      t.is(typeof peer.disconnect, "function");
      t.is(typeof peer.rtt, "number", "Peer should have rtt getter");
      t.is(typeof peer.ip, "string", "Peer should have ip getter");
      t.is(typeof peer.port, "number", "Peer should have port getter");
      
      resolve();
    });
  });

  client.connect("127.0.0.1", PORTS.test6, 2, 0);
  await connectPromise;

  server.stopPolling();
  client.stopPolling();
  server.destroy();
  client.destroy();
  t.pass();
});

test("Event emitter pattern compatibility", (t) => {
  const server = new NodeENetServer("127.0.0.1", PORTS.test7, 10, 2);
  
  // Verify emitter exists and has standard event methods
  t.truthy(server.emitter, "Server should have emitter property");
  t.is(typeof server.emitter.on, "function", "emitter should have on() method");
  t.is(typeof server.emitter.emit, "function", "emitter should have emit() method");
  
  // nanoevents provides compatible EventEmitter-like API
  const handler = (peer) => {
    t.is(typeof peer.id, "number");
  };
  
  const unbind = server.emitter.on("connect", handler);
  t.is(typeof unbind, "function", "on() should return unbind function");
  
  // Cleanup
  unbind();
  t.pass();
});
