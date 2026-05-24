import FramedStream from 'framed-stream'
import { useEffect, useState } from 'react'

import HRPC from '../spec/hrpc'

// window.pear-backed duplex pipe (duck-typed for framed-stream)
class WindowPearPipe {
  constructor () { this._dataListeners = [] }
  on (ev, cb) { if (ev === 'data') this._dataListeners.push(cb); return this }
  off (ev, cb) {
    if (ev === 'data') this._dataListeners = this._dataListeners.filter(x => x !== cb)
    return this
  }
  emit (ev, data) { if (ev === 'data') this._dataListeners.forEach(cb => cb(data)) }
  write (buf) { window.pear.send(buf); return true }
  end () {}
  pause () {}
  resume () {}
}
const pipe = new WindowPearPipe()
window.pear.on((data) => pipe.emit('data', data))

const stream = new FramedStream(pipe)
const rpc = new HRPC(stream)
stream.pause()

function upsertById (list, item) {
  const i = list.findIndex(x => x.id === item.id)
  if (i === -1) return [...list, item]
  const copy = list.slice()
  copy[i] = item
  return copy
}

export default function useWorker () {
  const [rooms, setRooms] = useState([])
  const [messages, setMessages] = useState({})
  const [drives, setDrives] = useState([])
  const [tasks, setTasks] = useState([])
  const [courses, setCourses] = useState([])
  const [videos, setVideos] = useState([])
  const [accountInvite, setAccountInvite] = useState('')

  useEffect(() => {
    rpc.onRooms((data) => setRooms(data))
    rpc.onMessages(({ messages: msgs, roomId }) => {
      setMessages(prev => ({ ...prev, [roomId]: msgs }))
    })
    rpc.onDrives((data) => setDrives(data))
    rpc.onTasks((data) => setTasks(data))
    rpc.onCourses((data) => setCourses(data))
    rpc.onVideos((data) => setVideos(data))
    rpc.onAccountInvite((invite) => setAccountInvite(invite))
    stream.resume()
    return () => pipe.end()
  }, [])

  return {
    rooms,
    messages,
    drives,
    tasks,
    courses,
    videos,
    accountInvite,
    addRoom: (name) => rpc.addRoom(name),
    joinRoom: (invite) => rpc.joinRoom(invite),
    addMessage: ({ roomId, text }) => rpc.addMessage({ roomId, text }),
    addFile: (file) => rpc.addFile(file),
    addTask: (task) => {
      const payload = {
        id: task.id || Math.random().toString(16).slice(2),
        name: task.name,
        description: task.description || '',
        dueDate: task.dueDate || 0,
        status: task.status || 'open',
        info: task.info || { at: Date.now() }
      }
      setTasks(prev => upsertById(prev, payload))
      return rpc.addTask(payload)
    },
    setTaskStatus: (task, status) => {
      const payload = {
        id: task.id,
        name: task.name,
        description: task.description || '',
        dueDate: task.dueDate || 0,
        status,
        info: task.info || {}
      }
      setTasks(prev => upsertById(prev, payload))
      return rpc.addTask(payload)
    },
    deleteTask: (id) => {
      setTasks(prev => prev.filter(t => t.id !== id))
      return rpc.deleteTask({ id })
    },
    addCourse: (course) => {
      const payload = {
        id: course.id || Math.random().toString(16).slice(2),
        title: course.title,
        instructor: course.instructor,
        room: course.room || '',
        startDate: course.startDate || 0,
        status: course.status || 'draft',
        info: course.info || { at: Date.now() },
        description: course.description || ''
      }
      setCourses(prev => upsertById(prev, payload))
      return rpc.addCourse(payload)
    },
    setCourseStatus: (course, status) => {
      const payload = {
        id: course.id,
        title: course.title,
        instructor: course.instructor,
        room: course.room || '',
        startDate: course.startDate || 0,
        status,
        info: course.info || {},
        description: course.description || ''
      }
      setCourses(prev => upsertById(prev, payload))
      return rpc.addCourse(payload)
    },
    deleteCourse: (id) => {
      setCourses(prev => prev.filter(c => c.id !== id))
      return rpc.deleteCourse({ id })
    },
    addVideo: (filePath) => rpc.addVideo(filePath)
  }
}
