/**
 * Browser Transport Regression Tests
 * 
 * Tests for:
 * - B1: BrowserENetHost.destroy() idempotent lifecycle
 * - B2: Event listener cleanup on destroy
 * 
 * Uses AVA test runner and imports from main entrypoint
 * where WASM initialization is supported.
 */

import test from 'ava';
import { 
  init, 
  BrowserENetClient, 
  BrowserENetServer,
  BrowserENetHost
} from '../dist/index.mjs';

// Initialize WASM once before running any tests
test.before(async () => {
  await init();
});

// Mock RTCDataChannel for testing in Node.js environment
class MockRTCDataChannel {
  constructor() {
    this.readyState = 'open';
    this.binaryType = 'blob';
    this.listeners = new Map();
    this.sentData = [];
    this.closed = false;
  }

  addEventListener(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
  }

  removeEventListener(event, handler) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(handler);
    }
  }

  send(data) {
    if (this.readyState !== 'open') {
      throw new Error('RTCDataChannel is not open');
    }
    this.sentData.push(data);
  }

  close() {
    this.readyState = 'closed';
    this.closed = true;
    this.dispatchEvent('close', {});
  }

  dispatchEvent(event, data) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(handler => handler({ ...data, type: event }));
    }
  }

  getListenerCount(event) {
    return this.listeners.get(event)?.size || 0;
  }

  getTotalListenerCount() {
    let total = 0;
    for (const [, handlers] of this.listeners) {
      total += handlers.size;
    }
    return total;
  }
}

// ============================================================================
// B1: BrowserENetHost.destroy() Lifecycle Tests
// ============================================================================

test('B1: BrowserENetClient create -> attach -> destroy (immediate)', t => {
  const client = new BrowserENetClient();
  const channel = new MockRTCDataChannel();
  
  t.truthy(client, 'Client created');
  t.truthy(client.host, 'WASM host initialized');
  
  client.attachDataChannel(channel);
  t.is(channel.getListenerCount('message'), 1, 'Message listener attached');
  
  // Destroy immediately
  client.destroy();
  
  t.is(channel.getTotalListenerCount(), 0, 'All listeners removed on destroy');
  t.is(channel.readyState, 'closed', 'Channel closed on destroy');
  t.pass('Immediate destroy completed without crash');
});

test('B1: BrowserENetServer create -> attach -> destroy (immediate)', t => {
  const server = new BrowserENetServer(32, 2);
  const channel = new MockRTCDataChannel();
  
  t.truthy(server, 'Server created');
  t.truthy(server.host, 'WASM host initialized');
  
  server.attachDataChannel(channel);
  t.is(channel.getListenerCount('message'), 1, 'Message listener attached');
  
  // Destroy immediately
  server.destroy();
  
  t.is(channel.getTotalListenerCount(), 0, 'All listeners removed on destroy');
  t.is(channel.readyState, 'closed', 'Channel closed on destroy');
  t.pass('Server immediate destroy completed without crash');
});

test('B1: BrowserENetHost destroy is idempotent (call twice)', t => {
  const client = new BrowserENetClient();
  const channel = new MockRTCDataChannel();
  
  client.attachDataChannel(channel);
  
  // First destroy
  client.destroy();
  t.is(channel.getTotalListenerCount(), 0, 'Listeners cleaned up after first destroy');
  
  // Second destroy - must not throw or crash
  t.notThrows(() => {
    client.destroy();
  }, 'Second destroy call does not throw');
  
  // Third destroy - still safe
  t.notThrows(() => {
    client.destroy();
  }, 'Third destroy call does not throw');
  
  t.pass('Destroy is fully idempotent');
});

test('B1: BrowserENetHost destroy without attached channel', t => {
  const client = new BrowserENetClient();
  
  // Destroy without ever attaching a data channel
  t.notThrows(() => {
    client.destroy();
  }, 'Destroy without channel does not throw');
  
  t.pass('Safe to destroy unattached host');
});

test('B1: BrowserENetHost destroy with polling active', t => {
  const client = new BrowserENetClient();
  const channel = new MockRTCDataChannel();
  
  client.attachDataChannel(channel);
  client.startPolling(50);
  
  // Verify timer is set
  t.truthy(client['timer'], 'Polling timer is active');
  
  // Destroy should stop polling
  client.destroy();
  
  t.is(client['timer'], undefined, 'Polling timer cleared on destroy');
  t.pass('Polling stopped on destroy');
});

// ============================================================================
// B2: Event Listener Cleanup Tests
// ============================================================================

test('B2: attachDataChannel registers exactly 4 listeners', t => {
  const client = new BrowserENetClient();
  const channel = new MockRTCDataChannel();
  
  t.is(channel.getTotalListenerCount(), 0, 'Initial listener count is 0');
  
  client.attachDataChannel(channel);
  
  t.is(channel.getListenerCount('message'), 1, 'message listener registered');
  t.is(channel.getListenerCount('error'), 1, 'error listener registered');
  t.is(channel.getListenerCount('close'), 1, 'close listener registered');
  t.is(channel.getListenerCount('open'), 1, 'open listener registered');
  t.is(channel.getTotalListenerCount(), 4, 'Total 4 listeners registered');
  
  client.destroy();
  t.is(channel.getTotalListenerCount(), 0, 'All 4 listeners removed after destroy');
});

test('B2: multiple attach/destroy cycles do not leak listeners', t => {
  for (let i = 0; i < 5; i++) {
    const client = new BrowserENetClient();
    const channel = new MockRTCDataChannel();
    
    client.attachDataChannel(channel);
    t.is(channel.getTotalListenerCount(), 4, `Cycle ${i}: 4 listeners attached`);
    
    client.destroy();
    t.is(channel.getTotalListenerCount(), 0, `Cycle ${i}: 0 listeners remaining`);
  }
  
  t.pass('No listener leaks across 5 lifecycle cycles');
});

test('B2: channel close event triggers stopPolling', t => {
  const client = new BrowserENetClient();
  const channel = new MockRTCDataChannel();
  
  client.attachDataChannel(channel);
  client.startPolling(50);
  
  t.truthy(client['timer'], 'Polling active before close');
  
  // Simulate channel closing from network side
  channel.dispatchEvent('close', {});
  
  t.is(client['timer'], undefined, 'Polling stopped after close event');
  
  client.destroy();
});

// ============================================================================
// Repeated Lifecycle Stress Test
// ============================================================================

test('Stress: 20 rapid create/attach/destroy cycles', t => {
  for (let i = 0; i < 20; i++) {
    const client = new BrowserENetClient();
    const channel = new MockRTCDataChannel();
    
    client.attachDataChannel(channel);
    client.startPolling(10);
    client.destroy();
  }
  
  t.pass('20 rapid lifecycle cycles completed without issue');
});
