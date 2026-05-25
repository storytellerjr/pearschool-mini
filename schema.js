import Hyperschema from 'hyperschema'
import HyperdbBuilder from 'hyperdb/builder'
import Hyperdispatch from 'hyperdispatch'
import HRPC from 'hrpc'

const SCHEMA_DIR = './spec/schema'
const DB_DIR = './spec/db'
const DISPATCH_DIR = './spec/dispatch'
const HRPC_DIR = './spec/hrpc'

const hyperSchema = Hyperschema.from(SCHEMA_DIR)
const schema = hyperSchema.namespace('pearschool-mini')
schema.register({
  name: 'writer',
  fields: [
    { name: 'key', type: 'buffer', required: true }
  ]
})
schema.register({
  name: 'invite',
  fields: [
    { name: 'id', type: 'buffer', required: true },
    { name: 'invite', type: 'buffer', required: true },
    { name: 'publicKey', type: 'buffer', required: true },
    { name: 'expires', type: 'int', required: true }
  ]
})
schema.register({
  name: 'room',
  fields: [
    { name: 'id', type: 'string', required: true },
    { name: 'name', type: 'string', required: true },
    { name: 'invite', type: 'string', required: true },
    { name: 'info', type: 'json' }
  ]
})
schema.register({
  name: 'rooms',
  array: true,
  type: '@pearschool-mini/room'
})
schema.register({
  name: 'message',
  fields: [
    { name: 'id', type: 'string', required: true },
    { name: 'text', type: 'string', required: true },
    { name: 'info', type: 'json' }
  ]
})
schema.register({
  name: 'messages',
  array: true,
  type: '@pearschool-mini/message'
})
schema.register({
  name: 'get-messages',
  fields: [
    { name: 'messages', type: '@pearschool-mini/messages', required: true },
    { name: 'roomId', type: 'string', required: true }
  ]
})
schema.register({
  name: 'add-message',
  fields: [
    { name: 'text', type: 'string', required: true },
    { name: 'roomId', type: 'string', required: true }
  ]
})
schema.register({
  name: 'task',
  fields: [
    { name: 'id', type: 'string', required: true },
    { name: 'name', type: 'string', required: true },
    { name: 'description', type: 'string' },
    { name: 'dueDate', type: 'int' },
    { name: 'status', type: 'string', required: true },
    { name: 'info', type: 'json' }
  ]
})
schema.register({
  name: 'tasks',
  array: true,
  type: '@pearschool-mini/task'
})
schema.register({
  name: 'delete-task',
  fields: [
    { name: 'id', type: 'string', required: true }
  ]
})
schema.register({
  name: 'course',
  fields: [
    { name: 'id', type: 'string', required: true },
    { name: 'title', type: 'string', required: true },
    { name: 'instructor', type: 'string', required: true },
    { name: 'room', type: 'string' },
    { name: 'startDate', type: 'int' },
    { name: 'status', type: 'string', required: true },
    { name: 'info', type: 'json' },
    { name: 'description', type: 'string' }
  ]
})
schema.register({
  name: 'courses',
  array: true,
  type: '@pearschool-mini/course'
})
schema.register({
  name: 'delete-course',
  fields: [
    { name: 'id', type: 'string', required: true }
  ]
})
schema.register({
  name: 'drive',
  fields: [
    { name: 'key', type: 'buffer', required: true },
    { name: 'info', type: 'json' }
  ]
})
schema.register({
  name: 'drives',
  array: true,
  type: '@pearschool-mini/drive'
})
schema.register({
  name: 'file',
  fields: [
    { name: 'name', type: 'string', required: true },
    { name: 'uri', type: 'string', required: true },
    { name: 'info', type: 'json' }
  ]
})
schema.register({
  name: 'video',
  fields: [
    { name: 'id', type: 'string', required: true },
    { name: 'name', type: 'string', required: true },
    { name: 'type', type: 'string', required: true },
    { name: 'blob', type: 'json', required: true },
    { name: 'info', type: 'json' }
  ]
})
schema.register({
  name: 'videos',
  array: true,
  type: '@pearschool-mini/video'
})
schema.register({
  name: 'configure',
  fields: [
    { name: 'name', type: 'string', required: true },
    { name: 'invite', type: 'string' },
    { name: 'blindPeerKey', type: 'string' }
  ]
})
Hyperschema.toDisk(hyperSchema)

const hyperdb = HyperdbBuilder.from(SCHEMA_DIR, DB_DIR)
const db = hyperdb.namespace('pearschool-mini')
db.collections.register({
  name: 'invites',
  schema: '@pearschool-mini/invite',
  key: ['id']
})
db.collections.register({
  name: 'rooms',
  schema: '@pearschool-mini/room',
  key: ['id']
})
db.collections.register({
  name: 'messages',
  schema: '@pearschool-mini/message',
  key: ['id']
})
db.collections.register({
  name: 'tasks',
  schema: '@pearschool-mini/task',
  key: ['id']
})
db.collections.register({
  name: 'drives',
  schema: '@pearschool-mini/drive',
  key: ['key']
})
db.collections.register({
  name: 'courses',
  schema: '@pearschool-mini/course',
  key: ['id']
})
db.collections.register({
  name: 'videos',
  schema: '@pearschool-mini/video',
  key: ['id']
})
HyperdbBuilder.toDisk(hyperdb)

const hyperdispatch = Hyperdispatch.from(SCHEMA_DIR, DISPATCH_DIR, { offset: 0 })
const dispatch = hyperdispatch.namespace('pearschool-mini')
dispatch.register({ name: 'add-writer', requestType: '@pearschool-mini/writer' })
dispatch.register({ name: 'add-invite', requestType: '@pearschool-mini/invite' })
dispatch.register({ name: 'add-room', requestType: '@pearschool-mini/room' })
dispatch.register({ name: 'add-message', requestType: '@pearschool-mini/message' })
dispatch.register({ name: 'add-drive', requestType: '@pearschool-mini/drive' })
dispatch.register({ name: 'add-task', requestType: '@pearschool-mini/task' })
dispatch.register({ name: 'delete-task', requestType: '@pearschool-mini/delete-task' })
dispatch.register({ name: 'add-course', requestType: '@pearschool-mini/course' })
dispatch.register({ name: 'delete-course', requestType: '@pearschool-mini/delete-course' })
dispatch.register({ name: 'add-video', requestType: '@pearschool-mini/video' })
Hyperdispatch.toDisk(hyperdispatch)

const hrpc = HRPC.from(SCHEMA_DIR, HRPC_DIR)
const rpc = hrpc.namespace('pearschool-mini')
rpc.register({
  name: 'rooms',
  request: { name: '@pearschool-mini/rooms', send: true }
})
rpc.register({
  name: 'add-room',
  request: { name: 'string', send: true }
})
rpc.register({
  name: 'join-room',
  request: { name: 'string', send: true }
})
rpc.register({
  name: 'messages',
  request: { name: '@pearschool-mini/get-messages', send: true }
})
rpc.register({
  name: 'add-message',
  request: { name: '@pearschool-mini/add-message', send: true }
})
rpc.register({
  name: 'drives',
  request: { name: '@pearschool-mini/drives', send: true }
})
rpc.register({
  name: 'add-file',
  request: { name: '@pearschool-mini/file', send: true }
})
rpc.register({
  name: 'tasks',
  request: { name: '@pearschool-mini/tasks', send: true }
})
rpc.register({
  name: 'add-task',
  request: { name: '@pearschool-mini/task', send: true }
})
rpc.register({
  name: 'delete-task',
  request: { name: '@pearschool-mini/delete-task', send: true }
})
rpc.register({
  name: 'courses',
  request: { name: '@pearschool-mini/courses', send: true }
})
rpc.register({
  name: 'add-course',
  request: { name: '@pearschool-mini/course', send: true }
})
rpc.register({
  name: 'delete-course',
  request: { name: '@pearschool-mini/delete-course', send: true }
})
rpc.register({
  name: 'videos',
  request: { name: '@pearschool-mini/videos', send: true }
})
rpc.register({
  name: 'add-video',
  request: { name: 'string', send: true }
})
rpc.register({
  name: 'account-invite',
  request: { name: 'string', send: true }
})
rpc.register({
  name: 'set-blind-peer-key',
  request: { name: 'string', send: true }
})
rpc.register({
  name: 'configure',
  request: { name: '@pearschool-mini/configure', send: true }
})
HRPC.toDisk(hrpc)
