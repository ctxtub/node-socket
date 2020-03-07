
import rpcServer from '../src/server'
const server = new rpcServer()

// server初始化并监听端口
server.listen()

// server报错事件监听
server.once('error', (err: Error) => console.log(`server 报错啦：${err}`))

// server关闭事件监听
server.once('close', () => console.log('server 已关闭'))

// server接收消息事件监听
server.on('payload', ({error, id, data}) => {
  console.log(`server 接收到数据了 -> client id: ${id} , error, ${error}, data: ${JSON.stringify(data)}`)

  // 连接数检查
  server.getClients().then(res => {console.log(`当前连接数: ${res}, ${Object.keys(server.clients).length}`)})

  // server 发送数据
  server.write(id, {data: 'say Hi'})
})
