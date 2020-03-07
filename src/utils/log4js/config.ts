/**
 * log4js日志配置文件
 */

module.exports = {
  // 日志输出目标
  appenders: {
    // 输出到终端（在pm2环境下日志会被pm2收集到自身日志中）
    default: {
      type: 'stdout',
      layout: {
        type: 'pattern',
        pattern: '[%p] %c - %m'
      }
    }
  },
  // 日志类型
  categories: {
    // 默认类型
    default: {
      appenders: ['default'],
      level: 'error'
    },
    // Server
    Server: {
      appenders: ['default'],
      level: 'debug'
    },
    // Socket
    Socket: {
      appenders: ['default'],
      level: 'debug'
    },
    // serialize
    serialize: {
      appenders: ['default'],
      level: 'debug'
    },
    // deserialize
    deserialize: {
      appenders: ['default'],
      level: 'debug'
    }
  },
  // 支持pm2
  pm2: true,
  disableClustering: true
}
