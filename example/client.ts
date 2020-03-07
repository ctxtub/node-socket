
import rpcClient from '../src/client'
const client = new rpcClient()

// client创建连接
client.connect({port: 8000, host: 'localhost'})

// client连接成功事件监听
client.once('connect', () => console.log('client 连接服务器成功'))

// client报错事件监听
client.once('error', (err: Error) => console.log(`client 报错啦：${err}`))

// client关闭事件监听
client.once('close', (err: Error) => console.log('client 连接中断'))

// client接收消息事件监听
client.on('payload', ({error, id, data}) => {
  console.log(`client 接收到数据了 -> client id: ${id} ,error: ${error}, data: ${JSON.stringify(data)}`)
})

// client发送数据
client.write({data: {1: '12121saasdasdasdasdq121', 2: '1212sadsasdasdsa'}})
client.write({data: {1: '12', 2: '2'}})