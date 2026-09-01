mod socket;
use socket::JsUdpSocket;

use core::net::{IpAddr, SocketAddr};
use rusty_enet::{
    Event as ENetEvent, Host as ENetHost, HostSettings, Packet as ENetPacket,
    PacketKind as ENetPacketKind, PeerID, PeerState as ENetPeerState, MTU_MAX as ENET_MTU_MAX,
};
use std::str::FromStr;
use std::sync::atomic::{AtomicU32, Ordering};
use wasm_bindgen::prelude::*;

static HOST_ID_COUNTER: AtomicU32 = AtomicU32::new(1);

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console, js_name = error)]
    fn console_error(s: &str);
}

#[wasm_bindgen(start)]
pub fn main_js() {
    std::panic::set_hook(Box::new(|info| {
        console_error(&format!("Rust Panic: {}", info));
    }));
}

#[wasm_bindgen]
pub fn crc32(buffers: js_sys::Array) -> u32 {
    let mut data = Vec::new();
    for i in 0..buffers.length() {
        if let Some(buf) = buffers.get(i).dyn_ref::<js_sys::Uint8Array>() {
            data.extend_from_slice(&buf.to_vec());
        }
    }
    rusty_enet::crc32(&[&data])
}

#[wasm_bindgen(js_name = timeSinceEpoch)]
pub fn time_since_epoch() -> u32 {
    rusty_enet::time_since_epoch().as_millis() as u32
}

#[wasm_bindgen(js_name = mtuMax)]
pub fn mtu_max() -> usize {
    ENET_MTU_MAX
}

#[wasm_bindgen]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PeerState {
    Disconnected = 0,
    Connecting = 1,
    AcknowledgingConnect = 2,
    ConnectionPending = 3,
    ConnectionSucceeded = 4,
    Connected = 5,
    DisconnectLater = 6,
    Disconnecting = 7,
    AcknowledgingDisconnect = 8,
    Zombie = 9,
}

#[wasm_bindgen]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PacketKind {
    Reliable = 0,
    Unreliable = 1,
    Unsequenced = 2,
    ReliableUnsequenced = 3,
    UnreliableFragment = 4,
}

#[wasm_bindgen]
#[allow(non_snake_case)]
pub struct JsHostSettings {
    pub peerLimit: usize,
    pub channelLimit: usize,
    pub incomingBandwidth: u32,
    pub outgoingBandwidth: u32,
    pub usingNewPacket: bool,
    pub usingNewPacketServer: bool,
    pub useCrc32: bool,
    pub useRangeCoder: bool,
}

#[wasm_bindgen]
#[allow(non_snake_case)]
impl JsHostSettings {
    #[wasm_bindgen(constructor)]
    pub fn new() -> JsHostSettings {
        JsHostSettings {
            peerLimit: 1,
            channelLimit: 2,
            incomingBandwidth: 0,
            outgoingBandwidth: 0,
            usingNewPacket: false,
            usingNewPacketServer: false,
            useCrc32: true,
            useRangeCoder: true,
        }
    }
}

#[wasm_bindgen]
pub struct Host {
    inner: ENetHost<JsUdpSocket>,
    pub id: u32,
}

#[wasm_bindgen]
pub struct Packet {
    inner: ENetPacket,
}

#[wasm_bindgen]
#[allow(non_snake_case)]
pub struct Event {
    pub eventType: u8, // 0 = None, 1 = Connect, 2 = Disconnect, 3 = Receive
    pub peerId: usize,
    packet: Option<Packet>,
    pub channelId: u8,
    pub data: u32,
}

#[wasm_bindgen]
#[allow(non_snake_case)]
impl Packet {
    #[wasm_bindgen(constructor)]
    pub fn new(data: &[u8], kind: PacketKind) -> Packet {
        let ekind = match kind {
            PacketKind::Reliable => ENetPacketKind::Reliable,
            PacketKind::Unreliable => ENetPacketKind::Unreliable { sequenced: true },
            PacketKind::Unsequenced => ENetPacketKind::Unreliable { sequenced: false },
            PacketKind::ReliableUnsequenced => ENetPacketKind::Reliable, // Fallback
            PacketKind::UnreliableFragment => ENetPacketKind::AlwaysUnreliable { sequenced: true },
        };
        let inner = ENetPacket::new(data.to_vec(), ekind);
        Packet { inner }
    }

    pub fn data(&self) -> Vec<u8> {
        self.inner.data().to_vec()
    }
}

#[wasm_bindgen]
#[allow(non_snake_case)]
impl Event {
    pub fn packet(&self) -> Option<Packet> {
        self.packet.as_ref().map(|p| Packet {
            inner: p.inner.clone(),
        })
    }
}

#[wasm_bindgen]
#[allow(non_snake_case)]
impl Host {
    #[wasm_bindgen(constructor)]
    pub fn new(
        bindIp: &str,
        bindPort: u16,
        jsSettings: &JsHostSettings,
        sendCallback: &js_sys::Function,
    ) -> Result<Host, JsValue> {
        let id = HOST_ID_COUNTER.fetch_add(1, Ordering::SeqCst);
        let ip_addr =
            IpAddr::from_str(bindIp).unwrap_or(IpAddr::V4(core::net::Ipv4Addr::UNSPECIFIED));
        let addr = SocketAddr::new(ip_addr, bindPort);
        let sock = JsUdpSocket {
            local_addr: addr,
            host_id: id,
            send_callback: sendCallback.clone(),
        };

        let mut settings = HostSettings::default();
        settings.peer_limit = jsSettings.peerLimit;
        settings.channel_limit = jsSettings.channelLimit;
        settings.incoming_bandwidth_limit = if jsSettings.incomingBandwidth == 0 {
            None
        } else {
            Some(jsSettings.incomingBandwidth)
        };
        settings.outgoing_bandwidth_limit = if jsSettings.outgoingBandwidth == 0 {
            None
        } else {
            Some(jsSettings.outgoingBandwidth)
        };
        settings.using_new_packet = jsSettings.usingNewPacket;
        settings.using_new_packet_server = jsSettings.usingNewPacketServer;

        if jsSettings.useCrc32 {
            settings.checksum = Some(Box::new(rusty_enet::crc32));
        }
        if jsSettings.useRangeCoder {
            settings.compressor = Some(Box::new(rusty_enet::RangeCoder::new()));
        }

        let host = ENetHost::new(sock, settings)
            .map_err(|e| JsValue::from_str(&format!("Failed to create host: {:?}", e)))?;

        Ok(Host { inner: host, id })
    }

    pub fn connect(
        &mut self,
        ip: &str,
        port: u16,
        channelCount: usize,
        data: u32,
    ) -> Result<usize, JsValue> {
        let ip_addr = IpAddr::from_str(ip).map_err(|_| JsValue::from_str("Invalid IP"))?;
        let addr = SocketAddr::new(ip_addr, port);

        let peer_ref = self
            .inner
            .connect(addr, channelCount, data)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;

        Ok(peer_ref.id().0)
    }

    pub fn service(&mut self) -> Result<Event, JsValue> {
        let event = self
            .inner
            .service()
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;

        match event {
            Some(ENetEvent::Connect { peer, data, .. }) => Ok(Event {
                eventType: 1,
                peerId: peer.id().0,
                packet: None,
                channelId: 0,
                data,
            }),
            Some(ENetEvent::Disconnect { peer, data, .. }) => Ok(Event {
                eventType: 2,
                peerId: peer.id().0,
                packet: None,
                channelId: 0,
                data,
            }),
            Some(ENetEvent::Receive {
                peer,
                channel_id,
                packet,
            }) => Ok(Event {
                eventType: 3,
                peerId: peer.id().0,
                packet: Some(Packet { inner: packet }),
                channelId: channel_id,
                data: 0,
            }),
            None => Ok(Event {
                eventType: 0,
                peerId: usize::MAX,
                packet: None,
                channelId: 0,
                data: 0,
            }),
        }
    }

    #[wasm_bindgen(js_name = checkEvents)]
    pub fn check_events(&mut self) -> Result<Event, JsValue> {
        match self.inner.check_events() {
            Some(ENetEvent::Connect { peer, data, .. }) => Ok(Event {
                eventType: 1,
                peerId: peer.id().0,
                packet: None,
                channelId: 0,
                data,
            }),
            Some(ENetEvent::Disconnect { peer, data, .. }) => Ok(Event {
                eventType: 2,
                peerId: peer.id().0,
                packet: None,
                channelId: 0,
                data,
            }),
            Some(ENetEvent::Receive {
                peer,
                channel_id,
                packet,
            }) => Ok(Event {
                eventType: 3,
                peerId: peer.id().0,
                packet: Some(Packet { inner: packet }),
                channelId: channel_id,
                data: 0,
            }),
            None => Ok(Event {
                eventType: 0,
                peerId: usize::MAX,
                packet: None,
                channelId: 0,
                data: 0,
            }),
        }
    }

    pub fn flush(&mut self) {
        // Safe flush: rusty_enet panics if no peers connected and using_new_packet is true
        // Check if there are connected peers before calling flush
        let has_peers = self.inner.peers().next().is_some();
        if has_peers {
            self.inner.flush();
        }
    }

    pub fn broadcast(&mut self, channelId: u8, packet: &Packet) {
        self.inner.broadcast(channelId, &packet.inner)
    }

    #[wasm_bindgen(js_name = peerLimit)]
    pub fn peer_limit(&self) -> usize {
        self.inner.peer_limit()
    }

    #[wasm_bindgen(js_name = channelLimit)]
    pub fn channel_limit(&self) -> usize {
        self.inner.channel_limit()
    }

    #[wasm_bindgen(js_name = setChannelLimit)]
    pub fn set_channel_limit(&mut self, channelLimit: usize) -> Result<(), JsValue> {
        self.inner
            .set_channel_limit(channelLimit)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))
    }

    #[wasm_bindgen(js_name = setBandwidthLimit)]
    pub fn set_bandwidth_limit(&mut self, incoming: u32, outgoing: u32) -> Result<(), JsValue> {
        let inc = if incoming == 0 { None } else { Some(incoming) };
        let out = if outgoing == 0 { None } else { Some(outgoing) };
        self.inner
            .set_bandwidth_limit(inc, out)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))
    }

    #[wasm_bindgen(js_name = mtuLimit)]
    pub fn mtu_limit(&self) -> u16 {
        self.inner.mtu()
    }

    #[wasm_bindgen(js_name = setMtuLimit)]
    pub fn set_mtu_limit(&mut self, mtu: u16) -> Result<(), JsValue> {
        self.inner
            .set_mtu(mtu)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))
    }

    // --- Peer methods exposed on Host ---
    #[wasm_bindgen(js_name = peerSend)]
    pub fn peer_send(
        &mut self,
        peerId: usize,
        channelId: u8,
        packet: &Packet,
    ) -> Result<(), JsValue> {
        let peer = self.inner.peer_mut(PeerID(peerId));
        peer.send(channelId, &packet.inner)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))
    }

    #[wasm_bindgen(js_name = peerDisconnect)]
    pub fn peer_disconnect(&mut self, peerId: usize, data: u32) {
        let peer = self.inner.peer_mut(PeerID(peerId));
        peer.disconnect(data);
    }

    #[wasm_bindgen(js_name = peerDisconnectNow)]
    pub fn peer_disconnect_now(&mut self, peerId: usize, data: u32) {
        let peer = self.inner.peer_mut(PeerID(peerId));
        peer.disconnect_now(data);
    }

    #[wasm_bindgen(js_name = peerDisconnectLater)]
    pub fn peer_disconnect_later(&mut self, peerId: usize, data: u32) {
        let peer = self.inner.peer_mut(PeerID(peerId));
        peer.disconnect_later(data);
    }

    #[wasm_bindgen(js_name = peerAddressIp)]
    pub fn peer_address_ip(&mut self, peerId: usize) -> String {
        let peer = self.inner.peer_mut(PeerID(peerId));
        peer.address()
            .map(|a| a.ip().to_string())
            .unwrap_or_default()
    }

    #[wasm_bindgen(js_name = peerAddressPort)]
    pub fn peer_address_port(&mut self, peerId: usize) -> u16 {
        let peer = self.inner.peer_mut(PeerID(peerId));
        peer.address().map(|a| a.port()).unwrap_or(0)
    }

    #[wasm_bindgen(js_name = peerPing)]
    pub fn peer_ping(&mut self, peerId: usize) {
        self.inner.peer_mut(PeerID(peerId)).ping()
    }

    #[wasm_bindgen(js_name = peerReset)]
    pub fn peer_reset(&mut self, peerId: usize) {
        self.inner.peer_mut(PeerID(peerId)).reset()
    }

    #[wasm_bindgen(js_name = peerSetTimeout)]
    pub fn peer_set_timeout(&mut self, peerId: usize, limit: u32, minimum: u32, maximum: u32) {
        self.inner
            .peer_mut(PeerID(peerId))
            .set_timeout(limit, minimum, maximum)
    }

    #[wasm_bindgen(js_name = peerSetPingInterval)]
    pub fn peer_set_ping_interval(&mut self, peerId: usize, pingInterval: u32) {
        self.inner
            .peer_mut(PeerID(peerId))
            .set_ping_interval(pingInterval)
    }

    #[wasm_bindgen(js_name = peerSetThrottle)]
    pub fn peer_set_throttle(
        &mut self,
        peerId: usize,
        interval: u32,
        acceleration: u32,
        deceleration: u32,
    ) {
        self.inner
            .peer_mut(PeerID(peerId))
            .set_throttle(interval, acceleration, deceleration)
    }

    #[wasm_bindgen(js_name = peerMtu)]
    pub fn peer_mtu(&mut self, peerId: usize) -> u16 {
        self.inner.peer_mut(PeerID(peerId)).mtu()
    }

    #[wasm_bindgen(js_name = peerSetMtu)]
    pub fn peer_set_mtu(&mut self, peerId: usize, mtu: u16) -> Result<(), JsValue> {
        self.inner
            .peer_mut(PeerID(peerId))
            .set_mtu(mtu)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))
    }

    #[wasm_bindgen(js_name = peerState)]
    pub fn peer_state(&mut self, peerId: usize) -> PeerState {
        match self.inner.peer_mut(PeerID(peerId)).state() {
            ENetPeerState::Disconnected => PeerState::Disconnected,
            ENetPeerState::Connecting => PeerState::Connecting,
            ENetPeerState::AcknowledgingConnect => PeerState::AcknowledgingConnect,
            ENetPeerState::ConnectionPending => PeerState::ConnectionPending,
            ENetPeerState::ConnectionSucceeded => PeerState::ConnectionSucceeded,
            ENetPeerState::Connected => PeerState::Connected,
            ENetPeerState::DisconnectLater => PeerState::DisconnectLater,
            ENetPeerState::Disconnecting => PeerState::Disconnecting,
            ENetPeerState::AcknowledgingDisconnect => PeerState::AcknowledgingDisconnect,
            ENetPeerState::Zombie => PeerState::Zombie,
        }
    }

    #[wasm_bindgen(js_name = peerConnected)]
    pub fn peer_connected(&mut self, peerId: usize) -> bool {
        self.inner.peer_mut(PeerID(peerId)).connected()
    }

    #[wasm_bindgen(js_name = peerChannelCount)]
    pub fn peer_channel_count(&mut self, peerId: usize) -> usize {
        self.inner.peer_mut(PeerID(peerId)).channel_count()
    }

    #[wasm_bindgen(js_name = peerIncomingBandwidth)]
    pub fn peer_incoming_bandwidth(&mut self, peerId: usize) -> u32 {
        self.inner.peer_mut(PeerID(peerId)).incoming_bandwidth()
    }

    #[wasm_bindgen(js_name = peerOutgoingBandwidth)]
    pub fn peer_outgoing_bandwidth(&mut self, peerId: usize) -> u32 {
        self.inner.peer_mut(PeerID(peerId)).outgoing_bandwidth()
    }

    #[wasm_bindgen(js_name = peerIncomingDataTotal)]
    pub fn peer_incoming_data_total(&mut self, peerId: usize) -> u32 {
        self.inner.peer_mut(PeerID(peerId)).incoming_data_total()
    }

    #[wasm_bindgen(js_name = peerOutgoingDataTotal)]
    pub fn peer_outgoing_data_total(&mut self, peerId: usize) -> u32 {
        self.inner.peer_mut(PeerID(peerId)).outgoing_data_total()
    }

    #[wasm_bindgen(js_name = peerPacketsSent)]
    pub fn peer_packets_sent(&mut self, peerId: usize) -> u32 {
        self.inner.peer_mut(PeerID(peerId)).packets_sent()
    }

    #[wasm_bindgen(js_name = peerPacketsLost)]
    pub fn peer_packets_lost(&mut self, peerId: usize) -> u32 {
        self.inner.peer_mut(PeerID(peerId)).packets_lost()
    }

    #[wasm_bindgen(js_name = peerPacketLoss)]
    pub fn peer_packet_loss(&mut self, peerId: usize) -> u32 {
        self.inner.peer_mut(PeerID(peerId)).packet_loss()
    }

    #[wasm_bindgen(js_name = peerPacketLossVariance)]
    pub fn peer_packet_loss_variance(&mut self, peerId: usize) -> u32 {
        self.inner.peer_mut(PeerID(peerId)).packet_loss_variance()
    }

    #[wasm_bindgen(js_name = peerPingIntervalMs)]
    pub fn peer_ping_interval_ms(&mut self, peerId: usize) -> f64 {
        self.inner
            .peer_mut(PeerID(peerId))
            .ping_interval()
            .as_millis() as f64
    }

    #[wasm_bindgen(js_name = peerRoundTripTimeMs)]
    pub fn peer_round_trip_time_ms(&mut self, peerId: usize) -> f64 {
        self.inner
            .peer_mut(PeerID(peerId))
            .round_trip_time()
            .as_millis() as f64
    }

    #[wasm_bindgen(js_name = peerRoundTripTimeVarianceMs)]
    pub fn peer_round_trip_time_variance_ms(&mut self, peerId: usize) -> f64 {
        self.inner
            .peer_mut(PeerID(peerId))
            .round_trip_time_variance()
            .as_millis() as f64
    }
}
