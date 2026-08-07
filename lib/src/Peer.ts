import { Host, Packet, PacketKind } from "../pkg/growtopia_wasm.js";

/**
 * Represents a connected remote ENet peer endpoint.
 * Provides methods for transmitting packets, querying state, and managing connection lifecycle.
 */
export class Peer {
  private host: Host;
  /** The unique numeric ID assigned to this peer by the ENet host. */
  public id: number;

  /**
   * Instantiates a new Peer wrapper.
   *
   * @param host - Underlying WebAssembly Host instance.
   * @param id - Numeric peer ID.
   */
  constructor(host: Host, id: number) {
    this.host = host;
    this.id = id;
  }

  /**
   * Sends a WebAssembly ENet packet to the peer.
   *
   * @param packet - ENet Packet instance to transmit.
   * @param channel - ENet channel ID (defaults to 0).
   */
  public send(packet: Packet, channel: number = 0): void {
    this.host.peerSend(this.id, channel, packet);
  }

  /**
   * Encapsulates raw byte data into an ENet Packet and transmits it to the peer.
   *
   * @param data - Byte array containing payload data.
   * @param channel - ENet channel ID (defaults to 0).
   * @param flags - Reliability flag (0 = Unreliable, 1 = Reliable, 2 = Unsequenced).
   */
  public sendRaw(data: Uint8Array, channel: number = 0, flags: number = 1): void {
    let kind = PacketKind.Reliable;
    if (flags === 0) kind = PacketKind.Unreliable;
    else if (flags === 2) kind = PacketKind.Unsequenced;
    const packet = new Packet(data, kind);
    this.host.peerSend(this.id, channel, packet);
  }

  /**
   * Initiates a graceful disconnect request for this peer.
   *
   * @param data - Optional integer disconnect code.
   */
  public disconnect(data: number = 0): void {
    this.host.peerDisconnect(this.id, data);
  }

  /**
   * Forces an immediate abrupt disconnect for this peer without waiting for acknowledgments.
   *
   * @param data - Optional integer disconnect code.
   */
  public disconnectNow(data: number = 0): void {
    this.host.peerDisconnectNow(this.id, data);
  }

  /**
   * Schedules a disconnect for this peer after all queued outgoing packets are delivered.
   *
   * @param data - Optional integer disconnect code.
   */
  public disconnectLater(data: number = 0): void {
    this.host.peerDisconnectLater(this.id, data);
  }

  /**
   * Sends a ping request to update peer round-trip time calculations.
   */
  public ping(): void {
    this.host.peerPing(this.id);
  }

  /**
   * Resets peer connection state immediately, clearing allocated core resources.
   */
  public reset(): void {
    this.host.peerReset(this.id);
  }

  /**
   * Gets the current ENet connection state for this peer.
   */
  public get state(): number {
    return this.host.peerState(this.id);
  }

  /**
   * Gets the remote IP address of the peer.
   */
  public get ip(): string {
    return this.host.peerAddressIp(this.id);
  }

  /**
   * Gets the remote UDP port number of the peer.
   */
  public get port(): number {
    return this.host.peerAddressPort(this.id);
  }

  /**
   * Gets the current round-trip time (RTT) in milliseconds.
   */
  public get rtt(): number {
    return this.host.peerRoundTripTimeMs(this.id);
  }
}
