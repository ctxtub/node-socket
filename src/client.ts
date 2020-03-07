import { Socket } from 'net'
import { EventEmitter } from 'events'
import serialize from './protocol/serialize'
import deserialize from './protocol/deserialize'
import bufferToChunks from './utils/bufferToChunks'
import { PACKET_START, PACKET_END } from './protocol/protocol'
import logger from './utils/log4js'
const loggerSocket = logger('Socket')

/**
 * socket封装
 *
 * @class rpcSocket
 * @extends {EventEmitter}
 */
class rpcSocket extends EventEmitter {
  socket: Socket | customSocket;
  receviedBuffer: Buffer;

  constructor (socket?: customSocket) {
    super()

    this.socket = socket || new Socket()
    this.receviedBuffer = Buffer.from('')

    this.onError = this.onError.bind(this)
    this.onConnect = this.onConnect.bind(this)
    this.onClose = this.onClose.bind(this)
    this.onData = this.onData.bind(this)

    this._addEventListener()
  }

  /**
   * 初始化事件监听
   *
   * @memberof rpcSocket
   */
  _addEventListener () {
    const { socket, onConnect, onData, onError, onClose } = this
    socket.once('error', onError)
    socket.once('connect', onConnect)
    socket.once('close', onClose)
    socket.on('data', onData)
  }

  /**
   * 消息体粘包 & 反序列化
   *
   * @memberof rpcSocket
   */
  _readPack () {
    const { socket } = this
    const startIndex = this.receviedBuffer.indexOf(PACKET_START)
    const endIndex = this.receviedBuffer.indexOf(PACKET_END)

    loggerSocket.trace(`处理已接收数据 -> ${startIndex}, ${endIndex}`)

    if (~startIndex && ~endIndex) {
      const buf = this.receviedBuffer.slice(startIndex, endIndex + PACKET_END.length)
      const id = (socket as customSocket).id
      const result = deserialize(id, buf)
      const message = {
        error: result.error,
        id: id,
        data: result.data
      }

      this.receviedBuffer = this.receviedBuffer.slice(endIndex + PACKET_END.length)

      this.emit('payload', message)

      loggerSocket.debug(`接收消息 反序列化消息体 -> `, JSON.stringify(message))
    }

    if (this.receviedBuffer.length > 0) {
      setTimeout(this._readPack.bind(this), 100)
    }
  }

  /**
   * 创建socket连接
   *
   * @param {number} {}.port 服务端端口
   * @param {string} {}.host 服务端地址
   * 
   * @memberof rpcSocket
   */
  connect ({ port, host }: {port: number, host: string}) {
    const { socket } = this
    loggerSocket.info(`客户端尝试建立连接 -> port: ${port}, host: ${host}`)
    socket.connect(port, host)
  }

  /**
   * 发送消息
   *
   * @param {object} message 消息体
   * @memberof rpcSocket
   */
  write (message: object) {
    const { socket } = this
    let buf = serialize(message)
    let bufArr = bufferToChunks(buf)

    loggerSocket.debug(`待发送消息 消息体 -> `, JSON.stringify(message))
    loggerSocket.trace(`序列化后的Buffer -> `, buf)

    bufArr.forEach((item: Buffer) => {
      socket.write(item)
    })
  }

  /**
   * socket接收数据回调
   *
   * @param {Buffer} chunk 接收的buffer
   * @memberof rpcSocket
   */
  onData (chunk: Buffer) {
    this.receviedBuffer = Buffer.concat([this.receviedBuffer, chunk])
    this._readPack()

    loggerSocket.trace(`接收到的Buffer -> `, chunk)
  }

  /**
   * socket连接服务器成功回调
   *
   * @memberof rpcSocket
   */
  onConnect () {
    loggerSocket.info('客户端建立连接成功')
    this.emit('connect')
  }

  /**
   * socket连接错误回调
   *
   * @param {Error} err 错误信息
   * @memberof rpcSocket
   */
  onError (error: Error) {
    const { socket } = this
    const id = (socket as customSocket).id
    loggerSocket.error(`客户端发生错误 -> CLIENT ID: ${id} `, error)
    this.emit('error', {error, id})
  }

  /**
   * socket连接关闭回调
   *
   * @memberof rpcSocket
   */
  onClose (hadError: boolean) {
    const { socket } = this
    const id = (socket as customSocket).id
    loggerSocket.info(`客户端关闭连接 -> CLIENT ID: ${id}`)
    this.emit('close', {hadError, id})
  }
}

export default rpcSocket