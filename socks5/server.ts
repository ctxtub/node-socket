
import rpcServerConstructor from '../src/server'
import { Socket } from 'net'
import log4js from '../src/utils/log4js'
const loggerServer4Sock = log4js('server4Socks5')

const rpcServer = new rpcServerConstructor()

// Internet连接池
const internetConnectPool:any = {}

// Internet连接方法
let connectInternet = function (rpcClinetId: string, host: string, port: number, data: Buffer, sockId: string) {
  if (port < 0 || host === '127.0.0.1') return

  let socket = new Socket();
  (socket as customSocket).id = sockId

  // 公网连接池
  internetConnectPool[sockId] = socket

  socket.connect(port, host, () => {
    loggerServer4Sock.info(`创建公网连接 -> host: ${host}, port: ${port}; 来源方 RpcClient Id: ${rpcClinetId}; 来源方 socks5 Client Id: ${sockId}`)
    loggerServer4Sock.info(`internetConnectPool 当前连接数： ${Object.keys(internetConnectPool).length}`)
    // 流量发送给公网目标
    socket.write(Buffer.from(data))
  });

  // 转发公网流量给 rpcClient
  socket.on('data', (data) => {
    loggerServer4Sock.debug(`收到公网数据 -> host: ${host}, port: ${port}; 来源方 RpcClient Id: ${rpcClinetId}; 来源方 socks5 Client Id: ${sockId}`)
    rpcServer.write(rpcClinetId, {version: 1, header: {sockId}, data: data})
  });

  socket.once('close', () => {
    loggerServer4Sock.info(`公网连接关闭 -> host: ${host}, port: ${port}; 来源方 RpcClient Id: ${rpcClinetId}; 来源方 socks5 Client Id: ${sockId}`)
    // 请求 rpcClient 关闭对应 Socks5 Client Id 的连接
    rpcServer.write(rpcClinetId, {version: 1, header: {sockId, destroy: true}, data: null})
    // 关闭连接时清除连接池中 socket 实例
    delete internetConnectPool[sockId]
  });

  socket.once('error', err => {
    if (err) {
      loggerServer4Sock.info(`公网连接报错 -> host: ${host}, port: ${port}; 来源方 RpcClient Id: ${rpcClinetId}; 来源方 socks5 Client Id: ${sockId}`)
      loggerServer4Sock.info(err)
    }
  })
}

// rpcServer初始化并监听端口
rpcServer.listen()

// rpcServer报错事件监听
rpcServer.once('error', (err: Error) => loggerServer4Sock.error(`rpcServer 报错啦：${JSON.stringify(err)}`))

// rpcServer关闭事件监听
rpcServer.once('close', (err: Error) => loggerServer4Sock.warn('rpcServer 连接中断'))

// rpcServer接收转发事件
rpcServer.on('payload', ({error, id: rpcClinetId, data}) => {
  const { header, data: buf } = data
  const { sockId, host, port, destroy } = header
  loggerServer4Sock.debug(`rpcServer 接收到数据了 -> RpcClient Id:${rpcClinetId}`)
  
  if (error) {
    loggerServer4Sock.warn(`解包失败，数据存在异常。来源方 RpcClient Id: ${rpcClinetId}`)
    return
  }

  if (destroy) {
    loggerServer4Sock.info(`rpcClient 要求关闭指定公网连接 -> Socks5 Client ID: ${sockId}`)
    // rpcClient 要求关闭指定公网连接，其标识为 Socks5 Client ID
    const socket = internetConnectPool[sockId]
    socket && (socket.destroyed || socket.destroy())
    loggerServer4Sock.info(`internetConnectPool 当前连接数： ${Object.keys(internetConnectPool).length}`)
    return
  }
 
  if (internetConnectPool[sockId]) {
    // 如果Internet连接池已有sockId，则直接转发数据
    loggerServer4Sock.debug(`发送数据至公网连接 -> host: ${host}, port: ${port}; 来源方 RpcClient Id: ${rpcClinetId}; 来源方 socks5 Client Id: ${sockId}`)
    internetConnectPool[sockId].write(Buffer.from(buf))
  } else {
    // 创建新连接
    connectInternet(rpcClinetId, host, port, buf, sockId)
  }
})
