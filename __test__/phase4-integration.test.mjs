/**
 * Phase 4: Client/Server Integration Tests
 * 
 * Comprehensive end-to-end integration testing:
 * - Real UDP socket communication
 * - Full lifecycle: create → connect → send → receive → disconnect → destroy
 * - Cross-module integration (Client + Server + Peer + Packets)
 * - Error handling and edge cases
 * - Actual network packet flow verification
 */

import test from "ava";
import { init, NodeENetServer, NodeENetClient, TextPacket, TankPacket, Variant } from "../dist/index.mjs";
import { createSocket } from "dgram";

let portCounter = 33000;
function getPort() {
  return portCounter++;
}

test.before(async () => {
  await init();
});

const TEST_TIMEOUT = 10000;

// Helper: Wait for event
function waitForEvent(emitter, eventName, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for ${eventName}`));
    }, timeout);
    
    const unbind = emitter.on(eventName, (...args) => {
      clearTimeout(timer);
      unbind();
      resolve(args);
    });
  });
}

// ============================================================================
// UDP Socket Verification
// ============================================================================

test("UDP: Real socket binding verification", async (t) => {
  t.timeout(TEST_TIMEOUT);
  const port = getPort();
  const server = new NodeENetServer("127.0.0.1", port, 10, 2);
  
  await server.start();
  
  // Verify socket is actually bound by attempting to bind another socket to same port
  const testSocket = createSocket("udp4");
  
  await t.throwsAsync(
    () => new Promise((resolve, reject) => {
      testSocket.once("error", reject);
      testSocket.bind(port, "127.0.0.1", () => {
        testSocket.close();
        resolve();
      });
    }),
    { message: /EADDRINUSE|address already in use/i },
    "Port should be in use by server"
  );
  
  server.destroy();
  
  // After destroy, port should be available
  await new Promise((resolve) => {
    setTimeout(resolve, 100); // Give OS time to release port
  });
  
  await t.notThrowsAsync(
    () => new Promise((resolve, reject) => {
      const verifySocket = createSocket("udp4");
      verifySocket.once("error", reject);
      verifySocket.bind(port, "127.0.0.1", () => {
        verifySocket.close();
        resolve();
      });
    }),
    "Port should be available after destroy"
  );
  
  t.pass();
});

test("UDP: Actual packet flow verification", async (t) => {
  t.timeout(TEST_TIMEOUT);
  const port = getPort();
  const server = new NodeENetServer("127.0.0.1", port, 10, 2);
  const client = new NodeENetClient("0.0.0.0", 0, 1, 2);
  
  await server.start();
  await client.start();
  
  server.startPolling(15, { autoFreePacket: false });
  client.startPolling();
  
  // Verify actual packet flow by checking receive event
  const connectPromise = waitForEvent(server.emitter, "connect");
  const clientPeer = client.connect("127.0.0.1", port, 2, 0);
  const [serverPeer] = await connectPromise;
  
  // Send actual packet and verify it arrives
  const receivePromise = waitForEvent(server.emitter, "receive");
  const testPacket = TextPacket.from(1, "udp_flow_test").parse();
  clientPeer.sendRaw(testPacket, 0);
  
  const [, packet, channel] = await receivePromise;
  t.truthy(packet, "Packet should be received via UDP");
  t.is(channel, 0, "Packet should arrive on channel 0");
  
  const data = packet.data();
  t.truthy(data, "Packet data should exist");
  const parsed = TextPacket.fromBuffer(Buffer.from(data));
  t.is(parsed.strings[0], "udp_flow_test", "Packet content should match");
  
  packet.free();
  
  server.stopPolling();
  client.stopPolling();
  server.destroy();
  client.destroy();
  t.pass();
});

// ============================================================================
// End-to-End Integration: Full Lifecycle
// ============================================================================

test("Integration: Full lifecycle with TextPacket", async (t) => {
  t.timeout(TEST_TIMEOUT);
  const port = getPort();
  const server = new NodeENetServer("127.0.0.1", port, 10, 2);
  const client = new NodeENetClient("0.0.0.0", 0, 1, 2);
  
  await server.start();
  await client.start();
  
  server.startPolling(15, { autoFreePacket: false });
  client.startPolling(15, { autoFreePacket: false });
  
  // Step 1: Connect
  const connectPromise = waitForEvent(server.emitter, "connect");
  const clientPeer = client.connect("127.0.0.1", port, 2, 0);
  const [serverPeer] = await connectPromise;
  
  t.truthy(serverPeer);
  t.is(typeof serverPeer.id, "number");
  
  // Step 2: Client sends TextPacket to server
  const serverReceivePromise = waitForEvent(server.emitter, "receive");
  const textPacket = TextPacket.from(3, "action|refresh_item_data", "");
  const textBuf = textPacket.parse();
  clientPeer.sendRaw(textBuf, 0);
  
  const [, packet1, channel1] = await serverReceivePromise;
  t.is(channel1, 0);
  t.truthy(packet1);
  
  // Verify packet content
  const received1 = packet1.data();
  t.truthy(received1);
  const parsed1 = TextPacket.fromBuffer(Buffer.from(received1));
  t.is(parsed1.type, 3);
  t.is(parsed1.strings[0], "action|refresh_item_data");
  
  packet1.free();
  
  // Step 3: Server responds with TankPacket
  const clientReceivePromise = waitForEvent(client.emitter, "receive");
  const tankPacket = TankPacket.from({
    type: 0x1,
    netID: serverPeer.id,
    xPos: 100.5,
    yPos: 200.25
  });
  const tankBuf = tankPacket.parse();
  serverPeer.sendRaw(tankBuf, 0);
  
  const [, packet2] = await clientReceivePromise;
  const received2 = packet2.data();
  const parsed2 = TankPacket.fromBuffer(Buffer.from(received2));
  t.is(parsed2.data.type, 0x1);
  t.is(parsed2.data.xPos, 100.5);
  t.is(parsed2.data.yPos, 200.25);
  
  packet2.free();
  
  // Step 4: Disconnect
  const disconnectPromise = waitForEvent(server.emitter, "disconnect");
  clientPeer.disconnect(0);
  await disconnectPromise;
  
  // Step 5: Cleanup
  server.stopPolling();
  client.stopPolling();
  server.destroy();
  client.destroy();
  
  t.pass();
});

test("Integration: Full lifecycle with Variant", async (t) => {
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
  const [serverPeer] = await connectPromise;
  
  // Client sends Variant
  const serverReceivePromise = waitForEvent(server.emitter, "receive");
  const variant = Variant.from({ netID: 1, delay: 0 }, "OnConsoleMessage", "Hello from client!");
  const variantTank = variant.parse();
  const variantBuf = variantTank.parse();
  clientPeer.sendRaw(variantBuf, 0);
  
  const [, packet] = await serverReceivePromise;
  const received = packet.data();
  
  // Parse as TankPacket first
  const tankParsed = TankPacket.fromBuffer(Buffer.from(received));
  t.is(tankParsed.data.type, 0x1); // Variant uses type 0x1
  
  // Parse Variant from TankPacket data
  const variantArray = Variant.toArray(Buffer.from(received));
  t.is(variantArray.length, 2);
  t.is(variantArray[0].value, "OnConsoleMessage");
  t.is(variantArray[1].value, "Hello from client!");
  
  packet.free();
  
  server.stopPolling();
  client.stopPolling();
  server.destroy();
  client.destroy();
  t.pass();
});

test("Integration: Multiple clients with cross-communication", async (t) => {
  t.timeout(TEST_TIMEOUT);
  const port = getPort();
  const server = new NodeENetServer("127.0.0.1", port, 10, 2);
  const client1 = new NodeENetClient("0.0.0.0", 0, 1, 2);
  const client2 = new NodeENetClient("0.0.0.0", 0, 1, 2);
  
  await server.start();
  await client1.start();
  await client2.start();
  
  server.startPolling(15, { autoFreePacket: false });
  client1.startPolling(15, { autoFreePacket: false });
  client2.startPolling(15, { autoFreePacket: false });
  
  // Both clients connect
  const peers = [];
  const connectPromise = new Promise((resolve) => {
    let count = 0;
    server.emitter.on("connect", (peer) => {
      peers.push(peer);
      count++;
      if (count === 2) resolve();
    });
  });
  
  const c1peer = client1.connect("127.0.0.1", port, 2, 0);
  const c2peer = client2.connect("127.0.0.1", port, 2, 0);
  await connectPromise;
  
  t.is(peers.length, 2);
  
  // Server sends different messages to each client
  const c1ReceivePromise = waitForEvent(client1.emitter, "receive");
  const c2ReceivePromise = waitForEvent(client2.emitter, "receive");
  
  const msg1 = TextPacket.from(2, "message_for_client1").parse();
  const msg2 = TextPacket.from(2, "message_for_client2").parse();
  
  peers[0].sendRaw(msg1, 0);
  peers[1].sendRaw(msg2, 0);
  
  const [, p1] = await c1ReceivePromise;
  const [, p2] = await c2ReceivePromise;
  
  const d1 = TextPacket.fromBuffer(Buffer.from(p1.data()));
  const d2 = TextPacket.fromBuffer(Buffer.from(p2.data()));
  
  // Verify each client receives a message (order may vary due to async)
  t.true(
    (d1.strings[0] === "message_for_client1" && d2.strings[0] === "message_for_client2") ||
    (d1.strings[0] === "message_for_client2" && d2.strings[0] === "message_for_client1"),
    "Each client should receive one of the two messages"
  );
  
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
// Error Handling & Edge Cases
// ============================================================================

test("Error: Connection to non-existent server", async (t) => {
  t.timeout(TEST_TIMEOUT);
  const client = new NodeENetClient("0.0.0.0", 0, 1, 2);
  
  await client.start();
  client.startPolling();
  
  // Connect to a port where no server is listening
  const nonExistentPort = 59999;
  const peer = client.connect("127.0.0.1", nonExistentPort, 2, 0);
  
  // Connection should not throw but peer may not receive connect event
  t.truthy(peer);
  
  // Wait a bit to see if any error event fires
  await new Promise(resolve => setTimeout(resolve, 500));
  
  client.stopPolling();
  client.destroy();
  t.pass();
});

test("Error: Invalid packet data handling", async (t) => {
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
  
  // Send malformed data
  const serverReceivePromise = waitForEvent(server.emitter, "receive");
  const invalidData = new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF]);
  clientPeer.sendRaw(invalidData, 0);
  
  const [, packet] = await serverReceivePromise;
  t.truthy(packet);
  
  // Packet is received even if content is invalid
  const data = packet.data();
  t.truthy(data);
  t.is(data.length, 4);
  
  packet.free();
  
  server.stopPolling();
  client.stopPolling();
  server.destroy();
  client.destroy();
  t.pass();
});

test("Error: Disconnect before connect complete", async (t) => {
  t.timeout(TEST_TIMEOUT);
  const port = getPort();
  const server = new NodeENetServer("127.0.0.1", port, 10, 2);
  const client = new NodeENetClient("0.0.0.0", 0, 1, 2);
  
  await server.start();
  await client.start();
  
  server.startPolling();
  client.startPolling();
  
  // Initiate connect but disconnect immediately
  const peer = client.connect("127.0.0.1", port, 2, 0);
  peer.disconnect(0);
  
  // Should not crash
  await new Promise(resolve => setTimeout(resolve, 100));
  
  server.stopPolling();
  client.stopPolling();
  server.destroy();
  client.destroy();
  t.pass();
});

test("Error: Send after disconnect", async (t) => {
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
  
  // Store peer ID before disconnect
  const peerId = serverPeer.id;
  
  const disconnectPromise = waitForEvent(server.emitter, "disconnect");
  clientPeer.disconnect(0);
  await disconnectPromise;
  
  // Attempt to send after disconnect
  // The peer object may still exist but state is disconnected
  // This should not crash - behavior is implementation-dependent
  try {
    // Some implementations may silently fail, others may throw
    // Either is acceptable as long as it doesn't crash
    if (typeof serverPeer.sendRaw === 'function') {
      serverPeer.sendRaw(new Uint8Array([1, 2, 3]), 0);
    }
    t.pass("Send after disconnect did not crash");
  } catch (error) {
    // Throwing an error is also acceptable
    t.pass(`Send after disconnect threw error: ${error.message}`);
  }
  
  server.stopPolling();
  client.stopPolling();
  server.destroy();
  client.destroy();
});

// ============================================================================
// Cross-Module Integration
// ============================================================================

test("Cross-module: All packet types in single session", async (t) => {
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
  
  // Send TextPacket
  let receivePromise = waitForEvent(server.emitter, "receive");
  clientPeer.sendRaw(TextPacket.from(1, "test").parse(), 0);
  let [, p1] = await receivePromise;
  t.is(TextPacket.fromBuffer(Buffer.from(p1.data())).type, 1);
  p1.free();
  
  // Send TankPacket
  receivePromise = waitForEvent(server.emitter, "receive");
  clientPeer.sendRaw(TankPacket.from({ type: 0x5, netID: 42 }).parse(), 0);
  let [, p2] = await receivePromise;
  t.is(TankPacket.fromBuffer(Buffer.from(p2.data())).data.type, 0x5);
  p2.free();
  
  // Send Variant
  receivePromise = waitForEvent(server.emitter, "receive");
  const variant = Variant.from("OnTest", 123);
  clientPeer.sendRaw(variant.parse().parse(), 0);
  let [, p3] = await receivePromise;
  const varArr = Variant.toArray(Buffer.from(p3.data()));
  t.is(varArr[0].value, "OnTest");
  t.is(varArr[1].value, 123);
  p3.free();
  
  server.stopPolling();
  client.stopPolling();
  server.destroy();
  client.destroy();
  t.pass();
});

// ============================================================================
// Real Growtopia Server Testing
// ============================================================================

test("Real Growtopia Server: NOT VERIFIED", (t) => {
  // This test documents that real Growtopia server testing is not performed
  // in this automated test environment
  
  t.log("Real Growtopia server compatibility testing requires:");
  t.log("1. Access to a real Growtopia server instance");
  t.log("2. Known server IP and port");
  t.log("3. Valid login credentials or handshake sequence");
  t.log("4. Protocol-level verification tools");
  t.log("");
  t.log("Status: NOT VERIFIED - No real server available in test environment");
  t.log("Recommendation: Manual testing against real Growtopia server required");
  
  t.pass();
});
