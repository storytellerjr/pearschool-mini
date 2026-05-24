import Autobase from 'autobase'
import b4a from 'b4a'
import BlindPairing from 'blind-pairing'
import HyperDB from 'hyperdb'
import ReadyResource from 'ready-resource'
import z32 from 'z32'

import * as ChatDispatch from '../spec/dispatch'
import ChatDb from '../spec/db'

export default class ChatRoom extends ReadyResource {
  constructor (store, swarm, { name, info, invite } = {}) {
    super()

    this.store = store
    this.swarm = swarm
    this.name = name
    this.info = info
    this.invite = invite

    this.pairing = new BlindPairing(swarm)

    /** @type {{ add: function(string, function(any, { view: HyperDB, base: Autobase })) }} */
    this.router = new ChatDispatch.Router()
    this._setupRouter()

    this.localBase = Autobase.getLocalCore(this.store)
    this.base = null
    this.pairMember = null
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
  }

  async _close () {
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
    this.router.add('@pearschool-mini/add-message', async (data, context) => {
      await context.view.insert('@pearschool-mini/messages', data)
    })
    this.router.add('@pearschool-mini/add-drive', async () => {
      throw new Error('Invalid op: add-drive is account-scoped, not room-scoped')
    })
    this.router.add('@pearschool-mini/add-task', async () => {
      throw new Error('Invalid op: add-task is account-scoped, not room-scoped')
    })
    this.router.add('@pearschool-mini/delete-task', async () => {
      throw new Error('Invalid op: delete-task is account-scoped, not room-scoped')
    })
    this.router.add('@pearschool-mini/add-course', async () => {
      throw new Error('Invalid op: add-course is account-scoped, not room-scoped')
    })
    this.router.add('@pearschool-mini/delete-course', async () => {
      throw new Error('Invalid op: delete-course is account-scoped, not room-scoped')
    })
    this.router.add('@pearschool-mini/add-video', async () => {
      throw new Error('Invalid op: add-video is account-scoped, not room-scoped')
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

  async getRoomInfo () {
    return await this.view.findOne('@pearschool-mini/rooms', {})
  }

  async addRoomInfo () {
    const id = Math.random().toString(16).slice(2)
    this.invite = await this.getInvite()
    await this.base.append(
      ChatDispatch.encode('@pearschool-mini/add-room', { id, name: this.name, invite: this.invite, info: this.info })
    )
  }

  async getMessages ({ reverse = true, limit = 100 } = {}) {
    return await this.view.find('@pearschool-mini/messages', { reverse, limit }).toArray()
  }

  async addMessage (text, info) {
    const id = Math.random().toString(16).slice(2)
    await this.base.append(
      ChatDispatch.encode('@pearschool-mini/add-message', { id, text, info })
    )
  }
}
