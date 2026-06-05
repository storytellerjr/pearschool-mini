import b4a from 'b4a'
import BlindPeering from 'blind-peering'
import Corestore from 'corestore'
import debounce from 'debounceify'
import fs from 'fs'
import idEnc from 'hypercore-id-encoding'
import Hyperswarm from 'hyperswarm'
import path from 'path'
import ReadyResource from 'ready-resource'

import ChatAccount from './chat-account'

export default class WorkerTask extends ReadyResource {
  constructor (rpc, storage, opts = {}) {
    super()

    /** @type {InstanceType<typeof import('../spec/hrpc').default>} */
    this.rpc = rpc
    this.storage = storage
    this.blindPeerKeys = opts.blindPeerKey || []
    this.invite = opts.invite
    this.name = opts.name || `User ${Date.now()}`

    this.store = new Corestore(storage)
    this.swarm = new Hyperswarm()
    this.swarm.on('connection', (conn) => this.store.replicate(conn))

    this.blindPeering = new BlindPeering(
      this.swarm,
      this.store.namespace('blind-peering'),
      { mirrors: this.blindPeerKeys }
    )

    this.myDrivePath = path.join(this.storage, 'my-drive')
    this.sharedDrivesPath = path.join(this.storage, 'shared-drives')

    this.account = new ChatAccount(this.store, this.swarm, this.invite, {
      name: this.name,
      myDrivePath: this.myDrivePath,
      sharedDrivesPath: this.sharedDrivesPath
    })

    this.debounceRooms = debounce(() => this._rooms())
    this.account.on('update', () => this.debounceRooms())
    this.account.on('room-opened', (id, room) => {
      this.debounceRooms()
      this.blindPeering.addAutobase(room.base).catch(() => {})
    })
    this.account.on('messages', (roomId, messages) => {
      this.rpc.messages({ messages, roomId })
    })

    this.intervalFiles = null
    this.intervalTasks = null
    this.intervalCourses = null
    this.intervalVideos = null
  }

  async _open () {
    const logPath = path.join(this.storage, '..', 'worker.log')
    try { fs.writeFileSync(logPath, `--- worker boot ${new Date().toISOString()} ---\n`) } catch {}
    const origLog = console.log.bind(console)
    const origErr = console.error.bind(console)
    const appendLine = (level, args) => {
      try {
        const line = `[${new Date().toISOString()}] ${level} ` + args.map(a => {
          if (typeof a === 'string') return a
          try { return JSON.stringify(a) } catch { return String(a) }
        }).join(' ') + '\n'
        fs.appendFileSync(logPath, line)
      } catch {}
    }
    console.log = (...args) => { origLog(...args); appendLine('LOG', args) }
    console.error = (...args) => { origErr(...args); appendLine('ERR', args) }
    console.log('[worker] log file at', logPath)

    await this.store.ready()
    await this.account.ready()

    await this.blindPeering.addAutobase(this.account.base)

    await fs.promises.mkdir(this.myDrivePath, { recursive: true })
    await fs.promises.mkdir(this.sharedDrivesPath, { recursive: true })

    this.rpc.onAddRoom(async (data) => {
      await this.account.addRoom(data, { at: Date.now() })
    })
    this.rpc.onJoinRoom(async (data) => {
      await this.account.joinRoom(data)
    })
    this.rpc.onAddMessage(async (data) => {
      await this.account.addMessage(data.roomId, data.text, { name: this.name, at: Date.now() })
    })
    this.rpc.onAddFile(async (data) => {
      await fs.promises.copyFile(data.uri, path.join(this.myDrivePath, data.name))
    })
    this.rpc.onAddTask(async (data) => {
      await this.account.addTask(data)
    })
    this.rpc.onDeleteTask(async (data) => {
      await this.account.deleteTask(data.id)
    })
    this.rpc.onAddCourse(async (data) => {
      await this.account.addCourse(data)
    })
    this.rpc.onDeleteCourse(async (data) => {
      await this.account.deleteCourse(data.id)
    })
    this.rpc.onAddVideo(async (data) => {
      await this.account.addVideo(data, { name: this.name, at: Date.now() })
    })
    this.rpc.onSetBlindPeerKey(async (key) => {
      this.swarm.joinPeer(idEnc.decode(key))
    })

    await this.debounceRooms()
    await this._tasks()
    await this._courses()
    await this._videos()

    this.intervalTasks = setInterval(() => this._tasks().catch(() => {}), 1000)
    this.intervalCourses = setInterval(() => this._courses().catch(() => {}), 1000)
    this.intervalVideos = setInterval(() => this._videos().catch(() => {}), 1000)

    this.intervalFiles = setInterval(async () => {
      const rawDrives = await this.account.getDrives()
      const drives = await Promise.all(rawDrives.map(async (drive) => {
        const key = idEnc.normalize(drive.key)
        const dir = path.join(this.sharedDrivesPath, key)
        await fs.promises.mkdir(dir, { recursive: true })
        const files = await fs.promises.readdir(dir, { recursive: true }).catch((err) => {
          if (err.code === 'ENOENT') return []
          throw err
        })
        const isMyDrive = key === idEnc.normalize(this.account.myDrive.key)
        return {
          ...drive,
          info: {
            ...drive.info,
            isMyDrive,
            uri: `file://${isMyDrive ? this.myDrivePath : dir}`,
            files: files.map((name) => ({ name, uri: `file://${path.join(dir, name)}` }))
          }
        }
      }))
      drives.sort((a, b) => {
        if (a.info.isMyDrive && !b.info.isMyDrive) return -1
        if (!a.info.isMyDrive && b.info.isMyDrive) return 1
        return (a.info.name || '').localeCompare(b.info.name || '')
      })
      this.rpc.drives(drives)
    }, 1000)
  }

  async _close () {
    clearInterval(this.intervalFiles)
    clearInterval(this.intervalTasks)
    clearInterval(this.intervalCourses)
    clearInterval(this.intervalVideos)
    await this.blindPeering.close()
    await this.account.close()
    await this.swarm.destroy()
    await this.store.close()
  }

  async _rooms () {
    const rooms = Object.entries(this.account.rooms).map(([id, room]) => ({
      id,
      name: room.name || '(loading…)',
      invite: room.invite || '',
      info: room.info || {}
    }))
    rooms.sort((a, b) => (a.info.at || 0) - (b.info.at || 0))
    this.rpc.rooms(rooms)
  }

  async _tasks () {
    const tasks = await this.account.getTasks()
    tasks.sort((a, b) => (a.info?.at || 0) - (b.info?.at || 0))
    this.rpc.tasks(tasks)
  }

  async _courses () {
    const courses = await this.account.getCourses()
    courses.sort((a, b) => (a.info?.at || 0) - (b.info?.at || 0))
    this.rpc.courses(courses)
  }

  async _videos () {
    const videos = await this.account.getVideos()
    videos.sort((a, b) => (a.info?.at || 0) - (b.info?.at || 0))
    this.rpc.videos(videos)
  }
}
