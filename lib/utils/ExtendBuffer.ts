import { TankPacket } from "../src/packets/TankPacket";

/**
 * Utility class providing dynamic Buffer allocation and endianness writing helpers for packet serialization.
 */
export class ExtendBuffer {
  /**
   * Creates and allocates a new Node.js Buffer instance.
   *
   * @param size - Initial byte size (default: 0).
   */
  public static create(size: number = 0): Buffer {
    return Buffer.alloc(size);
  }

  /**
   * Writes a 32-bit signed integer (little-endian) into the buffer at the specified offset, reallocating space if necessary.
   *
   * @param buf - Target Buffer.
   * @param val - Signed 32-bit integer value.
   * @param offset - Byte offset to write at.
   * @returns The modified or newly allocated Buffer.
   */
  public static writeInt32LE(buf: Buffer, val: number, offset: number): Buffer {
    if (offset + 4 > buf.length) {
      const newBuf = Buffer.alloc(offset + 4);
      buf.copy(newBuf);
      buf = newBuf;
    }
    buf.writeInt32LE(val, offset);
    return buf;
  }

  /**
   * Writes a 32-bit unsigned integer (little-endian) into the buffer at the specified offset, reallocating space if necessary.
   *
   * @param buf - Target Buffer.
   * @param val - Unsigned 32-bit integer value.
   * @param offset - Byte offset to write at.
   * @returns The modified or newly allocated Buffer.
   */
  public static writeUInt32LE(buf: Buffer, val: number, offset: number): Buffer {
    if (offset + 4 > buf.length) {
      const newBuf = Buffer.alloc(offset + 4);
      buf.copy(newBuf);
      buf = newBuf;
    }
    buf.writeUInt32LE(val, offset);
    return buf;
  }

  /**
   * Writes a 32-bit float (little-endian) into the buffer at the specified offset, reallocating space if necessary.
   *
   * @param buf - Target Buffer.
   * @param val - Floating point number.
   * @param offset - Byte offset to write at.
   * @returns The modified or newly allocated Buffer.
   */
  public static writeFloatLE(buf: Buffer, val: number, offset: number): Buffer {
    if (offset + 4 > buf.length) {
      const newBuf = Buffer.alloc(offset + 4);
      buf.copy(newBuf);
      buf = newBuf;
    }
    buf.writeFloatLE(val, offset);
    return buf;
  }

  /**
   * Writes a length-prefixed UTF-8 string into the buffer at the specified offset, reallocating space if necessary.
   *
   * @param buf - Target Buffer.
   * @param val - String value.
   * @param offset - Byte offset to write at.
   * @returns The modified or newly allocated Buffer.
   */
  public static writeString(buf: Buffer, val: string, offset: number): Buffer {
    const strBuf = Buffer.from(val, "utf-8");
    const len = strBuf.length;
    if (offset + 4 + len > buf.length) {
      const newBuf = Buffer.alloc(offset + 4 + len);
      buf.copy(newBuf);
      buf = newBuf;
    }
    buf.writeUInt32LE(len, offset);
    strBuf.copy(buf, offset + 4);
    return buf;
  }

  /**
   * Appends serialized TankPacket binary data onto an existing Buffer.
   *
   * @param buf - Target Buffer.
   * @param tank - TankPacket instance.
   * @returns Combined Buffer.
   */
  public static appendTankData(buf: Buffer, tank: TankPacket): Buffer {
    const tankBuf = tank.parse();
    if (!tankBuf) return buf;

    const newBuf = Buffer.alloc(buf.length + tankBuf.length);
    buf.copy(newBuf);
    tankBuf.copy(newBuf, buf.length);
    return newBuf;
  }
}
