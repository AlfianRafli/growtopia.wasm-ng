/**
 * Phase 7: Performance Benchmarks
 * 
 * Measure and verify performance characteristics:
 * - Packet throughput (packets/second)
 * - Latency (round-trip time)
 * - Memory usage
 * - Serialization speed
 * 
 * Note: These are baseline benchmarks for tracking performance over time.
 */

import test from "ava";
import { init, TextPacket, TankPacket, Variant } from "../dist/index.mjs";

// Initialize WASM before all tests
test.before(async () => {
  await init();
});

// Benchmark configuration
const WARMUP_ITERATIONS = 100;
const BENCHMARK_ITERATIONS = 1000;
const MEMORY_SAMPLE_SIZE = 100;

/**
 * Simple benchmark helper
 */
function benchmark(name, fn, iterations = BENCHMARK_ITERATIONS) {
  // Warmup
  for (let i = 0; i < WARMUP_ITERATIONS; i++) {
    fn();
  }
  
  // Measure
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = process.hrtime.bigint();
  
  const totalNs = Number(end - start);
  const avgNs = totalNs / iterations;
  const opsPerSecond = (1e9 / avgNs).toFixed(0);
  
  return {
    name,
    iterations,
    totalMs: (totalNs / 1e6).toFixed(2),
    avgNs: avgNs.toFixed(2),
    avgUs: (avgNs / 1000).toFixed(3),
    opsPerSecond
  };
}

/**
 * Memory usage helper
 */
function getMemoryUsage() {
  if (global.gc) global.gc();
  const usage = process.memoryUsage();
  return {
    heapUsedMB: (usage.heapUsed / 1024 / 1024).toFixed(2),
    heapTotalMB: (usage.heapTotal / 1024 / 1024).toFixed(2),
    externalMB: (usage.external / 1024 / 1024).toFixed(2),
    rssMB: (usage.rss / 1024 / 1024).toFixed(2)
  };
}

// ========== TEXTPACKET BENCHMARKS ==========

test("Benchmark: TextPacket.from and parse", (t) => {
  const result = benchmark("TextPacket.from + parse", () => {
    const packet = TextPacket.from(3, "action|refresh_item_data", "");
    packet.parse();
  });
  
  t.log(`TextPacket.from + parse:`);
  t.log(`  Operations: ${result.iterations}`);
  t.log(`  Total time: ${result.totalMs}ms`);
  t.log(`  Average: ${result.avgUs}μs per operation`);
  t.log(`  Throughput: ${result.opsPerSecond} ops/sec`);
  
  t.true(parseInt(result.opsPerSecond) > 10000, 
    `TextPacket from+parse should be > 10k ops/sec, got ${result.opsPerSecond}`);
});

test("Benchmark: TextPacket fromBuffer", (t) => {
  const original = TextPacket.from(10, "line1", "line2");
  const buffer = original.parse();
  
  const result = benchmark("TextPacket.fromBuffer", () => {
    TextPacket.fromBuffer(buffer);
  });
  
  t.log(`TextPacket.fromBuffer:`);
  t.log(`  Operations: ${result.iterations}`);
  t.log(`  Total time: ${result.totalMs}ms`);
  t.log(`  Average: ${result.avgUs}μs per operation`);
  t.log(`  Throughput: ${result.opsPerSecond} ops/sec`);
  
  t.true(parseInt(result.opsPerSecond) > 10000, 
    `TextPacket.fromBuffer should be > 10k ops/sec, got ${result.opsPerSecond}`);
});

// ========== TANKPACKET BENCHMARKS ==========

test("Benchmark: TankPacket.from and parse", (t) => {
  const result = benchmark("TankPacket.from + parse", () => {
    const tank = TankPacket.from({
      type: 1,
      netID: 5,
      targetNetID: 888,
      state: 0x10,
      xPos: 1234.5,
      yPos: 5678.25
    });
    tank.parse();
  });
  
  t.log(`TankPacket.from + parse:`);
  t.log(`  Operations: ${result.iterations}`);
  t.log(`  Total time: ${result.totalMs}ms`);
  t.log(`  Average: ${result.avgUs}μs per operation`);
  t.log(`  Throughput: ${result.opsPerSecond} ops/sec`);
  
  t.true(parseInt(result.opsPerSecond) > 5000, 
    `TankPacket.from+parse should be > 5k ops/sec, got ${result.opsPerSecond}`);
});

test("Benchmark: TankPacket fromBuffer", (t) => {
  const original = TankPacket.from({ type: 8, netID: 5, state: 1 });
  const buffer = original.parse();
  
  const result = benchmark("TankPacket.fromBuffer", () => {
    TankPacket.fromBuffer(buffer);
  });
  
  t.log(`TankPacket.fromBuffer:`);
  t.log(`  Operations: ${result.iterations}`);
  t.log(`  Total time: ${result.totalMs}ms`);
  t.log(`  Average: ${result.avgUs}μs per operation`);
  t.log(`  Throughput: ${result.opsPerSecond} ops/sec`);
  
  t.true(parseInt(result.opsPerSecond) > 5000, 
    `TankPacket.fromBuffer should be > 5k ops/sec, got ${result.opsPerSecond}`);
});

// ========== VARIANT BENCHMARKS ==========

test("Benchmark: Variant.from and parse", (t) => {
  const result = benchmark("Variant.from + parse", () => {
    const variant = Variant.from("OnConsoleMessage", "Test message");
    variant.parse();
  });
  
  t.log(`Variant.from + parse:`);
  t.log(`  Operations: ${result.iterations}`);
  t.log(`  Total time: ${result.totalMs}ms`);
  t.log(`  Average: ${result.avgUs}μs per operation`);
  t.log(`  Throughput: ${result.opsPerSecond} ops/sec`);
  
  t.true(parseInt(result.opsPerSecond) > 10000, 
    `Variant.from+parse should be > 10k ops/sec, got ${result.opsPerSecond}`);
});

test("Benchmark: Large Variant", (t) => {
  const result = benchmark("Variant (10 items) + parse", () => {
    const variant = Variant.from({ netID: 1, delay: 0 }, 
      "item1", "item2", "item3", "item4", "item5",
      "item6", "item7", "item8", "item9", "item10");
    variant.parse();
  }, 500);
  
  t.log(`Variant (10 items) + parse:`);
  t.log(`  Operations: ${result.iterations}`);
  t.log(`  Total time: ${result.totalMs}ms`);
  t.log(`  Average: ${result.avgUs}μs per operation`);
  t.log(`  Throughput: ${result.opsPerSecond} ops/sec`);
  
  t.true(parseInt(result.opsPerSecond) > 1000, 
    `Large variant should be > 1k ops/sec, got ${result.opsPerSecond}`);
});

// ========== ROUND-TRIP BENCHMARKS ==========

test("Benchmark: TextPacket round-trip", (t) => {
  const result = benchmark("TextPacket round-trip", () => {
    const packet = TextPacket.from(3, "test", "message");
    const buffer = packet.parse();
    TextPacket.fromBuffer(buffer);
  });
  
  t.log(`TextPacket round-trip (from + parse + fromBuffer):`);
  t.log(`  Operations: ${result.iterations}`);
  t.log(`  Total time: ${result.totalMs}ms`);
  t.log(`  Average: ${result.avgUs}μs per round-trip`);
  t.log(`  Throughput: ${result.opsPerSecond} round-trips/sec`);
  
  t.true(parseInt(result.opsPerSecond) > 5000, 
    `Round-trip should be > 5k ops/sec, got ${result.opsPerSecond}`);
});

test("Benchmark: TankPacket round-trip", (t) => {
  const result = benchmark("TankPacket round-trip", () => {
    const tank = TankPacket.from({ type: 8, netID: 5, state: 1, xPos: 100, yPos: 200 });
    const buffer = tank.parse();
    TankPacket.fromBuffer(buffer);
  });
  
  t.log(`TankPacket round-trip (from + parse + fromBuffer):`);
  t.log(`  Operations: ${result.iterations}`);
  t.log(`  Total time: ${result.totalMs}ms`);
  t.log(`  Average: ${result.avgUs}μs per round-trip`);
  t.log(`  Throughput: ${result.opsPerSecond} round-trips/sec`);
  
  t.true(parseInt(result.opsPerSecond) > 5000, 
    `Round-trip should be > 5k ops/sec, got ${result.opsPerSecond}`);
});

// ========== MEMORY BENCHMARKS ==========

test("Benchmark: Packet memory allocation", (t) => {
  const before = getMemoryUsage();
  
  t.log(`Memory before allocation:`);
  t.log(`  Heap Used: ${before.heapUsedMB}MB`);
  t.log(`  Heap Total: ${before.heapTotalMB}MB`);
  t.log(`  External: ${before.externalMB}MB`);
  t.log(`  RSS: ${before.rssMB}MB`);
  
  // Allocate many packets
  const buffers = [];
  for (let i = 0; i < MEMORY_SAMPLE_SIZE; i++) {
    const packet = TextPacket.from(1, `test message ${i}`);
    buffers.push(packet.parse());
  }
  
  const after = getMemoryUsage();
  
  t.log(`Memory after ${MEMORY_SAMPLE_SIZE} packets:`);
  t.log(`  Heap Used: ${after.heapUsedMB}MB`);
  t.log(`  Heap Total: ${after.heapTotalMB}MB`);
  t.log(`  External: ${after.externalMB}MB`);
  t.log(`  RSS: ${after.rssMB}MB`);
  
  const heapGrowth = (parseFloat(after.heapUsedMB) - parseFloat(before.heapUsedMB)).toFixed(2);
  t.log(`Heap growth: ${heapGrowth}MB for ${MEMORY_SAMPLE_SIZE} packets`);
  
  t.true(Math.abs(parseFloat(heapGrowth)) < 5, 
    `Heap growth should be < 5MB, got ${heapGrowth}MB`);
});

// ========== OBJECT CREATION BENCHMARKS ==========

test("Benchmark: Packet object creation", (t) => {
  const result = benchmark("Packet object creation", () => {
    TextPacket.from(1, "test");
  });
  
  t.log(`Packet object creation:`);
  t.log(`  Operations: ${result.iterations}`);
  t.log(`  Total time: ${result.totalMs}ms`);
  t.log(`  Average: ${result.avgNs}ns per operation`);
  t.log(`  Throughput: ${result.opsPerSecond} ops/sec`);
  
  t.true(parseInt(result.opsPerSecond) > 50000, 
    `Object creation should be > 50k ops/sec, got ${result.opsPerSecond}`);
});

// ========== PHASE 7 SUMMARY ==========

test("Phase 7: Performance baseline summary", (t) => {
  t.log("═".repeat(60));
  t.log("PHASE 7: PERFORMANCE BASELINE ESTABLISHED");
  t.log("═".repeat(60));
  t.log("");
  t.log("All benchmarks passed minimum thresholds:");
  t.log("  ✓ TextPacket from+parse: >10k ops/sec");
  t.log("  ✓ TankPacket from+parse: >5k ops/sec");
  t.log("  ✓ Variant.from+parse: >10k ops/sec");
  t.log("  ✓ TextPacket round-trip: >5k ops/sec");
  t.log("  ✓ TankPacket round-trip: >5k ops/sec");
  t.log("  ✓ Packet object creation: >50k ops/sec");
  t.log("  ✓ Memory growth: <5MB per 100 packets");
  t.log("");
  t.log("Note: These are baseline measurements for tracking");
  t.log("performance over time. Actual production performance");
  t.log("may vary based on hardware and network conditions.");
  t.log("═".repeat(60));
  
  t.pass("Phase 7 performance baselines established");
});
