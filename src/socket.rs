use wasm_bindgen::prelude::*;
use rusty_enet::{Socket, SocketOptions, PacketReceived, MTU_MAX};
use std::collections::VecDeque;
use core::net::{SocketAddr, IpAddr};
use std::str::FromStr;
use std::cell::RefCell;
use js_sys::Function;
use js_sys::Uint8Array;

#[derive(Debug)]
pub struct WasmSocketError;
impl core::fmt::Display for WasmSocketError {
    fn fmt(&self, f: &mut core::fmt::Formatter) -> core::fmt::Result { write!(f, "Socket Error") }
}
impl std::error::Error for WasmSocketError {}

pub struct JsUdpSocket {
    pub local_addr: SocketAddr,
    pub host_id: u32,
    pub send_callback: Function,
}

thread_local! {
    static INCOMING_PACKETS: RefCell<VecDeque<(u32, SocketAddr, Vec<u8>)>> = RefCell::new(VecDeque::new());
}

#[wasm_bindgen]
pub fn push_incoming_packet(host_id: u32, ip: &str, port: u16, data: &[u8]) {
    if let Ok(ip_addr) = IpAddr::from_str(ip) {
        let addr = SocketAddr::new(ip_addr, port);
        INCOMING_PACKETS.with(|q| {
            q.borrow_mut().push_back((host_id, addr, data.to_vec()));
        });
    }
}

impl Socket for JsUdpSocket {
    type Address = SocketAddr;
    type Error = WasmSocketError;

    fn init(&mut self, _options: SocketOptions) -> Result<(), Self::Error> {
        Ok(())
    }

    fn send(&mut self, address: Self::Address, buffer: &[u8]) -> Result<usize, Self::Error> {
        let ip = JsValue::from_str(&address.ip().to_string());
        let port = JsValue::from_f64(address.port() as f64);
        let data = Uint8Array::from(buffer);
        let _ = self.send_callback.call3(&JsValue::NULL, &ip, &port, &data.into());
        Ok(buffer.len())
    }

    fn receive(
        &mut self,
        buffer: &mut [u8; MTU_MAX],
    ) -> Result<Option<(Self::Address, PacketReceived)>, Self::Error> {
        let mut found = None;
        INCOMING_PACKETS.with(|q| {
            let mut q_ref = q.borrow_mut();
            if let Some(index) = q_ref.iter().position(|x| x.0 == self.host_id) {
                found = q_ref.remove(index);
            }
        });
        
        if let Some((_, addr, data)) = found {
            let len = data.len().min(MTU_MAX);
            buffer[..len].copy_from_slice(&data[..len]);
            
            if data.len() > MTU_MAX {
                Ok(Some((addr, PacketReceived::Partial)))
            } else {
                Ok(Some((addr, PacketReceived::Complete(len))))
            }
        } else {
            Ok(None)
        }
    }

    fn address(&self) -> Self::Address {
        self.local_addr
    }
}
