import FramedStream from 'framed-stream'
import path from 'path'

import HRPC from '../spec/hrpc'
import WorkerTask from './worker-task'

const storageRoot = Bare.argv[2]
const storage = path.join(storageRoot, 'corestore')

// Bare.IPC-backed duplex pipe (duck-typed for framed-stream)
class BareIPCPipe {
  constructor () { this._dataListeners = [] }
  on (ev, cb) { if (ev === 'data') this._dataListeners.push(cb); return this }
  off (ev, cb) {
    if (ev === 'data') this._dataListeners = this._dataListeners.filter(x => x !== cb)
    return this
  }
  emit (ev, data) { if (ev === 'data') this._dataListeners.forEach(cb => cb(data)) }
  write (buf) { Bare.IPC.write(buf); return true }
  end () {}
  pause () {}
  resume () {}
}
const pipe = new BareIPCPipe()
Bare.IPC.on('data', (data) => pipe.emit('data', data))

const stream = new FramedStream(pipe)
const rpc = new HRPC(stream)
stream.pause()

const flags = {}

const workerTask = new WorkerTask(rpc, storage, flags)
Bare.on('teardown', () => workerTask.close())
await workerTask.ready()
stream.resume()

const invite = await workerTask.account.getInvite()
console.log(`Storage: ${storage}`)
console.log(`Name: ${workerTask.name}`)
console.log(`Invite: ${invite}`)
rpc.accountInvite(invite)
