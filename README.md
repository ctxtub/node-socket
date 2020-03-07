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