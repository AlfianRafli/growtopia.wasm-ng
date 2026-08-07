import test from "ava";
import { init, TextPacket, TankPacket, Variant, Collection, NodeENetServer } from "../dist/index.mjs";

test.before(async () => {
  await init();
});

test("ESModule: TextPacket creation and parsing", t => {
  const packet = TextPacket.from(3, "action|refresh_item_data", "");
  const buf = packet.parse();
  t.true(Buffer.isBuffer(buf));

  const parsed = TextPacket.fromBuffer(buf);
  t.is(parsed.type, 3);
  t.is(parsed.strings[0], "action|refresh_item_data");
});

test("ESModule: TankPacket creation and parsing", t => {
  const tank = TankPacket.from({
    type: 0x3,
    netID: 10,
    xPos: 100.5,
    yPos: 200.25
  });
  const buf = tank.parse();
  t.true(Buffer.isBuffer(buf));

  const parsed = TankPacket.fromBuffer(buf);
  t.truthy(parsed.data);
  t.is(parsed.data.type, 0x3);
  t.is(parsed.data.netID, 10);
  t.is(parsed.data.xPos, 100.5);
});

test("ESModule: Variant creation, parse and toArray", t => {
  const variant = Variant.from({ netID: 1, delay: 0 }, "OnConsoleMessage", "Hello Growtopia!");
  const tank = variant.parse();
  t.truthy(tank);

  const buf = tank.parse();
  t.true(Buffer.isBuffer(buf));

  const arr = Variant.toArray(buf);
  t.is(arr.length, 2);
  t.is(arr[0].value, "OnConsoleMessage");
  t.is(arr[1].value, "Hello Growtopia!");
});

test("ESModule: Collection utility methods", t => {
  const col = new Collection();
  col.set(1, "Alpha");
  col.set(2, "Beta");
  col.set(3, "Gamma");

  t.false(col.empty);
  t.is(col.first(), "Alpha");
  t.is(col.last(), "Gamma");
  t.deepEqual(col.first(2), ["Alpha", "Beta"]);
  t.is(col.filter(v => v.startsWith("A")).length, 1);
  t.deepEqual(
    col.map(v => v.toLowerCase()),
    ["alpha", "beta", "gamma"]
  );
});

test("ESModule: NodeENetHost cache.peers collection initialization", t => {
  const server = new NodeENetServer("127.0.0.1", 0, 10, 2);
  t.truthy(server.cache);
  t.truthy(server.cache.peers);
  t.true(server.cache.peers.empty);
});
