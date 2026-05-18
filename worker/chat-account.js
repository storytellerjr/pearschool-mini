import Autobase from 'autobase'
import b4a from 'b4a'
import BlindPairing from 'blind-pairing'
import debounce from 'debounceify'
import fs from 'fs'
import getMimeType from 'get-mime-type'
import Hyperblobs from 'hyperblobs'
import BlobServer from 'hypercore-blob-server'
import idEnc from 'hypercore-id-encoding'
import HyperDB from 'hyperdb'
import Hyperdrive from 'hyperdrive'
import LocalDrive from 'localdrive'
import path from 'path'
import ReadyResource from 'ready-resource'
import z32 from 'z32'

import createPreviewImage from '../lib/create-preview-image'
import createPreviewVideo from '../lib/create-preview-video'
import * as ChatDispatch from '../spec/dispatch'
import ChatDb from '../spec/db'
import ChatRoom from './chat-room'

const PREDEFINED_ROOMS = [
  { name: 'Welcome Lobby', info: { color: 'bg-emerald-500', at: 1 } },
  { name: 'Community Chat', info: { color: 'bg-purple-500', at: 2 } },
  { name: 'Personal Notes', info: { color: 'bg-amber-500', at: 3 } }
]

export default class ChatAccount extends ReadyResource {
  constructor (store, swarm, invite, opts = {}) {
    super()

    this.store = store
    this.swarm = swarm
    this.invite = invite
    this.name = opts.name
    this.myDrivePath = opts.myDrivePath
    this.sharedDrivesPath = opts.sharedDrivesPath

    this.pairing = new BlindPairing(swarm)

    /** @type {{ add: function(string, function(any, { view: HyperDB, base: Autobase })) }} */
    this.router = new ChatDispatch.Router()
    this._setupRouter()

    this.localBase = Autobase.getLocalCore(this.store)
    this.base = null
    this.pairMember = null

    /** @type {Record<string, ChatRoom>} */
    this.rooms = {}

    this.myLocalDrive = this.myDrivePath ? new LocalDrive(this.myDrivePath) : null
    this.myDrive = new Hyperdrive(this.store)
    this.uploadInterval = null

    this.localDrives = {}
    this.drives = {}

    this.blobs = new Hyperblobs(this.store.get({ name: 'blobs' }))
    this.blobServer = new BlobServer(this.store.session())
    this.blobsCores = {}
  }

  async _open () {
    await this.localBase.ready()
    const localKey = this.localBase.key
    const isEmpty = this.localBase.length === 0

    let key
    let encryptionKey
    if (isEmpty && this.invite) {
      const res = await new Promise((resolve) => {
        this.pairing.addCandidate({
          invite: z32.decode(this.invite),
          userData: localKey,
          onadd: resolve
        })
      })
      key = res.key
      encryptionKey = res.encryptionKey
    }

    await this.localBase.close()
    this.base = new Autobase(this.store, key, {
      encrypt: true,
      encryptionKey,
      open: this._openBase.bind(this),
      close: this._closeBase.bind(this),
      apply: this._applyBase.bind(this)
    })

    const writablePromise = new Promise((resolve) => {
      this.base.on('update', () => {
        if (this.base.writable) resolve()
        if (!this.base._interrupting) this.emit('update')
      })
    })
    await this.base.ready()
    this.swarm.join(this.base.discoveryKey)
    if (!this.base.writable) await writablePromise

    this.view.core.download({ start: 0, end: -1 })

    this.pairMember = this.pairing.addMember({
      discoveryKey: this.base.discoveryKey,
      /** @type {function(import('blind-pairing-core').MemberRequest)} */
      onadd: async (request) => {
        const inv = await this.view.findOne('@pearschool-mini/invites', { id: request.inviteId })
        if (!inv) return
        request.open(inv.publicKey)
        await this.addWriter(request.userData)
        request.confirm({
          key: this.base.key,
          encryptionKey: this.base.encryptionKey
        })
      }
    })

    await this.openRooms()
    if (Object.keys(this.rooms).length === 0 && this.base.writable) {
      for (const def of PREDEFINED_ROOMS) {
        await this.addRoom(def.name, def.info)
      }
    }

    const downloadSharedDrives = debounce(() => this._downloadSharedDrives())
    this.on('update', () => downloadSharedDrives())
    await downloadSharedDrives()
    await this._uploadMyDrive()

    await this.blobs.ready()
    await this.blobServer.listen()
  }

  async _close () {
    clearInterval(this.uploadInterval)
    await Promise.all(Object.values(this.rooms).map(room => room.close()))
    await this.blobServer?.close()
    await this.blobs?.close()
    await this.pairMember?.close()
    await this.base?.close()
    await this.localBase.close()
    await this.pairing.close()
  }

  _openBase (store) {
    return HyperDB.bee(store.get('view'), ChatDb, { extension: false, autoUpdate: true })
  }

  async _closeBase (view) {
    await view.close()
  }

  async _applyBase (nodes, view, base) {
    for (const node of nodes) {
      await this.router.dispatch(node.value, { view, base })
    }
    await view.flush()
  }

  _setupRouter () {
    this.router.add('@pearschool-mini/add-writer', async (data, context) => {
      await context.base.addWriter(data.key)
    })
    this.router.add('@pearschool-mini/add-invite', async (data, context) => {
      await context.view.insert('@pearschool-mini/invites', data)
    })
    this.router.add('@pearschool-mini/add-room', async (data, context) => {
      await context.view.insert('@pearschool-mini/rooms', data)
    })
    this.router.add('@pearschool-mini/add-drive', async (data, context) => {
      await context.view.insert('@pearschool-mini/drives', data)
    })
    this.router.add('@pearschool-mini/add-task', async (data, context) => {
      await context.view.insert('@pearschool-mini/tasks', data)
    })
    this.router.add('@pearschool-mini/delete-task', async (data, context) => {
      await context.view.delete('@pearschool-mini/tasks', { id: data.id })
    })
    this.router.add('@pearschool-mini/add-course', async (data, context) => {
      await context.view.insert('@pearschool-mini/courses', data)
    })
    this.router.add('@pearschool-mini/delete-course', async (data, context) => {
      await context.view.delete('@pearschool-mini/courses', { id: data.id })
    })
    this.router.add('@pearschool-mini/add-video', async (data, context) => {
      await context.view.insert('@pearschool-mini/videos', data)
    })
    this.router.add('@pearschool-mini/add-message', async () => {
      throw new Error('Invalid op: add-message is room-scoped, not account-scoped')
    })
  }

  /** @type {HyperDB} */
  get view () {
    return this.base.view
  }

  async getInvite () {
    const existing = await this.view.findOne('@pearschool-mini/invites', {})
    if (existing) {
      return z32.encode(existing.invite)
    }
    const { id, invite, publicKey, expires } = BlindPairing.createInvite(this.base.key)
    await this.base.append(
      ChatDispatch.encode('@pearschool-mini/add-invite', { id, invite, publicKey, expires })
    )
    return z32.encode(invite)
  }

  async addWriter (key) {
    await this.base.append(
      ChatDispatch.encode('@pearschool-mini/add-writer', { key: b4a.isBuffer(key) ? key : b4a.from(key) })
    )
  }

  async openRooms () {
    const rooms = await this.view.find('@pearschool-mini/rooms', { reverse: true, limit: 100 }).toArray()
    await Promise.all(rooms.map(async (item) => {
      const roomStore = this.store.namespace(item.id)
      const room = new ChatRoom(roomStore, this.swarm, { name: item.name, info: item.info, invite: item.invite })
      this.rooms[item.id] = room

      this._watchMessages(item.id)
      await room.ready()

      await this._messages(item.id)
      this.emit('room-opened', item.id, room)
    }))
  }

  async addRoom (name, info) {
    const id = Math.random().toString(16).slice(2)

    const roomStore = this.store.namespace(id)
    const room = new ChatRoom(roomStore, this.swarm, { name, info })
    this.rooms[id] = room

    this._watchMessages(id)
    await room.ready()

    await room.addRoomInfo()
    await this.base.append(
      ChatDispatch.encode('@pearschool-mini/add-room', { id, name: room.name, invite: room.invite, info: room.info })
    )
    this.emit('room-opened', id, room)
  }

  async joinRoom (invite) {
    const id = Math.random().toString(16).slice(2)

    const roomStore = this.store.namespace(id)
    const room = new ChatRoom(roomStore, this.swarm, { invite })
    this.rooms[id] = room

    room.on('update', async () => {
      const remoteRoom = await room.getRoomInfo()

      if (remoteRoom && remoteRoom.name !== room.name) {
        room.name = remoteRoom.name
        room.info = remoteRoom.info
        await this.base.append(
          ChatDispatch.encode('@pearschool-mini/add-room', { id, name: room.name, invite, info: room.info })
        )
      }
    })
    this._watchMessages(id)
    await room.ready()
    this.emit('room-opened', id, room)
  }

  async addMessage (roomId, text, info) {
    const room = this.rooms[roomId]
    if (!room) throw new Error('Room not found')
    await room.addMessage(text, info)
  }

  async _messages (roomId) {
    const room = this.rooms[roomId]
    if (!room) throw new Error('Room not found')
    const messages = await room.getMessages()
    messages.sort((a, b) => a.info.at - b.info.at)
    this.emit('messages', roomId, messages)
  }

  _watchMessages (roomId) {
    const room = this.rooms[roomId]
    if (!room) throw new Error('Room not found')
    const debounceMessages = debounce(() => this._messages(roomId))
    room.on('update', async () => debounceMessages())
  }

  async getDrives ({ reverse = true, limit = 100 } = {}) {
    return await this.view.find('@pearschool-mini/drives', { reverse, limit }).toArray()
  }

  async addDrive (key, info) {
    await this.base.append(
      ChatDispatch.encode('@pearschool-mini/add-drive', { key, info })
    )
  }

  async getTasks ({ reverse = true, limit = 100 } = {}) {
    return await this.view.find('@pearschool-mini/tasks', { reverse, limit }).toArray()
  }

  async addTask (task) {
    const id = task.id || Math.random().toString(16).slice(2)
    await this.base.append(
      ChatDispatch.encode('@pearschool-mini/add-task', {
        id,
        name: task.name,
        description: task.description || '',
        dueDate: task.dueDate || 0,
        status: task.status || 'open',
        info: task.info || {}
      })
    )
  }

  async deleteTask (id) {
    await this.base.append(
      ChatDispatch.encode('@pearschool-mini/delete-task', { id })
    )
  }

  async getCourses ({ reverse = true, limit = 100 } = {}) {
    return await this.view.find('@pearschool-mini/courses', { reverse, limit }).toArray()
  }

  async addCourse (course) {
    const id = course.id || Math.random().toString(16).slice(2)
    await this.base.append(
      ChatDispatch.encode('@pearschool-mini/add-course', {
        id,
        title: course.title,
        instructor: course.instructor,
        room: course.room || '',
        startDate: course.startDate || 0,
        status: course.status || 'draft',
        info: course.info || {},
        description: course.description || ''
      })
    )
  }

  async deleteCourse (id) {
    await this.base.append(
      ChatDispatch.encode('@pearschool-mini/delete-course', { id })
    )
  }

  async getVideos ({ reverse = true, limit = 100 } = {}) {
    const videos = await this.view.find('@pearschool-mini/videos', { reverse, limit }).toArray()
    for (const item of videos) {
      if (!this.blobsCores[item.blob.key]) {
        const blobsCore = this.store.get({ key: idEnc.decode(item.blob.key) })
        this.blobsCores[item.blob.key] = blobsCore
        await blobsCore.ready()
        this.swarm.join(blobsCore.discoveryKey)
      }
    }
    return videos.map(item => {
      const link = this.blobServer.getLink(item.blob.key, { blob: item.blob, type: item.type })
      return { ...item, info: { ...item.info, link } }
    })
  }

  async addVideo (filePath, info) {
    const name = path.basename(filePath)
    const type = getMimeType(name)
    if (!(type.startsWith('image/') || type.startsWith('video/'))) {
      throw new Error('Only image/video files are allowed: ' + type)
    }

    const rs = fs.createReadStream(filePath)
    const ws = this.blobs.createWriteStream()
    await new Promise((resolve, reject) => {
      ws.on('error', reject)
      ws.on('close', resolve)
      rs.pipe(ws)
    })
    const blob = { key: idEnc.normalize(this.blobs.core.key), ...ws.id }

    let preview
    try {
      preview = type.startsWith('image/') ? await createPreviewImage(filePath) : await createPreviewVideo(filePath)
    } catch {
      preview = undefined
    }

    const id = Math.random().toString(16).slice(2)
    await this.base.append(
      ChatDispatch.encode('@pearschool-mini/add-video', { id, name, type, blob, info: { ...info, preview } })
    )
  }

  async _downloadSharedDrives () {
    if (!this.sharedDrivesPath) return
    const drives = await this.getDrives()
    await Promise.all(drives.map(async (item) => {
      const key = idEnc.normalize(item.key)
      if (this.drives[key]) return

      const local = new LocalDrive(path.join(this.sharedDrivesPath, key))
      this.localDrives[key] = local
      const drive = key === idEnc.normalize(this.myDrive.key) ? this.myDrive : new Hyperdrive(this.store, item.key)
      this.drives[key] = drive

      const mirror = debounce(() => drive.mirror(local).done())
      drive.core.on('append', () => mirror())

      await drive.ready()
      this.swarm.join(drive.discoveryKey)
    }))
  }

  async _uploadMyDrive () {
    if (!this.myLocalDrive) return
    await this.myDrive.ready()
    await this.addDrive(this.myDrive.key, { name: this.name })
    this.swarm.join(this.myDrive.discoveryKey)

    const mirror = debounce(() => this.myLocalDrive.mirror(this.myDrive).done())
    this.uploadInterval = setInterval(() => mirror(), 1000)
  }
}
