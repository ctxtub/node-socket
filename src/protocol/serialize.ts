import { PACKET_START, PACKET_END, PROPTOCOL_VERSION, HEADER_LENGTH, TOTAL_LENGTH } from './protocol'
import logger from '../utils/log4js'
const loggerSerialize = logger('serialize')

/**
 * 消息体 序列化操作
 *
 * @param {number} {}.version 协议版本
 * @param {number} {}.header 消息头
 * @param {number} {}.data 数据
 * @returns {Buffer} 序列化后的消息体
 */
const serialize = function ({version = 1, header = {}, data = {}}) {
  let versionBuf = Buffer.alloc(PROPTOCOL_VERSION)
  versionBuf.writeInt8(version, 0)

  const headerBuf = Buffer.from(JSON.stringify(header))
  loggerSerialize.debug(`headerBuffer Length -> ${headerBuf.length}`)
  let headerLengthBuf = Buffer.alloc(HEADER_LENGTH)
  headerLengthBuf.writeInt16BE(headerBuf.length, 0)

  const dataBuf = Buffer.from(JSON.stringify(data))
  loggerSerialize.debug(`totalBuffer Length -> ${headerBuf.length + dataBuf.length}`)
  let totalLenthBuf = Buffer.alloc(TOTAL_LENGTH)
  totalLenthBuf.writeInt32BE(headerBuf.length + dataBuf.length, 0)

  const buf = Buffer.concat([PACKET_START, versionBuf, totalLenthBuf, headerLengthBuf, headerBuf, dataBuf, PACKET_END])

  return buf
}

export default serialize
