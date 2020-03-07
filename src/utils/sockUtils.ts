/**
 * buffer转ipv4
 *
 * @param {Buffer} buf buffer
 * @returns {string} host
 */
let getIpv4 = function (buf: Buffer): string {
  let hostName = ''
  if (buf.length === 4) {
    for (let i = 0; i < buf.length; i++) {
      hostName += Math.floor(buf[i])
      if (i !== 3) { hostName += '.' }
    }
  } else if (buf.length == 16) {
    for (let i = 0; i < 16; i += 2) {
      let part = buf.slice(i, i + 2).readUInt16BE(0).toString(16)
      hostName += part
      if (i != 14) { hostName += ':' }
    }
  }
  return hostName
}

/**
 * 校验域名是否合法
 *
 * @param {string} host 域名
 * @returns {boolean} 校验结果
 */
let domainVerify = function (host: string): boolean {
  let regex = new RegExp(/^([a-zA-Z0-9|\-|_]+\.)?[a-zA-Z0-9|\-|_]+\.[a-zA-Z0-9|\-|_]+(\.[a-zA-Z0-9|\-|_]+)*$/)
  return regex.test(host)
}

export {
  getIpv4,
  domainVerify
}