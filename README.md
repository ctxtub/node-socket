# node-socket

基于Node.JS的 自定义TCP协议 与 Sock5协议，实现客户端与服务端的数据传输。



## 基本功能

- [x] 自定义协议 的客户端 + 服务端
- [x] SOCKS5协议 服务端
- [x] SOCKS5协议 + 自定义协议 的客户端 + 服务端
- [x] 日志收集
- [ ] 命令行操作 + 进程守护



## 自定义协议

### Protocol

| 1byte(版本号) | 4byte(协义总长度) | 4byte(协义头长度) | (...) byte消息头 | (...) byte消息体 |
| ------------- | ----------------- | ----------------- | ---------------- | ---------------- |
| 0             | 1-4               | 5-8               | m                | n                |

### 序列化

消息头 `header` 、消息体  `data`  使用 `JSON.stringify(..)` 转换，数据拼接完成后，以 200 byte 为单位分包并发送数据。

### 反序列化

接收完整数据后，进行解包操作，返回数据格式如下：

```javascript
{
	error: false, // 数据合法性标识 (Boolean)
	data: {
		version: 1, // 协议版本
		header: {}, // 消息头
		data: {} // 消息体
}
```



## SOCKS5 over Custom Protocol

具体细节可查看代码，代码内有详尽注释，参见下方目录结构。

### 客户端

客户端为 SOCKS5 Server + 自定义协议 Client 。可将本地流量发送至服务端处理。

### 服务端

服务端为 自定义协议 Server 。服务端接收客户端流量后进行请求操作，流量透传。



##  用命令启动它

```shell
// 自定义协议 Demo
npm run sever:example    // 服务端
npm run client:example   // 客户端

// SOCKS5 over Custom Protocol
npm run server:socks5     // 服务端
npm run client:socks5    // 客户端
```



## 目录结构

```
|-- README.md
|-- package.json
|-- tsconfig.json
|-- example               // 自定义协议 Demo
|   |-- client.ts
|   |-- server.ts
|-- socks5                // SOCKS5 over Custom Protocol
|   |-- client.ts
|   |-- server.ts
|-- src
    |-- client.ts         // 自定义协议 client
    |-- server.ts         // 自定义协议 server
    |-- socks5Server.ts   // SOCKS5协议 server
    |-- @types
    |   |-- index.d.ts
    |-- protocol
    |   |-- .DS_Store
    |   |-- deserialize.ts   // 反序列化
    |   |-- protocol.ts      // 协议标准
    |   |-- serialize.ts     // 序列化
    |-- utils
        |-- bufferToChunks.ts
        |-- sockUtils.ts
        |-- log4js           // 日志服务
            |-- config.ts
            |-- index.ts
```
## 固定上游反向隧道

`reverse/tunnel.cjs` 是独立于原 SOCKS5 协议的反向 TCP 隧道，运行于 Node.js 22.16 或更新版本。客户端主动连接云端，云端提供仅监听 `127.0.0.1` 的入口，适用于本机 HTTP 或 WebSocket 上游。TLS 双向认证需要专用 CA、服务端证书和客户端证书；请妥善保护私钥并定期轮换。此隧道本身不提供浏览器登录、HTTP 限流或公网 HTTPS，必须由反向代理另行配置。

云端环境变量：`TUNNEL_MODE=server`、`TUNNEL_KEY`、`TUNNEL_CERT`、`TUNNEL_CA`，可选 `TUNNEL_TLS_HOST`（默认 `0.0.0.0`）、`TUNNEL_TLS_PORT`（默认 9443）、`TUNNEL_LISTEN_PORT`（默认 18082）。私钥和证书变量均为绝对文件路径。云端 TCP 入口固定为回环地址，不能配置成公网监听。

本机环境变量：`TUNNEL_MODE=client`、`TUNNEL_KEY`、`TUNNEL_CERT`、`TUNNEL_CA`、`TUNNEL_SERVER_HOST`、`TUNNEL_SERVER_NAME`；可选 `TUNNEL_TLS_PORT`、`TUNNEL_TARGET_PORT`（默认 18080）。服务端名称必须匹配其证书，目标固定为本机回环地址。启动命令为 `npm run reverse`。连接断开后客户端会重新连接；未连接或等待队列满时入口连接会关闭。独立运行所需的 Node 原生模块不依赖 npm 包。

使用 `npm run typecheck` 检查原项目类型，`npm test` 运行本地回环与证书认证测试。旧 SOCKS5 实现不是公网加密隧道，应独立限制其监听与访问。

旧 RPC 和 SOCKS5 监听器默认只绑定 `127.0.0.1`；需要自定义监听地址时，可在程序中调用 `listen(port, host)`。旧协议本身没有认证或加密，请仅在受保护的网络中使用。
