import { createSocket, Socket } from "dgram";
import { Host, JsHostSettings, push_incoming_packet, Packet, PacketKind } from "../pkg/growtopia_wasm.js";

/**
 * growtopia.js-compatible Host wrapper.
 * Provides the same constructor signature as growtopia.js Host class.
 *
 * Known limitations (documented in COMPATIBILITY.md):
 * - getPeer() throws an error as WASM doesn't have NativePeer snapshot
 * - Event emitter signature differs from growtopia.js callback pattern
 * - Transport is abstracted (WASM uses abstract socket bridge vs native UDP)
 */
export class CompatHost {
  private socket: Socket;
  private _host: Host;
  private emitterCallback?: (...args: any[]) => any;

  public readonly ipAddress: string;
  public readonly port: number;
  public readonly peerLimit: number;
  public readonly channelLimit: number;

  /**
   * Alias for ipAddress for growtopia.js compatibility
   */
  public get ip(): string {
    return this.ipAddress;
  }

  /**
   * Creates a new ENet host for communicating with peers.
   * Compatible with growtopia.js Host constructor signature.
   *
   * @param ipAddress - The IP address to bind to
   * @param port - The port number to bind to
   * @param peerLimit - The maximum number of peers that should be allocated for the host
   * @param channelLimit - The maximum number of channels allowed (cannot be 0)
   * @param usingNewPacket - Whether to use new packet format
   * @param usingNewPacketServer - Whether server uses new packet format
   * @param incomingBandwidthLimit - Downstream bandwidth limit in bytes/second, or null for no limit
   * @param outgoingBandwidthLimit - Upstream bandwidth limit in bytes/second, or null for no limit
   * @param enableCompressor - Enable RangeCoder compression (defaults to true)
   * @param enableChecksum - Enable CRC32 checksum validation (defaults to true)
   * @param seed - Random number generator seed (unused in WASM, accepted for compatibility)
   */
  constructor(
    ipAddress: string,
    port: number,
    peerLimit: number = 32,
    channelLimit: number = 2,
    usingNewPacket: boolean = true,
    usingNewPacketServer: boolean = false,
    incomingBandwidthLimit?: number | null,
    outgoingBandwidthLimit?: number | null,
    enableCompressor?: boolean | null,
    enableChecksum?: boolean | null,
    seed?: number | null
  ) {
    this.ipAddress = ipAddress;
    this.port = port;
    this.peerLimit = peerLimit;
    this.channelLimit = channelLimit;

    // Validate parameters
    if (!ipAddress || ipAddress.trim() === "") {
      throw new Error("IP address cannot be empty");
    }
    if (port < 0 || port > 65535) {
      throw new Error("Port must be between 0 and 65535");
    }
    if (peerLimit <= 0) {
      throw new Error("Peer limit must be greater than 0");
    }
    if (channelLimit <= 0) {
      throw new Error("Channel limit must be greater than 0");
    }

    // Create JsHostSettings from positional arguments
    const settings = new JsHostSettings();
    settings.peerLimit = peerLimit;
    settings.channelLimit = channelLimit;
    settings.incomingBandwidth = incomingBandwidthLimit ?? 0;
    settings.outgoingBandwidth = outgoingBandwidthLimit ?? 0;
    settings.usingNewPacket = usingNewPacket;
    settings.usingNewPacketServer = usingNewPacketServer;
    settings.useRangeCoder = enableCompressor ?? true;
    settings.useCrc32 = enableChecksum ?? true;

    // Create UDP socket for Node.js transport
    this.socket = createSocket("udp4");

    // Send callback for WASM Host
    const sendCallback = (ip: string, port: number, data: Uint8Array) => {
      const copiedData = Buffer.from(data);
      this.socket.send(copiedData, port, ip);
    };

    // Create WASM Host
    this._host = new Host(ipAddress, port, settings, sendCallback);

    // Setup incoming packet handler
    this.socket.on("message", (msg, rinfo) => {
      push_incoming_packet(this._host.id, rinfo.address, rinfo.port, new Uint8Array(msg));
    });

    this.socket.on("error", (err) => {
      throw err;
    });

    // Bind socket
    if (port > 0) {
      this.socket.bind(port, ipAddress);
    } else {
      this.socket.bind();
    }
  }

  /**
   * Get the maximum transmission unit (MTU).
   * @returns The MTU value
   */
  get mtu(): number {
    return this._host.mtuLimit();
  }

  /**
   * Initiates a connection to a foreign host.
   * @param ipAddress - The IP address of the remote host
   * @param port - The port number of the remote host
   * @returns True if connection initiated successfully
   */
  connect(ipAddress: string, port: number): boolean {
    try {
      this._host.connect(ipAddress, port, this.channelLimit, 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get a snapshot of peer data by peer ID.
   * Note: growtopia.js returns NativePeer, but WASM doesn't have exact equivalent.
   * This is a known incompatibility documented in COMPATIBILITY.md.
   * @param netId - The peer ID
   * @throws Error - Not fully compatible with growtopia.js NativePeer
   */
  getPeer(netId: number): any {
    throw new Error("getPeer() is not supported in compatibility mode. Use NodeENetHost/NodeENetServer peer events instead.");
  }

  /**
   * Checks for any queued events on the host.
   * @returns True if there are queued events
   */
  checkEvents(): boolean {
    const event = this._host.checkEvents();
    return event && event.eventType !== 0;
  }

  /**
   * Get the number of connected peers.
   * Note: WASM Host does not expose peerCount() method.
   * Returns 0 to maintain API compatibility (behavior differs from growtopia.js).
   * @returns Always returns 0 in WASM due to limitation
   */
  peerCount(): number {
    // WASM Host doesn't expose peer count
    // Return 0 to maintain API compatibility
    return 0;
  }

  /**
   * Get the current time according to this host.
   * @returns Time in milliseconds
   */
  now(): number {
    return Date.now();
  }

  /**
   * Send a reliable packet to a specific peer.
   * @param netId - The peer ID to send to
   * @param data - The packet data to send
   * @param channelId - The channel ID to send on
   * @returns True if packet queued successfully
   */
  send(netId: number, data: Buffer, channelId: number): boolean {
    try {
      const pkt = new Packet(new Uint8Array(data), PacketKind.Reliable);
      this._host.peerSend(netId, channelId, pkt);
      pkt.free();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sends any queued packets on the host to its designated peers.
   * @returns True on success
   */
  flush(): boolean {
    try {
      this._host.flush();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Queues a packet to be sent to all connected peers.
   * @param data - The packet data to broadcast
   * @param channelId - The channel ID to broadcast on
   * @returns True on success
   */
  broadcast(data: Buffer, channelId: number): boolean {
    try {
      const pkt = new Packet(new Uint8Array(data), PacketKind.Reliable);
      this._host.broadcast(channelId, pkt);
      pkt.free();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Limits the maximum allowed channels of future incoming connections.
   * @param channelLimit - The channel limit (cannot be 0)
   * @returns True on success
   */
  setChannelLimit(channelLimit: number): boolean {
    if (channelLimit === 0) {
      throw new Error("Channel limit cannot be 0");
    }
    try {
      this._host.setChannelLimit(channelLimit);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Adjusts the bandwidth limits of the host in bytes/second.
   * @param incoming - Downstream bandwidth limit in bytes/second, or null for no limit
   * @param outgoing - Upstream bandwidth limit in bytes/second, or null for no limit
   * @returns True on success
   */
  setBandwidthLimit(incoming?: number | null, outgoing?: number | null): boolean {
    try {
      this._host.setBandwidthLimit(incoming ?? 0, outgoing ?? 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the host's current bandwidth limits.
   * Note: WASM Host does not expose getBandwidthLimit() method.
   * Returns empty object to maintain API compatibility (behavior differs from growtopia.js).
   * @returns Object with 'incoming' and 'outgoing' properties (both 0 in WASM due to limitation)
   */
  getBandwidthLimit(): object {
    // WASM Host doesn't expose bandwidth limits getter
    // Return default values to maintain API compatibility
    return { incoming: 0, outgoing: 0 };
  }

  /**
   * Set the maximum transmission unit (MTU) for this host.
   * @param mtu - The MTU value
   * @returns True on success
   */
  setMtu(mtu: number): boolean {
    try {
      this._host.setMtuLimit(mtu);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Set the event emitter callback function.
   * This callback will be invoked during service() calls when events occur.
   * @param emitter - The callback function to handle events
   */
  setEmitter(emitter: (...args: any[]) => any): void {
    this.emitterCallback = emitter;
  }

  /**
   * Checks for events on the host and shuttles packets between the host and its peers.
   * Should be called regularly for adequate performance.
   * Dispatches events to the emitter callback set via setEmitter().
   * @param timeout - Timeout in milliseconds (unused in WASM, accepted for compatibility)
   */
  service(timeout?: number): void {
    if (!this.emitterCallback) {
      return;
    }

    try {
      const event = this._host.service();
      if (!event || event.eventType === 0) {
        return;
      }

      switch (event.eventType) {
        case 1: { // Connect
          this.emitterCallback("connect", event.peerId);
          break;
        }
        case 2: { // Disconnect
          this.emitterCallback("disconnect", event.peerId);
          break;
        }
        case 3: { // Receive
          const pkt = event.packet();
          if (pkt) {
            const data = Buffer.from(pkt.data());
            this.emitterCallback("raw", event.peerId, event.channelId, data);
          }
          break;
        }
      }
    } catch {
      // WASM Host service() may panic if called before transport is ready.
      // This is a known limitation documented in COMPATIBILITY.md.
    }
  }

  /**
   * Disconnect a peer.
   * @param netId - The peer ID
   * @param data - Disconnect data
   */
  disconnect(netId: number, data: number = 0): void {
    this._host.peerDisconnect(netId, data);
  }

  /**
   * Destroy the host and free resources.
   */
  destroy(): void {
    this.socket.close();
    try {
      this._host.free();
    } catch {
      // WASM Host may have borrow issues after certain operations
      // This is a known limitation documented in COMPATIBILITY.md
    }
  }
}

/**
 * Creates a new ENet host with growtopia.js-compatible constructor signature.
 * This is the primary compatibility function for migrating from growtopia.js.
 *
 * @param ipAddress - The IP address to bind to
 * @param port - The port number to bind to
 * @param peerLimit - The maximum number of peers that should be allocated for the host
 * @param channelLimit - The maximum number of channels allowed (cannot be 0)
 * @param usingNewPacket - Whether to use new packet format
 * @param usingNewPacketServer - Whether server uses new packet format
 * @param incomingBandwidthLimit - Downstream bandwidth limit in bytes/second, or null for no limit
 * @param outgoingBandwidthLimit - Upstream bandwidth limit in bytes/second, or null for no limit
 * @param enableCompressor - Enable RangeCoder compression (defaults to true)
 * @param enableChecksum - Enable CRC32 checksum validation (defaults to true)
 * @param seed - Random number generator seed (unused in WASM, accepted for compatibility)
 * @returns CompatHost instance compatible with growtopia.js Host
 */
export function createHost(
  ipAddress: string,
  port: number,
  peerLimit: number = 32,
  channelLimit: number = 2,
  usingNewPacket: boolean = true,
  usingNewPacketServer: boolean = false,
  incomingBandwidthLimit?: number | null,
  outgoingBandwidthLimit?: number | null,
  enableCompressor?: boolean | null,
  enableChecksum?: boolean | null,
  seed?: number | null
): CompatHost {
  return new CompatHost(
    ipAddress,
    port,
    peerLimit,
    channelLimit,
    usingNewPacket,
    usingNewPacketServer,
    incomingBandwidthLimit,
    outgoingBandwidthLimit,
    enableCompressor,
    enableChecksum,
    seed
  );
}
