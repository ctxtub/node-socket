import net from 'net'

declare global {
  interface customSocket extends net.Socket {
    id: string;
  }
}
