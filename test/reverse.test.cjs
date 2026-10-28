'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const tls = require('node:tls');
const fs = require('node:fs');
const delay = ms => new Promise(r => setTimeout(r, ms));
test('mutual TLS reverse tunnel forwards bytes and rejects unknown clients', { timeout: 20000 }, async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'node-socket-test-'));
  const children = []; const servers = [];
  const openssl = (...args) => execFileSync('openssl', args, { cwd: dir, stdio: 'ignore' });
  try {
    openssl('req','-x509','-newkey','rsa:2048','-nodes','-keyout','ca.key','-out','ca.crt','-subj','/CN=test-ca','-days','1');
    for (const name of ['server','client']) {
      openssl('req','-newkey','rsa:2048','-nodes','-keyout',`${name}.key`,'-out',`${name}.csr`,'-subj',`/CN=${name}`);
      openssl('x509','-req','-in',`${name}.csr`,'-CA','ca.crt','-CAkey','ca.key','-CAcreateserial','-out',`${name}.crt`,'-days','1');
    }
    const listen = server => new Promise(resolve => server.listen(0,'127.0.0.1',() => resolve(server.address().port)));
    const target = net.createServer(s => s.pipe(s)); servers.push(target); const targetPort = await listen(target);
    const reserve = net.createServer(); const tlsPort = await listen(reserve); await new Promise(r=>reserve.close(r));
    const reserve2 = net.createServer(); const publicPort = await listen(reserve2); await new Promise(r=>reserve2.close(r));
    const start = (mode, name, extra) => { const child = spawn(process.execPath,[path.join(__dirname,'../reverse/tunnel.cjs')], {env:{...process.env,TUNNEL_MODE:mode,TUNNEL_KEY:path.join(dir,`${name}.key`),TUNNEL_CERT:path.join(dir,`${name}.crt`),TUNNEL_CA:path.join(dir,'ca.crt'),TUNNEL_TLS_PORT:String(tlsPort),...extra},stdio:'pipe'}); children.push(child); return child; };
    let relay = start('server','server',{TUNNEL_TLS_HOST:'127.0.0.1',TUNNEL_LISTEN_PORT:String(publicPort)});
    await delay(300);
    start('client','client',{TUNNEL_SERVER_HOST:'127.0.0.1',TUNNEL_SERVER_NAME:'server',TUNNEL_TARGET_PORT:String(targetPort)});
    await delay(500);
    const response = await new Promise((resolve,reject) => { const s=net.connect(publicPort,'127.0.0.1',()=>s.write('hello reverse')); s.on('data',d=>{resolve(d.toString()); s.destroy()}); s.on('error',reject); });
    assert.equal(response,'hello reverse');
    const unauthorized = await new Promise(resolve => { const s=tls.connect({host:'127.0.0.1',port:tlsPort,servername:'server',ca:fs.readFileSync(path.join(dir,'ca.crt'))},()=>s.write('CONTROL\n')); s.on('error',()=>resolve(true)); s.on('close',()=>resolve(true)); setTimeout(()=>{s.destroy(); resolve(false)},2000).unref(); });
    assert.equal(unauthorized,true);
    relay.kill(); await new Promise(r=>relay.once('exit',r));
    relay = start('server','server',{TUNNEL_TLS_HOST:'127.0.0.1',TUNNEL_LISTEN_PORT:String(publicPort)});
    await delay(2600);
    const afterReconnect = await new Promise((resolve,reject) => { const s=net.connect(publicPort,'127.0.0.1',()=>s.write('reconnected')); s.on('data',d=>{resolve(d.toString()); s.destroy()}); s.on('error',reject); s.on('close',()=>reject(new Error('closed before response'))); });
    assert.equal(afterReconnect,'reconnected');
  } finally { children.forEach(c=>c.kill()); servers.forEach(s=>s.close()); rmSync(dir,{recursive:true,force:true}); }
});
