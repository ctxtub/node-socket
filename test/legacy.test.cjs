'use strict';
require('ts-node').register({ files: true });
const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const RpcServer = require('../src/server').default;
const SocksServer = require('../src/socks5Server').default;

test('legacy listeners bind loopback and assign connection IDs', async () => {
  for (const Constructor of [RpcServer, SocksServer]) {
    const service = new Constructor();
    service.on('error', () => {});
    service.listen(0);
    const server = service.server;
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    assert.equal(server.address().address, '127.0.0.1');
    const socket = net.connect(server.address().port, '127.0.0.1');
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('error', reject); });
    await new Promise(resolve => setTimeout(resolve, 50));
    if (Constructor === RpcServer) assert.equal(Object.keys(service.clients).length, 1);
    socket.destroy();
    await new Promise(resolve => server.close(resolve));
  }
});
