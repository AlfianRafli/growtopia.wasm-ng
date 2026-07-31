import type { TankPacket } from "./packets/TankPacket";
import type { TextPacket } from "./packets/TextPacket";
import type { Variant } from "./packets/Variant";

export interface StringOptions {
  id?: number;
  encoded?: boolean;
}

/**
 * Represents the data needed for the TankPacket.
 */
export interface Tank {
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

/**
 * The argument type for the variant.
 */
export type VariantArg = string | number[] | number;

/**
 * Options for the Variant Packet
 */
export interface VariantOptions {
  /**
   * The netID of the variant.
   */
  netID?: number;

  /**
   * They delay (in ms) on when the client will execute the packet.
   */
  delay?: number;
}

/**
 * Represents the available type of Objects that are sendable to peers.
 */
export type Sendable = Buffer | TextPacket | TankPacket | Variant;

export interface VariantTypeBase {
  index: number;
  type: number;
  typeName: string;
}

export interface VariantTypeNumber extends VariantTypeBase {
  value: number;
}

export interface VariantTypeFloat extends VariantTypeBase {
  value: number[];
}

export interface VariantTypeString extends VariantTypeBase {
  value: string;
}

export type VariantArray = VariantTypeString | VariantTypeNumber | VariantTypeFloat;

export interface NativePeerData {
  ip: string;
  port: number;
  rtt: number;
}

export interface PeerData {
  netID: number;
  channelID: number;
}

export interface UseNewPacketOptions {
  asClient?: boolean;
  asServer?: boolean;
}

/**
 * Clean & Refactored ENet Server/Host Options
 */
export interface ENetServerOptions {
  ip?: string;
  port?: number;
  maxPeers?: number;
  channelLimit?: number;
  incomingBandwidth?: number;
  outgoingBandwidth?: number;
  useNewPacket?: boolean | UseNewPacketOptions;
  enableCompressor?: boolean;
  enableChecksum?: boolean;
  seed?: number;
}

export interface ClientOptions {
  enet?: ENetServerOptions;
}
