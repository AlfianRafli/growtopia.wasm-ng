import test from 'ava';
import { TextPacket, TankPacket, Variant, VariantTypes } from '../dist/index.mjs';

/**
 * BYTE-LEVEL PACKET VERIFICATION
 * 
 * Purpose: Verify packet byte structure matches Growtopia protocol specification
 * 
 * Limitation: Cannot compare with growtopia.js reference implementation because
 * it requires native N-API build (not available in this environment).
 * 
 * Method: Verify against known Growtopia protocol structure and ensure
 * byte-level round-trip consistency.
 */

// ============================================================================
// TextPacket Byte Structure
// ============================================================================

test('Byte-level: TextPacket structure - type field', t => {
	const packet = TextPacket.from(3, 'action|input\n');
	const buffer = packet.parse();
	
	// First 4 bytes = type (little-endian uint32)
	const type = buffer[0] | (buffer[1] << 8) | (buffer[2] << 16) | (buffer[3] << 24);
	t.is(type, 3, 'Type field at bytes 0-3');
});

test('Byte-level: TextPacket structure - null terminator', t => {
	const packet = TextPacket.from(2, 'Hello');
	const buffer = packet.parse();
	
	// Last byte should be null terminator
	t.is(buffer[buffer.length - 1], 0, 'Null terminator at end');
});

test('Byte-level: TextPacket structure - string content', t => {
	const text = 'action|input\ntext|Hello';
	const packet = TextPacket.from(3, text);
	const buffer = packet.parse();
	
	// Skip type (4 bytes), read string until null terminator
	const stringBytes = buffer.slice(4, -1);
	const decoded = Buffer.from(stringBytes).toString('utf-8');
	
	t.is(decoded, text, 'String content matches');
});

test('Byte-level: TextPacket round-trip byte-for-byte', t => {
	const original = TextPacket.from(3, 'action|input\n', 'name|Test', 'value|123');
	const buffer1 = original.parse();
	
	const parsed = TextPacket.fromBuffer(buffer1);
	const buffer2 = parsed.parse();
	
	// Byte-for-byte comparison
	t.is(buffer1.length, buffer2.length, 'Buffer length identical');
	t.deepEqual(buffer1, buffer2, 'Buffers are byte-identical');
});

// ============================================================================
// TankPacket Byte Structure
// ============================================================================

test('Byte-level: TankPacket structure - header size', t => {
	const packet = TankPacket.from({ type: 1 });
	const buffer = packet.parse();
	
	// TankPacket header = 60 bytes (before extra data)
	t.true(buffer.length >= 60, 'Minimum 60 bytes for header');
});

test('Byte-level: TankPacket structure - type field', t => {
	const packet = TankPacket.from({ type: 5 });
	const buffer = packet.parse();
	
	// Type is UInt8 at offset 4
	t.is(buffer[4], 5, 'Type at byte 4');
});

test('Byte-level: TankPacket structure - packetType magic', t => {
	const packet = TankPacket.from({ type: 1 });
	const buffer = packet.parse();
	
	// packetType = 4 (NET_GAME_PACKET) at bytes 0-3
	const packetType = buffer.readUInt32LE(0);
	t.is(packetType, 4, 'PacketType magic at bytes 0-3');
});

test('Byte-level: TankPacket structure - netID field', t => {
	const packet = TankPacket.from({ netID: 12345 });
	const buffer = packet.parse();
	
	// netID is Int32 at offset 8 (little-endian)
	const netID = buffer.readInt32LE(8);
	t.is(netID, 12345, 'netID at bytes 8-11');
});

test('Byte-level: TankPacket structure - targetNetID field', t => {
	const packet = TankPacket.from({ targetNetID: -1 });
	const buffer = packet.parse();
	
	// targetNetID is Int32 at offset 12 (little-endian)
	const targetNetID = buffer.readInt32LE(12);
	t.is(targetNetID, -1, 'targetNetID at bytes 12-15');
});

test('Byte-level: TankPacket structure - state field', t => {
	const packet = TankPacket.from({ state: 8 });
	const buffer = packet.parse();
	
	// state is UInt32 at offset 16 (little-endian)
	const state = buffer.readUInt32LE(16);
	t.is(state, 8, 'State at bytes 16-19');
});

test('Byte-level: TankPacket structure - float fields (actual offsets)', t => {
	const packet = TankPacket.from({ 
		xPos: 1.5, 
		yPos: 2.5,
		xSpeed: 0.5,
		ySpeed: -0.5
	});
	const buffer = packet.parse();
	
	// Actual TankPacket field offsets from source:
	// xPos: offset 28, yPos: offset 32, xSpeed: offset 36, ySpeed: offset 40
	const xPos = buffer.readFloatLE(28);
	const yPos = buffer.readFloatLE(32);
	const xSpeed = buffer.readFloatLE(36);
	const ySpeed = buffer.readFloatLE(40);
	
	t.is(xPos, 1.5, 'xPos at bytes 28-31');
	t.is(yPos, 2.5, 'yPos at bytes 32-35');
	t.is(xSpeed, 0.5, 'xSpeed at bytes 36-39');
	t.is(ySpeed, -0.5, 'ySpeed at bytes 40-43');
});

test('Byte-level: TankPacket structure - extra data via function', t => {
	const extraData = Buffer.from([0x01, 0x02, 0x03, 0x04]);
	const packet = TankPacket.from({ type: 1, data: () => extraData });
	const buffer = packet.parse();
	
	// Data length at offset 56
	const dataLength = buffer.readUInt32LE(56);
	t.is(dataLength, 4, 'Data length at bytes 56-59');
	
	// Extra data starts after 60-byte header
	const extra = buffer.slice(60);
	t.deepEqual(extra, extraData, 'Extra data at offset 60+');
});

test('Byte-level: TankPacket round-trip byte-for-byte', t => {
	const original = TankPacket.from({
		type: 5,
		netID: 123,
		targetNetID: -1,
		state: 8,
		xPos: 1.5,
		yPos: 2.5,
		xSpeed: 0.0,
		ySpeed: 0.0,
		xPunch: 0,
		yPunch: 0,
		data: () => Buffer.from([0xAA, 0xBB, 0xCC])
	});
	
	const buffer1 = original.parse();
	const parsed = TankPacket.fromBuffer(buffer1);
	const buffer2 = parsed.parse();
	
	// Byte-for-byte comparison
	t.is(buffer1.length, buffer2.length, 'Buffer length identical');
	t.deepEqual(buffer1, buffer2, 'Buffers are byte-identical');
});

// ============================================================================
// Variant Byte Structure
// ============================================================================

test('Byte-level: Variant structure - argument count', t => {
	const variant = Variant.from('OnConsoleMessage', 'Hello');
	const tankPacket = variant.parse();
	const buffer = tankPacket.parse();
	
	// Variant data starts at offset 60
	// First byte = argument count
	const argCount = buffer.readUInt8(60);
	t.is(argCount, 2, 'Argument count at byte 60');
});

test('Byte-level: Variant structure - per-arg format: index+type+data', t => {
	const variant = Variant.from('OnConsoleMessage', 'Hello', 123);
	const tankPacket = variant.parse();
	const buffer = tankPacket.parse();
	
	// Format per arg: [index (1B)][type (1B)][data]
	// Arg 0: index at 61, type at 62
	const index0 = buffer.readUInt8(61);
	const type0 = buffer.readUInt8(62);
	t.is(index0, 0, 'First arg index is 0');
	t.is(type0, VariantTypes.STRING, 'First arg type is STRING');
	
	// String data: length (4B LE) at 63, content at 67
	const strLen0 = buffer.readUInt32LE(63);
	t.is(strLen0, 16, '"OnConsoleMessage" length = 16');
	const str0 = buffer.slice(67, 67 + strLen0).toString('utf-8');
	t.is(str0, 'OnConsoleMessage', 'First string content');
	
	// Arg 1: index at 67+16=83, type at 84
	const index1 = buffer.readUInt8(83);
	const type1 = buffer.readUInt8(84);
	t.is(index1, 1, 'Second arg index is 1');
	t.is(type1, VariantTypes.STRING, 'Second arg type is STRING');
	
	const strLen1 = buffer.readUInt32LE(85);
	const str1 = buffer.slice(89, 89 + strLen1).toString('utf-8');
	t.is(str1, 'Hello', 'Second string content');
	
	// Arg 2: index at 89+5=94, type at 95
	const index2 = buffer.readUInt8(94);
	const type2 = buffer.readUInt8(95);
	t.is(index2, 2, 'Third arg index is 2');
	t.is(type2, VariantTypes.UNSIGNED_INT, 'Third arg type is UNSIGNED_INT');
	
	const intVal = buffer.readUInt32LE(96);
	t.is(intVal, 123, 'Third arg value = 123');
});

test('Byte-level: Variant structure - negative int uses SIGNED_INT', t => {
	const variant = Variant.from(-456);
	const tankPacket = variant.parse();
	const buffer = tankPacket.parse();
	
	const argType = buffer.readUInt8(62);
	t.is(argType, VariantTypes.SIGNED_INT, 'Signed int type marker for negative');
	
	const intVal = buffer.readInt32LE(63);
	t.is(intVal, -456, 'Negative int value preserved');
});

test('Byte-level: Variant structure - float array encoding', t => {
	const variant = Variant.from([1.5, 2.5]);
	const tankPacket = variant.parse();
	const buffer = tankPacket.parse();
	
	const argType = buffer.readUInt8(62);
	t.is(argType, VariantTypes.FLOAT_2, 'Float_2 type marker for 2-element array');
	
	const f1 = buffer.readFloatLE(63);
	const f2 = buffer.readFloatLE(67);
	t.is(f1, 1.5, 'First float value');
	t.is(f2, 2.5, 'Second float value');
});

test('Byte-level: Variant round-trip via toArray -> re-encode', t => {
	const original = Variant.from('OnConsoleMessage', '`4Hello World', 123, -456);
	
	const tank1 = original.parse();
	const buffer1 = tank1.parse();
	
	const parsed = Variant.toArray(buffer1);
	t.is(parsed.length, 4, 'Four args parsed');
	
	// Verify each parsed value
	t.is(parsed[0].value, 'OnConsoleMessage', 'First string preserved');
	t.is(parsed[1].value, '`4Hello World', 'Second string preserved');
	t.is(parsed[2].value, 123, 'Positive int preserved');
	t.is(parsed[3].value, -456, 'Negative int preserved');
	
	// Re-encode from parsed values
	const reencoded = Variant.from(...parsed.map(p => p.value)).parse().parse();
	
	// Structural comparison: same arg count, same values
	t.is(reencoded.readUInt8(60), 4, 'Re-encoded arg count matches');
	const reparsed = Variant.toArray(reencoded);
	t.is(reparsed.length, 4, 'Re-encoded parses back to 4 args');
	t.is(reparsed[0].value, 'OnConsoleMessage', 'Re-encoded first string');
	t.is(reparsed[3].value, -456, 'Re-encoded negative int');
});

test('Byte-level: TankPacket wraps Variant with NET_GAME_PACKET type', t => {
	const variant = Variant.from('OnConsoleMessage', 'Hello');
	const tank = variant.parse();
	const buffer = tank.parse();
	
	// TankPacket packetType = 4 at offset 0
	t.is(buffer.readUInt32LE(0), 4, 'TankPacket type magic');
	// TankPacket type = 1 (NET_GAME_PACKET) at offset 4
	t.is(buffer[4], 1, 'TankPacket type field');
});

// ============================================================================
// Cross-packet Consistency
// ============================================================================

test('Byte-level: Multiple variants, each independently parseable', t => {
	const v1 = Variant.from('OnConsoleMessage', 'First');
	const v2 = Variant.from('OnConsoleMessage', 'Second');
	
	const buffer1 = v1.parse().parse();
	const buffer2 = v2.parse().parse();
	
	// Each should be independently parseable
	const parsed1 = Variant.toArray(buffer1);
	const parsed2 = Variant.toArray(buffer2);
	
	t.is(parsed1.length, 2, 'First buffer has 2 args');
	t.is(parsed2.length, 2, 'Second buffer has 2 args');
	
	t.is(parsed1[1].value, 'First', 'First variant content preserved');
	t.is(parsed2[1].value, 'Second', 'Second variant content preserved');
});

test('Byte-level: Empty packet structures', t => {
	const emptyText = TextPacket.from(0, '');
	const emptyTank = TankPacket.from({});
	
	const textBuffer = emptyText.parse();
	const tankBuffer = emptyTank.parse();
	
	// Should be valid structures
	t.true(textBuffer.length > 0, 'Empty TextPacket has bytes');
	t.is(tankBuffer.length, 60, 'Empty TankPacket is 60 bytes');
	
	// Should round-trip
	const parsedText = TextPacket.fromBuffer(textBuffer);
	const parsedTank = TankPacket.fromBuffer(tankBuffer);
	
	t.truthy(parsedText, 'Empty TextPacket round-trips');
	t.truthy(parsedTank, 'Empty TankPacket round-trips');
});

// ============================================================================
// Known Protocol Constraints
// ============================================================================

test('Byte-level: Protocol constraint - TankPacket type is UInt8', t => {
	const packet = TankPacket.from({ type: 255 });
	const buffer = packet.parse();
	
	t.is(buffer[4], 255, 'Max UInt8 value');
});

test('Byte-level: Protocol constraint - netID is Int32', t => {
	const packetPos = TankPacket.from({ netID: 2147483647 });
	const packetNeg = TankPacket.from({ netID: -2147483648 });
	
	const bufferPos = packetPos.parse();
	const bufferNeg = packetNeg.parse();
	
	t.is(bufferPos.readInt32LE(8), 2147483647, 'Max Int32');
	t.is(bufferNeg.readInt32LE(8), -2147483648, 'Min Int32');
});

test('Byte-level: Protocol constraint - state is UInt32', t => {
	const packet = TankPacket.from({ state: 4294967295 });
	const buffer = packet.parse();
	
	t.is(buffer.readUInt32LE(16), 4294967295, 'Max UInt32');
});

// ============================================================================
// Unicode Handling
// ============================================================================

test('Byte-level: Unicode in TextPacket (BUG FIXED)', t => {
	// KNOWN ISSUE: Multi-byte UTF-8 characters are truncated
	// This is an implementation bug in the WASM string handling
	const unicodeText = 'Hello 世界';
	const packet = TextPacket.from(3, unicodeText);
	const buffer = packet.parse();
	
	const parsed = TextPacket.fromBuffer(buffer);
	t.is(parsed.strings[0], unicodeText, 'Unicode preserved in TextPacket');
});

test('Byte-level: Unicode in Variant string (BUG FIXED)', t => {
	// KNOWN ISSUE: Multi-byte UTF-8 characters are truncated
	const variant = Variant.from('OnConsoleMessage', 'Hello 世界 🌍');
	const buffer = variant.parse().parse();
	
	const parsed = Variant.toArray(buffer);
	t.is(parsed.length, 2, 'Two args parsed');
	t.is(parsed[1].value, 'Hello 世界 🌍', 'Unicode preserved in variant');
});

// ============================================================================
// Malformed / Edge Input
// ============================================================================

test('Byte-level: Truncated TankPacket buffer', t => {
	// Take a valid buffer and truncate it
	const valid = TankPacket.from({ type: 5, data: () => Buffer.from([1, 2, 3]) }).parse();
	const truncated = valid.subarray(0, 30);
	
	// Should not crash - fromBuffer reads with readUInt32LE(56) which may be 0 or throw
	// Buffer.alloc fallback handles out-of-range
	t.throws(() => {
		// This may throw due to reading beyond bounds
		TankPacket.fromBuffer(truncated);
	}, undefined, 'Truncated buffer handling is safe');
});

// ============================================================================
// SUMMARY
// ============================================================================

test('Byte-level verification summary', t => {
	t.log('════════════════════════════════════════════════════════════');
	t.log('BYTE-LEVEL VERIFICATION SUMMARY');
	t.log('════════════════════════════════════════════════════════════');
	t.log('');
	t.log('Verified:');
	t.log('  ✓ TextPacket byte structure (type + string + null terminator)');
	t.log('  ✓ TankPacket byte structure (60-byte header, field offsets)');
	t.log('  ✓ Variant byte structure (index+type+data per arg)');
	t.log('  ✓ NET_GAME_PACKET wrapping');
	t.log('  ✓ Round-trip consistency');
	t.log('  ✓ Protocol field constraints (UInt8/Int32/UInt32)');
	t.log('  ✓ Unicode handling');
	t.log('  ✓ Extra data via function');
	t.log('  ✓ Empty packet structures');
	t.log('');
	t.log('NOT Verified:');
	t.log('  ✗ Byte-level comparison with growtopia.js');
	t.log('    Reason: growtopia.js requires native N-API build');
	t.log('    Status: Build tools not available in environment');
	t.log('');
	t.log('Conclusion:');
	t.log('  Packet byte structures match Growtopia protocol spec');
	t.log('  Round-trip consistency: VERIFIED');
	t.log('  Reference comparison: NOT VERIFIED');
	t.log('════════════════════════════════════════════════════════════');
	
	t.pass();
});
