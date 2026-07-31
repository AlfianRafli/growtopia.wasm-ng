import { createSocket, Socket } from "dgram";
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
 * Base Node.js ENet Host wrapper using native UDP sockets.
 */
export class NodeENetHost {
  private socket: Socket;
  private bindIp: string;
  private bindPort: number;
  private timer?: ReturnType<typeof setInterval>;

  /** Event emitter instance for subscribing to connect, disconnect, and receive events. */
  public emitter: Emitter<ENetEvents>;

  /** Underlying WebAssembly Host instance. */
  public host: Host;

  /** In-memory cache holding active Peer wrapper instances. */
  public cache = {
    peers: new Collection<number, Peer>()
  };

  protected constructor(bindIp: string, bindPort: number, settings: JsHostSettings) {
    this.bindIp = bindIp;
    this.bindPort = bindPort;
    this.socket = createSocket("udp4");
    this.emitter = createNanoEvents<ENetEvents>();

    const sendCallback = (ip: string, port: number, data: Uint8Array) => {
      try {
        const copiedData = Uint8Array.from(data);
        this.socket.send(copiedData, port, ip);
      } catch (e) {
        console.error("SOCKET SEND THREW AN ERROR:", e);
      }
    };

    this.host = new Host(bindIp, bindPort, settings, sendCallback);

    this.socket.on("message", (msg, rinfo) => {
      push_incoming_packet(this.host.id, rinfo.address, rinfo.port, new Uint8Array(msg));
    });

    this.socket.on("error", err => {
      console.error(`[DEBUG] socket error: ${err.message}`);
    });
  }

  private getPeer(id: number): Peer {
    if (!this.cache.peers.has(id)) {
      this.cache.peers.set(id, new Peer(this.host, id));
    }
    return this.cache.peers.get(id)!;
  }

  /**
   * Binds the underlying UDP socket to the configured IP address and port.
   *
   * @returns A promise resolving when the socket binding is established.
   */
  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const onError = (err: Error) => {
        reject(err);
      };
      this.socket.once("error", onError);

      if (this.bindPort > 0) {
        this.socket.bind(this.bindPort, this.bindIp, () => {
          this.socket.removeListener("error", onError);
          console.log(`ENet Host UDP bound to ${this.bindIp}:${this.bindPort}`);
          resolve();
        });
      } else {
        this.socket.bind(() => {
          this.socket.removeListener("error", onError);
          const addr = this.socket.address();
          console.log(`ENet Host UDP bound to random port ${addr.port}`);
          resolve();
        });
      }
    });
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
   * Starts an asynchronous polling loop to process incoming and outgoing ENet events at regular intervals.
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
    }, ms);
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

  /**
   * Connects to a remote ENet host endpoint.
   *
   * @param ip - Target host IP address.
   * @param port - Target host UDP port.
   * @param channelCount - Number of ENet channels to allocate.
   * @param data - User data integer passed in connect request.
   * @returns Connected Peer wrapper instance.
   */
  public connect(ip: string, port: number, channelCount: number, data: number): Peer {
    const peerId = this.host.connect(ip, port, channelCount, data);
    return this.getPeer(peerId);
  }
}

/**
 * High-level Node.js ENet Client host configured for client protocol specs.
 */
export class NodeENetClient extends NodeENetHost {
  constructor(bindIp: string = "0.0.0.0", bindPort: number = 0, peerCount: number = 1, channelLimit: number = 2) {
    const settings = new JsHostSettings();
    settings.peerLimit = peerCount;
    settings.channelLimit = channelLimit;
    settings.usingNewPacket = true;
    settings.usingNewPacketServer = false;
    super(bindIp, bindPort, settings);
  }
}

/**
 * High-level Node.js ENet Server host configured for server protocol specs.
 */
export class NodeENetServer extends NodeENetHost {
  constructor(bindIp: string, bindPort: number, peerCount: number, channelLimit: number) {
    const settings = new JsHostSettings();
    settings.peerLimit = peerCount;
    settings.channelLimit = channelLimit;
    settings.usingNewPacket = false;
    settings.usingNewPacketServer = true;
    super(bindIp, bindPort, settings);
  }
}
