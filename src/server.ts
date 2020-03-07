import net from 'net'
import uuid from 'uuid'
import { EventEmitter } from 'events'
import rpcSocket from './client'
import logger from './utils/log4js'
const loggerServer = logger('Server')

/**
 * server封装
 *
 * @class rpcServer
 * @extends {EventEmitter}
 */
class rpcServer extends EventEmitter {
  server: net.Server | null;
  clients: {[propName: string]: rpcSocket};

  constructor (server?: net.Server) {
    super()

    this.server = server || null
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
    // 生成客户端UUID
    socket.id = uuid.v4()
    const instance = new rpcSocket(socket)
    // 连接池中登记客户端
    this.clients[socket.id] = instance

    loggerServer.info(`新的客户端连接 -> client id: ${socket.id}`)

    // 客户端错误回调
    instance.once('error', ({error, id}) => {
      loggerServer.error(`客户端报错 -> client id: ${id} , Error: ${error}`)
    })

    // 客户端关闭回调
    instance.once('close', ({hadError, id}) => {
      const { clients } = this
      loggerServer.info(`客户端关闭连接 -> client id: ${id}, hadError: ${hadError}`)
      // 关闭连接时清除连接池中 socket 实例
      delete clients[id]
    })

    // 接收到客户端消息回调
    instance.on('payload', ({error, id, data}) => {
      this.emit('payload', {error, id, data})
      loggerServer.trace(`客户端Payload -> client id: ${id} , data: ${JSON.stringify(data)}`)
    })
  }

  /**
   * 向指定客户端发送消息
   *
   * @param {string} id 客户端UUID
   * @param {object} message 消息体
   * @memberof rpcServer
   */
  write (id: string, message: object) {
    this.clients[id].write(message)
    loggerServer.trace(`给客户端 ${id} 发送消息 ->`, JSON.stringify(message))
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

export default rpcServer