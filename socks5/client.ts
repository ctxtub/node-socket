import SockServerConstructor from '../src/socks5Server'
import rpcClientConstructor  from '../src/client'
import log4js from '../src/utils/log4js'
const loggerClient4Sock = log4js('client4Socks5')

const sockServer = new SockServerConstructor()
const rpcClient = new rpcClientConstructor()

// sockServer初始化并监听端口
sockServer.listen(8888)

// sockServer报错事件监听
sockServer.once('error', (err: Error) => loggerClient4Sock.error(`sockServer 报错啦：${err}`))

// sockServer关闭事件监听
sockServer.once('close', () => loggerClient4Sock.warn('sockServer 已关闭'))

// sockServer连接转发事件
sockServer.on('tunnel', (host, port, socket) => {
  // 连接数检查
  sockServer.getClients().then(res => {loggerClient4Sock.info(`sockServer 当前连接数: ${res}, ${Object.keys(sockServer.clients).length}`)})

  // socks5客户端 数据监听
  socket.on('data', (data: Buffer) => {
    loggerClient4Sock.debug(`sockServer 接收数据了 -> Socks5 Client ID: ${socket.id}, host: ${host}, port: ${port}`)
    // 流量通过rpcClient转发给rpcServer
    rpcClient.write({version: 1, header: {sockId: socket.id, host, port}, data})
  })

  socket.once('close', () => {
    // 请求 rpcServer 关闭对应 Socks5 Client Id 的连接
    rpcClient.write({version: 1, header: {sockId: socket.id, destroy: true}, data: null})
  })
})


// rpcClient创建连接
rpcClient.connect({port: 8000, host: 'localhost'})

// rpcClient连接成功事件监听
rpcClient.once('connect', () => loggerClient4Sock.info('rpcClient 连接服务器成功'))

// rpcClient报错事件监听
rpcClient.once('error', (err: Error) => loggerClient4Sock.error(`rpcClient 报错啦：${err}`))

// rpcClient关闭事件监听
rpcClient.once('close', (err: Error) => loggerClient4Sock.warn('rpcClient 连接中断'))

// rpcClient接收消息事件监听
rpcClient.on('payload', ({error, id, data}) => {
  const { header, data: buf } = data
  const { sockId, destroy } = header
  loggerClient4Sock.debug(`rpcClient 接收到数据了 -> 接收方 Socks5 Client ID: ${sockId}`)
  
  if (error) {
    loggerClient4Sock.warn(`解包失败，RpcServer 发送数据存在异常。`)
    return
  }

  if (destroy) {
    loggerClient4Sock.info(`rpcServer 要求关闭指定 Socks5 Client ID 连接 -> Socks5 Client ID: ${sockId}`)
    // rpcServer 要求关闭指定 Socks5 Client ID 连接
    const socket = sockServer.clients[sockId]
    socket && (socket.destroyed || socket.destroy())
    sockServer.getClients().then(res => {loggerClient4Sock.info(`sockServer 当前连接数: ${res}, ${Object.keys(sockServer.clients).length}`)})
    return
  }

  // 通过sockServer，将流量转发 Socks5 Client
  sockServer.write(sockId, Buffer.from(buf))
})
