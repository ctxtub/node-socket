/**
 * 1byte(版本号) | 4byte(协义总长度) | 4byte(协义头长度) | (...) byte消息头  | (...) byte消息体
 *    0                1~4                   5~8
 *
 * 协义总长度 = 消息头总长度 + 消息体总长度
*/
const PACKET_START = Buffer.from('7M04voe8^sg8o$ARsyvq')
const PROPTOCOL_VERSION = 1
const TOTAL_LENGTH = 4
const HEADER_LENGTH = 4
const PACKET_HEADER = null
const PACKET_DATA = null
const PACKET_END = Buffer.from('HXI0Xq$t@ncifU6U4P#q')

export {
  PACKET_START,
  PROPTOCOL_VERSION,
  TOTAL_LENGTH,
  HEADER_LENGTH,
  PACKET_HEADER,
  PACKET_DATA,
  PACKET_END
}
