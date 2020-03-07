const config = require('./config')
const log4js = require('log4js').configure(config)

/**
 * 获取日志分类实例方法
 *
 * @param {string} name 日志分类名称
 * @returns 日志分类实例
 */
const logger = (name: string) => {
  return log4js.getLogger(name)
}

export default logger
