'use strict';
const fs = require('node:fs');
const net = require('node:net');
const tls = require('node:tls');
const crypto = require('node:crypto');

function required(name) { if (!process.env[name]) throw new Error(`Missing ${name}`); return process.env[name]; }
function port(name, fallback) { const p = Number(process.env[name] || fallback); if (!Number.isInteger(p) || p < 1 || p > 65535) throw new Error(`Invalid ${name}`); return p; }
const mode = required('TUNNEL_MODE');
const credentials = { key: fs.readFileSync(required('TUNNEL_KEY')), cert: fs.readFileSync(required('TUNNEL_CERT')), ca: fs.readFileSync(required('TUNNEL_CA')), minVersion: 'TLSv1.2', rejectUnauthorized: true };
function lines(socket, callback) {
  let pending = Buffer.alloc(0);
  const onData = chunk => {
    pending = Buffer.concat([pending, chunk]);
    const end = pending.indexOf(10);
    if (end < 0) { if (pending.length > 4096) socket.destroy(); return; }
    if (end > 4096) return socket.destroy();
    const line = pending.subarray(0, end).toString('utf8');
    const rest = pending.subarray(end + 1);
    socket.removeListener('data', onData);
    socket.pause();
    callback(line, rest);
  };
  socket.on('data', onData);
}
function bridge(a, b, remainder) {
  a.on('error', () => b.destroy()); b.on('error', () => a.destroy());
  a.on('close', () => b.destroy()); b.on('close', () => a.destroy());
  if (remainder.length) b.write(remainder);
  a.pipe(b); b.pipe(a); a.resume(); b.resume();
}
if (mode === 'server') {
  let control = null;
  const pending = new Map();
  let active = 0;
  const server = tls.createServer({ ...credentials, requestCert: true }, socket => {
    socket.setKeepAlive(true, 15000);
    socket.setTimeout(10000, () => socket.destroy());
    socket.on('error', () => {});
    lines(socket, (line, rest) => {
      if (line === 'CONTROL' && !control && !rest.length) {
        control = socket; socket.setTimeout(0); socket.resume();
        socket.on('data', () => socket.destroy());
        socket.on('close', () => { if (control === socket) control = null; for (const [, item] of pending) { clearTimeout(item.timer); item.socket.destroy(); } pending.clear(); });
      } else if (/^DATA [a-f0-9]{64}$/.test(line)) {
        const id = line.slice(5), item = pending.get(id);
        if (!item) return socket.destroy();
        pending.delete(id); clearTimeout(item.timer); socket.setTimeout(0); bridge(socket, item.socket, rest);
      } else socket.destroy();
    });
  });
  server.on('tlsClientError', () => {});
  server.listen(port('TUNNEL_TLS_PORT', 9443), process.env.TUNNEL_TLS_HOST || '0.0.0.0');
  net.createServer(socket => {
    socket.on('error', () => {}); socket.pause();
    if (!control || control.destroyed || active >= 128) return socket.destroy();
    active++; socket.once('close', () => { active--; });
    const id = crypto.randomBytes(32).toString('hex');
    const timer = setTimeout(() => { pending.delete(id); socket.destroy(); }, 10000);
    pending.set(id, { socket, timer });
    socket.on('close', () => { const item = pending.get(id); if (item) { clearTimeout(item.timer); pending.delete(id); } });
    control.write(`${id}\n`);
  }).listen(port('TUNNEL_LISTEN_PORT', 18082), '127.0.0.1');
} else if (mode === 'client') {
  const host = required('TUNNEL_SERVER_HOST'), servername = required('TUNNEL_SERVER_NAME');
  const connect = () => tls.connect({ ...credentials, host, servername, port: port('TUNNEL_TLS_PORT', 9443) });
  function run() {
    const control = connect(); control.setKeepAlive(true, 15000); let buffer = '';
    control.on('secureConnect', () => control.write('CONTROL\n'));
    control.on('error', () => {});
    control.on('close', () => setTimeout(run, 2000));
    control.on('data', chunk => {
      buffer += chunk.toString('ascii');
      if (buffer.length > 8192) return control.destroy();
      let i; while ((i = buffer.indexOf('\n')) >= 0) {
        const id = buffer.slice(0, i); buffer = buffer.slice(i + 1);
        if (!/^[a-f0-9]{64}$/.test(id)) return control.destroy();
        const data = connect(); data.on('error', () => {});
        data.on('secureConnect', () => {
          const upstream = net.connect(port('TUNNEL_TARGET_PORT', 18080), '127.0.0.1');
          upstream.on('error', () => data.destroy());
          upstream.on('connect', () => { data.write(`DATA ${id}\n`); bridge(data, upstream, Buffer.alloc(0)); });
        });
      }
    });
  }
  run();
} else throw new Error('TUNNEL_MODE must be server or client');
