/**
 * 消息体 分包操作
 *
 * @param {Buffer} buffer 消息体Buffer
 * @param {number} [chunkSize=5]
 * @returns
 */
const bufferToChunks = function (buffer: Buffer, chunkSize: number = 200) {
	const result = []
	const len = buffer.length
	let i = 0

	while (i < len) {
		result.push(buffer.slice(i, i += chunkSize))
	}

	return result
}

export default bufferToChunks
