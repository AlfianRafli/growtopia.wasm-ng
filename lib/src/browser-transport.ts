import { Host, push_incoming_packet, Packet, JsHostSettings } from "../../pkg/growtopia_wasm.js";
import { createNanoEvents, Emitter } from "nanoevents";
import { Peer } from "./Peer";
import { Collection } from "../utils/Collection";

/**
 * ENet event signatures for connection, disconnection, and packet reception.
 */
export interface ENetEvents {
  /** Fired when a new remote peer successfully connects. */
  connect: (peer: Peer) => void;
  /** Fired when a peer disconnects. */
  disconnect: (peer: Peer, data: number) => void;
  /** Fired when an incoming ENet packet is received from a peer. */
  receive: (peer: Peer, packet: Packet, channel: number) => void;
}

/**
 * Base Browser ENet Host wrapper using WebRTC RTCDataChannel transport.
 */
export class BrowserENetHost {
  private dataChannel?: RTCDataChannel;
  private timer?: number;

  /** Event emitter instance for subscribing to connect, disconnect, and receive events. */
  public emitter: Emitter<ENetEvents>;

  /** Underlying WebAssembly Host instance. */
  public host: Host;

  /** In-memory cache holding active Peer wrapper instances. */
  public cache = {
    peers: new Collection<number, Peer>()
  };

  protected constructor(settings: JsHostSettings) {
    this.emitter = createNanoEvents<ENetEvents>();

    const sendCallback = (ip: string, port: number, data: Uint8Array) => {
      if (!this.dataChannel || this.dataChannel.readyState !== "open") {
        throw new Error("RTCDataChannel is not open or attached.");
      }
      this.dataChannel.send(data as any);
    };

    this.host = new Host("0.0.0.0", 0, settings, sendCallback);
  }

  private getPeer(id: number): Peer {
    if (!this.cache.peers.has(id)) {
      this.cache.peers.set(id, new Peer(this.host, id));
    }
    return this.cache.peers.get(id)!;
  }

  /**
   * Attaches a WebRTC RTCDataChannel for transporting ENet packet payloads.
   *
   * @param channel - Open RTCDataChannel instance.
   */
  public attachDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;
    this.dataChannel.binaryType = "arraybuffer";

    this.dataChannel.addEventListener("message", event => {
      push_incoming_packet(this.host.id, "192.168.1.1", 1234, new Uint8Array(event.data));
    });

    this.dataChannel.addEventListener("error", event => {
      throw event;
    });
  }

  /**
   * Initiates a connection request to a peer endpoint over WebRTC.
   *
   * @param ip - Target host IP address.
   * @param port - Target host port.
   * @param channelCount - Number of ENet channels to allocate.
   * @param data - User data integer passed in connect request.
   * @returns Connected Peer wrapper instance.
   */
  public connect(ip: string, port: number, channelCount: number, data: number): Peer {
    const peerId = this.host.connect(ip, port, channelCount, data);
    return this.getPeer(peerId);
  }

  /**
   * Dispatches pending ENet network events synchronously.
   */
  public service() {
    return this.host.service();
  }

  /**
   * Checks for queued ENet events.
   */
  public checkEvents() {
    return this.host.checkEvents();
  }

  /**
   * Starts an asynchronous polling loop to process ENet events.
   *
   * @param ms - Polling interval duration in milliseconds (default: 15ms).
   * @param options - Polling options such as auto-freeing received packets.
   */
  public startPolling(ms: number = 15, options: { autoFreePacket?: boolean; autoFreePeer?: boolean } = {}) {
    const autoFreePacket = options.autoFreePacket !== false;

    if (this.timer) return;
    this.timer = setInterval(() => {
      let event;
      while ((event = this.host.service()) && event.eventType !== 0) {
        switch (event.eventType) {
          case 1: {
            const peer = this.getPeer(event.peerId);
            this.emitter.emit("connect", peer);
            break;
          }
          case 2: {
            const peer = this.getPeer(event.peerId);
            const data = event.data;
            this.emitter.emit("disconnect", peer, data);
            this.cache.peers.delete(event.peerId);
            break;
          }
          case 3: {
            const peer = this.getPeer(event.peerId);
            const packet = event.packet()!;
            const channelId = event.channelId;
            this.emitter.emit("receive", peer, packet, channelId);

            if (autoFreePacket) packet.free();
            break;
          }
        }
      }
    }, ms) as unknown as number;
  }

  /**
   * Stops the active event polling loop.
   */
  public stopPolling() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}

/**
 * High-level Browser ENet Client host configured for WebRTC client specs.
 */
export class BrowserENetClient extends BrowserENetHost {
  constructor(peerCount: number = 1, channelLimit: number = 2) {
    const settings = new JsHostSettings();
    settings.peerLimit = peerCount;
    settings.channelLimit = channelLimit;
    settings.usingNewPacket = true;
    settings.usingNewPacketServer = false;
    super(settings);
  }
}

/**
 * High-level Browser ENet Server host configured for WebRTC server specs.
 */
export class BrowserENetServer extends BrowserENetHost {
  constructor(peerCount: number, channelLimit: number) {
    const settings = new JsHostSettings();
    settings.peerLimit = peerCount;
    settings.channelLimit = channelLimit;
    settings.usingNewPacket = false;
    settings.usingNewPacketServer = true;
    super(settings);
  }
}
