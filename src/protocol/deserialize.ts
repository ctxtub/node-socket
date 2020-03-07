import { PACKET_START, PACKET_END, PROPTOCOL_VERSION, HEADER_LENGTH, TOTAL_LENGTH } from './protocol'
import logger from '../utils/log4js'
const loggerDeserialize = logger('deserialize')

/**
 * 消息体 反序列化操作
 *
 * @param {Buffer} buf 序列化后的消息体
 * @returns {Object}} buf 反序列化后的消息体
 */
const deserialize = function (id: string, buf: Buffer) {
  let offset = PACKET_START.length
  const versionBuf = buf.slice(offset, offset += PROPTOCOL_VERSION)
  const version = versionBuf.readInt8(0)

  const totalLengthBuf = buf.slice(offset, offset += TOTAL_LENGTH)
  const totalLength = totalLengthBuf.readInt32BE(0)
  loggerDeserialize.debug(`totalBuffer Length -> ${totalLength}`)

  const headerLenthBuf = buf.slice(offset, offset += HEADER_LENGTH)
  const headerLength = headerLenthBuf.readInt16BE(0)
  loggerDeserialize.debug(`headerBuffer Length -> ${headerLength}`)

  const headerBuf = buf.slice(offset, offset += headerLength)
  const dataBuf = buf.slice(offset, buf.length - PACKET_END.length)

  if (headerBuf.length + dataBuf.length === totalLength) {
    let header = headerBuf.toString()
    header = JSON.parse(header)
    let data = dataBuf.toString()
    data = JSON.parse(data)

    return {
      error: false,
      data: {
        version,
        header,
        data
      }
    }
  } else {
    loggerDeserialize.warn(`数据不合法 -> CLIENT ID: ${id}`)
    return {
      error: true,
      data: {}
    }
  }
}

export default deserialize
