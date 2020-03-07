
import net from 'net'
import dns from 'dns'
import uuid from 'uuid'
import { EventEmitter } from 'events'
import { getIpv4, domainVerify } from '../src/utils/sockUtils'
import logger from '../src/utils/log4js'
const loggerServer = logger('Socks5Server')

const AUTH_USER_PASSWORD: {[propName: string]: string} = {
  'admin': '123456',
  'admin2': '654321'
}

// SOCK认证方式
// 本项目支持：不需要用户名或者密码验证、需要用户名和密码进行验证
const AUTH_METHOD_MAP = {
  NOAUTH: 0x00, // 不需要用户名或者密码验证
  USERPASS: 0x02, // 需要用户名和密码进行验证
  REFUSEAUTH: 0xFF // 不支持所有的验证方式
}

// CMD SOCK的命令码
// 本项目支持：CONNECT请求
const CMD_MAP = {
  CONNECT: 0x01, // CONNECT请求
  BIND: 0x02, // BIND请求
  UDP: 0x03 // UDP转发
}

// ATYP DST.ADDR类型
// 本项目支持：ipv4、host
const ATYP_MAP = {
  IPV4: 0x01, // IPv4地址，DST.ADDR部分4字节长度
  HOST: 0x03, // 域名，DST ADDR部分第一个字节为域名长度，DST.ADDR剩余的内容为域名，没有\0结尾
  IPV6: 0x04 // IPv6地址，16个字节长度
}


class SockServer extends EventEmitter {
  server: net.Server | null
  clients: {[propName: string]: customSocket}
  
  constructor () {
    super()

    this.server = null
    this.clients = {}

    this._connection = this._connection.bind(this)
    this.onError = this.onError.bind(this)
    this.onClose = this.onClose.bind(this)
  }

  /**
   * 初始化server并监听端口
   *
   * @param {number} port 监听端口
   * @memberof rpcServer
   */
  listen (port?: number) {
    this.server = net.createServer().listen(port || 8000)
    this.server.on('connection', this._connection)
    this.server.on('error', this.onError)
    this.server.on('close', this.onClose)

    loggerServer.info(`服务端初始化监听 -> port: ${port || 8000}`)
  }

  /**
   * 客户端连接事件回调
   *
   * @param {customSocket} socket
   * @memberof rpcServer
   */
  _connection (socket: customSocket) {
    loggerServer.trace(`新的客户端连接`)

    // 客户端错误回调
    socket.once('error', (error) => {
      loggerServer.error(`客户端报错 -> Socks5 Client Id: ${socket.id} , Error: ${error}`)
    })

    // 客户端关闭回调
    socket.once('close', (hadError) => {
      const { clients } = this
      loggerServer.info(`客户端关闭连接 -> Socks5 Client Id: ${socket.id}, hadError: ${hadError}`)
      // 关闭连接时清除连接池中 socket 实例
      delete clients[socket.id]
    })

    // 接收到客户端消息回调
    socket.once('data', this.authHandler.bind(this, socket))
  }
  
  /**
   * 客户端 Socks5 认证方式校验
   *
   * @param {customSocket} socket
   * @param {Buffer} buf
   * @memberof SockServer
   */
  authHandler (socket: customSocket, buf: Buffer) {
    const VERSION = buf[0]
    // 仅支持Socks5协议，其他协议退出
    if (VERSION != 5) {
      socket.destroyed || socket.destroy()
      loggerServer.fatal('连接协议错误，请使用Socks5协议！')
      return
    }

    // 方法列表
    const methodBuf = buf.slice(2)
    let methods = []
    for (let i = 0; i < methodBuf.length; i++) {
      methods.push(methodBuf[i])
    }

    let buffer: Buffer;
    // 判断认证方式
    switch (true) {
      case methods.includes(AUTH_METHOD_MAP.USERPASS):
        loggerServer.trace(`socks5 连接方式：需要用户名和密码进行验证`)
        buffer = Buffer.from([VERSION, AUTH_METHOD_MAP.USERPASS])
        socket.write(buffer)
        socket.once('data', this.passwdHandler.bind(this, socket))
        break
      case methods.includes(AUTH_METHOD_MAP.NOAUTH):
        loggerServer.trace(`socks5 连接方式：不需要用户名或者密码验证`)
        buffer = Buffer.from([VERSION, AUTH_METHOD_MAP.NOAUTH])
        socket.write(buffer)
        socket.once('data', this.requestHandler.bind(this, socket))
        break
      default:
        loggerServer.trace(`socks5 连接方式：不支持所有的验证方式`)
        buffer = Buffer.from([VERSION, AUTH_METHOD_MAP.REFUSEAUTH])
        socket.write(buffer)
    }
  }

  /**
   * 客户端 Socks5 账号密码认证
   *
   * @param {customSocket} socket
   * @param {Buffer} buf
   * @memberof SockServer
   */
  passwdHandler (socket: customSocket, buf: Buffer) {
    let ulen = buf[1]
    let username = buf.slice(2, 2 + ulen).toString('utf8')
    let password = buf.slice(3 + ulen).toString('utf8')
    if ( AUTH_USER_PASSWORD[username] && password === AUTH_USER_PASSWORD[username]) {
      socket.write(Buffer.from([5, 0]))
    } else {
      loggerServer.fatal(`socks5 用户名或者密码验证验证失败 -> username: ${username}, password: ${password}`)
      socket.write(Buffer.from([5, 1]))
      return
    }
    socket.once('data', this.requestHandler.bind(this, socket))
  }

  /**
   * 处理客户端请求
   *
   * @param {customSocket} socket
   * @param {Buffer} buf
   * @memberof SockServer
   */
  requestHandler (socket: customSocket, buf: Buffer) {
    const VERSION = buf[0]
    const cmd = buf[1]

    // 判断 CMD 连接方式
    if (cmd !== CMD_MAP.CONNECT) {
      loggerServer.error(`不支持其他连接方式 -> ${cmd}`)
    }

    if (!(VERSION === 5 && cmd < 4 && buf[2] === 0)) {
      return
    }

    // 判断 ATYP
    let atyp = buf[3]
    let host, port = buf.slice(buf.length - 2).readInt16BE(0)
    let copyBuf = Buffer.allocUnsafe(buf.length)
    buf.copy(copyBuf)

    // 使用 ipv4 连接
    if (atyp === ATYP_MAP.IPV4) { 
      host = getIpv4(buf.slice(4, 8))
      // 流量转交tunnel处理
      this.tunnel (host, port, copyBuf, socket)
    
    // 使用 域名 连接
    } else if (atyp === ATYP_MAP.HOST) {
      let len = buf[4]
      host = buf.slice(5, 5 + len).toString('utf8')

      if (!domainVerify(host)) {
        loggerServer.warn(`域名解析错误：${host}`)
        return false;
      }

      loggerServer.trace(`域名解析成功：${host}`)

      dns.lookup(host, (err, ip, version) => {
        if (err) {
          loggerServer.warn(`dns寻址错误：`, err)
          return
        }

        // 流量转交tunnel处理
        this.tunnel (ip, port, copyBuf, socket)
      });
    }
  }

  /**
   * Socks5 客户端连接成功，触发 tunnel 事件
   *
   * @param {string} host 目标主机
   * @param {number} port 目标端口
   * @param {Buffer} copyBuf buffer
   * @param {customSocket} socket socket实例
   * @memberof SockServer
   */
  tunnel (host: string, port: number, copyBuf: Buffer, socket: customSocket) {
    if (socket.writable) {
      // 生成客户端UUID
      socket.id = uuid.v4()
      // 连接池中登记客户端
      this.clients[socket.id] = socket

      loggerServer.trace(`连接写入连接池 Socks5 Client Id:  ->  ${socket.id}`)
      
      // REP应答字段
      // 0x00表示成功; 0x01普通SOCKS服务器连接失败; 0x02现有规则不允许连接; 0x03网络不可达; 0x04主机不可达
      // 0x05连接被拒; 0x06 TTL超时; 0x07不支持的命令; 0x08不支持的地址类型; 0x09 - 0xFF未定义
      // 通知socks5客户端连接建立成功
      copyBuf[1] = 0x00;
      socket.write(copyBuf)

      // 触发tunnel事件 上报监听socks5客户端的请求
      this.emit('tunnel', host, port, socket)
    }
  }

  /**
   * 向指定客户端发送消息
   *
   * @param {string} id 客户端UUID
   * @param {buffer} message 消息体
   * @memberof rpcServer
   */
  write (id: string, message: Buffer) {
    const socket = this.clients[id]
    if (socket) {
      socket.write(message)
      loggerServer.debug(`发送消息 -> Socks5 Client Id: ${id} `)
      loggerServer.trace(`消息体`, JSON.stringify(message))
    } else {
      loggerServer.warn(`Socks5 Client: ${id} 已关闭连接，取消数据发送`)
    }
  }

  /**
   * 获取当前连接数
   *
   * @memberof rpcServer
   */
  getClients () {
    return new Promise((resolve, reject) => {
      (this.server as net.Server).getConnections((err, num) => {
        if (err) reject(err)
        resolve(num)
      })
    })
  }

  /**
   * server错误事件回调
   *
   * @param {Error} err
   * @memberof rpcServer
   */
  onError (err: Error) {
    loggerServer.error(`服务端发生错误 -> `, err)
    this.emit('error', err)
  }

  /**
   * server关闭回调
   *
   * @memberof rpcServer
   */
  onClose () {
    loggerServer.info(`服务端已关闭`)
    this.emit('close')
  }
}

export default SockServer
