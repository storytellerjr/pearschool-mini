/* global Pear */
import FramedStream from 'framed-stream'
import fs from 'fs'
import { command, flag } from 'paparam'
import path from 'path'

import HRPC from '../spec/hrpc'
import WorkerTask from './worker-task'

const cmd = command('pearschool-mini',
  flag('--blind-peer-key|-b <blindPeerKey>', 'Blind peer key').multiple(),
  flag('--invite|-i <invite>', 'Room invite'),
  flag('--name|-n <name>', 'Your name'),
  flag('--reset', 'Reset')
)

export default async function runWorker (pipe) {
  const stream = new FramedStream(pipe)
  const rpc = new HRPC(stream)
  stream.pause()

  const storage = path.join(Pear.app.storage, 'corestore')
  cmd.parse(Pear.app.args)
  if (cmd.flags.reset) {
    await fs.promises.rm(storage, { recursive: true, force: true })
  }

  if (!cmd.flags.invite && typeof Pear.config?.applink === 'string') {
    try {
      const fromUrl = new URL(Pear.config.applink).searchParams.get('invite')
      if (fromUrl) cmd.flags.invite = fromUrl
    } catch {}
  }

  const workerTask = new WorkerTask(rpc, storage, cmd.flags)
  Pear.teardown(() => workerTask.close())
  await workerTask.ready()
  stream.resume()

  const invite = await workerTask.account.getInvite()
  console.log(`Storage: ${storage}`)
  console.log(`Name: ${workerTask.name}`)
  console.log(`Invite: ${invite}`)
  rpc.accountInvite(invite)

  return workerTask
}
