import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

import useWorker from '../lib/use-worker'

function ChatPanel ({ rooms, messages, addMessage }) {
  const [selectedRoomId, setSelectedRoomId] = useState()
  const [input, setInput] = useState('')

  const sortedRooms = [...rooms].sort((a, b) => (a.info?.at || 0) - (b.info?.at || 0))
  const roomId = selectedRoomId || sortedRooms[0]?.id
  const roomMessages = messages[roomId] || []
  const selectedRoom = sortedRooms.find(r => r.id === roomId)
  const bgColor = selectedRoom?.info?.color || 'bg-slate-500'

  const onSend = () => {
    if (!input.trim() || !roomId) return
    addMessage({ roomId, text: input })
    setInput('')
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter') onSend()
  }

  return (
    <div className='flex gap-3'>
      <div className='w-56 bg-white p-3 rounded'>
        <h3 className='font-bold mb-2'>Rooms</h3>
        {sortedRooms.length === 0 && <div className='text-sm text-gray-500'>Loading…</div>}
        <ul>
          {sortedRooms.map(r => {
            const active = r.id === roomId
            const accent = r.info?.color || 'bg-slate-500'
            return (
              <li key={r.id}>
                <button
                  onClick={() => setSelectedRoomId(r.id)}
                  className={`w-full text-left p-2 my-1 rounded ${active ? `${accent} text-white` : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                  {r.name}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
      <div className={`flex-1 ${bgColor} p-4 rounded`}>
        <div className='mb-2 text-white font-bold text-lg'>
          {selectedRoom?.name || 'Select a room'}
        </div>
        <div className='mb-4 flex'>
          <input
            type='text'
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder='Type a message...'
            className='flex-1 p-2 border border-gray-300 rounded-l'
          />
          <button className='bg-white text-gray-800 px-4 py-2 rounded-r' onClick={onSend}>Send</button>
        </div>
        <div className='bg-white p-4 rounded'>
          <h2 className='text-lg font-bold mb-2'>Messages</h2>
          <ul>
            {roomMessages.map((msg, idx) => (
              <li key={idx} className='border-b py-1'>{`${msg.text} ~ ${msg.info.name} ~ ${new Date(msg.info.at).toISOString()}`}</li>
            ))}
            {roomMessages.length === 0 && <li className='text-sm text-gray-500'>No messages yet.</li>}
          </ul>
        </div>
      </div>
    </div>
  )
}

function FilesPanel ({ drives, addFile }) {
  const handleDrop = (e) => {
    e.preventDefault()
    onAddFiles(e.dataTransfer.files)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleSelect = (e) => {
    onAddFiles(e.target.files)
  }

  const onAddFiles = (files) => {
    for (const file of files) {
      const filePath = window.pear.getPathForFile(file)
      addFile({ name: file.name, uri: filePath })
    }
  }

  return (
    <div className='bg-white p-4 rounded'>
      <h2 className='text-lg font-bold mb-2'>Drives</h2>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className='border-2 border-dashed border-blue-500 p-2 mb-6 bg-white text-center'
      >
        <p>To add files to my drive, drag and drop files here, or click to select</p>
        <input
          type='file'
          multiple
          className='hidden'
          id='fileInput'
          onChange={handleSelect}
        />
        <label htmlFor='fileInput' className='cursor-pointer text-blue-500 underline'>Browse files</label>
      </div>
      <ul>
        {drives.map((drive, idx) => (
          <li key={idx} className='border-b py-1'>
            <div><a className='underline text-blue-700' href={drive.info.uri}>{drive.info.name} {drive.info.isMyDrive && '(My drive)'}</a></div>
            <div>
              {(drive.info.files || []).map((file, fidx) => (
                <div key={fidx}>
                  - <a className='underline text-blue-700' href={file.uri}>{file.name}</a>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TasksPanel ({ tasks, addTask, setTaskStatus, deleteTask }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState('open')

  const onAdd = () => {
    if (!name.trim()) return
    addTask({
      name: name.trim(),
      description: description.trim(),
      dueDate: dueDate ? new Date(dueDate).getTime() : 0,
      status,
      info: { at: Date.now() }
    })
    setName('')
    setDescription('')
    setDueDate('')
    setStatus('open')
  }

  const open = tasks.filter(t => t.status !== 'closed')
  const closed = tasks.filter(t => t.status === 'closed')

  const renderTask = (t) => (
    <li key={t.id} className='border-b py-2 flex items-start gap-2'>
      <input
        type='checkbox'
        checked={t.status === 'closed'}
        onChange={() => setTaskStatus(t, t.status === 'closed' ? 'open' : 'closed')}
        className='mt-1'
      />
      <div className='flex-1'>
        <div className={`font-bold ${t.status === 'closed' ? 'line-through text-gray-400' : ''}`}>{t.name}</div>
        {t.description && <div className='text-sm text-gray-600'>{t.description}</div>}
        {t.dueDate ? <div className='text-xs text-gray-500'>Due {new Date(t.dueDate).toLocaleDateString()}</div> : null}
      </div>
      <button
        onClick={() => deleteTask(t.id)}
        className='text-xs text-red-600 hover:text-red-800 px-2 py-1 border border-red-300 rounded'
        title='Delete task'
      >
        Delete
      </button>
    </li>
  )

  return (
    <div className='bg-white p-4 rounded'>
      <h2 className='text-lg font-bold mb-2'>Tasks</h2>
      <div className='mb-4 grid grid-cols-1 gap-2'>
        <input
          type='text'
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder='Task name'
          className='p-2 border border-gray-300 rounded'
        />
        <input
          type='text'
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder='Short description'
          className='p-2 border border-gray-300 rounded'
        />
        <div className='flex gap-2'>
          <input
            type='date'
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className='p-2 border border-gray-300 rounded flex-1'
          />
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className='p-2 border border-gray-300 rounded'
          >
            <option value='open'>Open</option>
            <option value='closed'>Closed</option>
          </select>
          <button onClick={onAdd} className='bg-slate-700 text-white px-4 py-2 rounded'>Add task</button>
        </div>
      </div>
      <h3 className='font-bold mb-1'>Open ({open.length})</h3>
      <ul className='mb-4'>
        {open.map(renderTask)}
        {open.length === 0 && <li className='text-sm text-gray-500'>No open tasks.</li>}
      </ul>
      <h3 className='font-bold mb-1'>Closed ({closed.length})</h3>
      <ul>
        {closed.map(renderTask)}
        {closed.length === 0 && <li className='text-sm text-gray-500'>No closed tasks.</li>}
      </ul>
    </div>
  )
}

const COURSE_STATUSES = ['draft', 'open', 'closed']
const COURSE_STATUS_LABELS = { draft: 'Draft', open: 'Open', closed: 'Closed' }

function CoursesPanel ({ courses, addCourse, setCourseStatus, deleteCourse }) {
  const [title, setTitle] = useState('')
  const [instructor, setInstructor] = useState('')
  const [room, setRoom] = useState('')
  const [startDate, setStartDate] = useState('')
  const [status, setStatus] = useState('draft')
  const [description, setDescription] = useState('')

  const onAdd = () => {
    if (!title.trim() || !instructor.trim()) return
    addCourse({
      title: title.trim(),
      instructor: instructor.trim(),
      room: room.trim(),
      startDate: startDate ? new Date(startDate).getTime() : 0,
      status,
      description: description.trim(),
      info: { at: Date.now() }
    })
    setTitle('')
    setInstructor('')
    setRoom('')
    setStartDate('')
    setStatus('draft')
    setDescription('')
  }

  const renderCourse = (c) => (
    <li key={c.id} className='border-b py-2 flex items-start gap-2'>
      <select
        value={c.status}
        onChange={e => setCourseStatus(c, e.target.value)}
        className='p-1 border border-gray-300 rounded text-sm'
      >
        {COURSE_STATUSES.map(s => (
          <option key={s} value={s}>{COURSE_STATUS_LABELS[s]}</option>
        ))}
      </select>
      <div className='flex-1'>
        <div className='font-bold'>{c.title}</div>
        <div className='text-sm text-gray-600'>
          {c.instructor}
          {c.room && <span> · {c.room}</span>}
          {c.startDate ? <span> · Starts {new Date(c.startDate).toLocaleDateString()}</span> : null}
        </div>
        {c.description && (
          <div className='text-sm text-gray-700 mt-1 whitespace-pre-wrap'>{c.description}</div>
        )}
      </div>
      <button
        onClick={() => deleteCourse(c.id)}
        className='text-xs text-red-600 hover:text-red-800 px-2 py-1 border border-red-300 rounded'
        title='Delete course'
      >
        Delete
      </button>
    </li>
  )

  return (
    <div className='bg-white p-4 rounded'>
      <h2 className='text-lg font-bold mb-2'>Courses</h2>
      <div className='mb-4 grid grid-cols-1 gap-2'>
        <input
          type='text'
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder='Course title'
          className='p-2 border border-gray-300 rounded'
        />
        <input
          type='text'
          value={instructor}
          onChange={e => setInstructor(e.target.value)}
          placeholder='Instructor'
          className='p-2 border border-gray-300 rounded'
        />
        <input
          type='text'
          value={room}
          onChange={e => setRoom(e.target.value)}
          placeholder='Room (optional)'
          className='p-2 border border-gray-300 rounded'
        />
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder='Description (optional)'
          rows={4}
          className='p-2 border border-gray-300 rounded resize-y'
        />
        <div className='flex gap-2'>
          <input
            type='date'
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className='p-2 border border-gray-300 rounded flex-1'
          />
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className='p-2 border border-gray-300 rounded'
          >
            {COURSE_STATUSES.map(s => (
              <option key={s} value={s}>{COURSE_STATUS_LABELS[s]}</option>
            ))}
          </select>
          <button onClick={onAdd} className='bg-slate-700 text-white px-4 py-2 rounded'>Add course</button>
        </div>
      </div>
      {COURSE_STATUSES.map(s => {
        const rows = courses.filter(c => c.status === s)
        return (
          <div key={s} className='mb-4'>
            <h3 className='font-bold mb-1'>{COURSE_STATUS_LABELS[s]} ({rows.length})</h3>
            <ul>
              {rows.map(renderCourse)}
              {rows.length === 0 && (
                <li className='text-sm text-gray-500'>No {s} courses.</li>
              )}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

function buildShareLink ({ accountInvite, clipId }) {
  const raw = globalThis.Pear?.config?.applink
  const appLink = (typeof raw === 'string' && raw.startsWith('pear://')) ? raw : 'pear://<your-pear-link>'
  const invite = accountInvite || '<account-invite>'
  return `${appLink}?invite=${encodeURIComponent(invite)}#clip=${encodeURIComponent(clipId)}`
}

function isDevPearLink () {
  const raw = globalThis.Pear?.config?.applink
  return !(typeof raw === 'string' && raw.startsWith('pear://'))
}

function FreeClipsPanel ({ videos, addVideo, accountInvite, initialPlayerId }) {
  const [playerId, setPlayerId] = useState(initialPlayerId)
  const [copiedFor, setCopiedFor] = useState()

  useEffect(() => {
    if (initialPlayerId) setPlayerId(initialPlayerId)
  }, [initialPlayerId])

  const onShare = async (e, clipId) => {
    e.stopPropagation()
    const url = buildShareLink({ accountInvite, clipId })
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopiedFor(clipId)
    setTimeout(() => setCopiedFor((prev) => (prev === clipId ? undefined : prev)), 1500)
  }

  const onAddFiles = (files) => {
    for (const file of files) {
      const filePath = window.pear.getPathForFile(file)
      addVideo(filePath)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    onAddFiles(e.dataTransfer.files)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  useEffect(() => {
    const onWinDragOver = (e) => { e.preventDefault() }
    const onWinDrop = (e) => {
      e.preventDefault()
      if (e.dataTransfer?.files?.length) onAddFiles(e.dataTransfer.files)
    }
    window.addEventListener('dragover', onWinDragOver)
    window.addEventListener('drop', onWinDrop)
    return () => {
      window.removeEventListener('dragover', onWinDragOver)
      window.removeEventListener('drop', onWinDrop)
    }
  }, [])

  const handleSelect = (e) => {
    onAddFiles(e.target.files)
  }

  const renderPlayer = () => {
    const video = videos.find(v => v.id === playerId)
    if (!video) {
      return <div className='text-sm text-gray-500'>Loading clip… (id: {playerId})</div>
    }
    return (
      <div className='flex flex-col gap-2'>
        <div className='flex gap-2'>
          <button
            className='cursor-pointer bg-gray-200 px-3 py-1 rounded'
            onClick={() => setPlayerId()}
          >
            ← Back to gallery
          </button>
          <button
            className='cursor-pointer bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700'
            onClick={(e) => onShare(e, video.id)}
            title='Copy a shareable pear:// link to this clip'
          >
            {copiedFor === video.id ? '✓ Link copied' : '🔗 Share clip'}
          </button>
        </div>
        <div className='mb-2 text-sm text-gray-600'>{video.name}</div>
        {video.type.startsWith('image/')
          ? (
            <img src={video.info.link} alt={video.name} className='w-full max-h-[70vh] object-contain bg-black' />
            )
          : (
            <video src={video.info.link} controls autoPlay className='w-full max-h-[70vh] bg-black' />
            )}
      </div>
    )
  }

  const renderGallery = () => {
    if (videos.length === 0) {
      return <div className='text-sm text-gray-500'>No clips yet. Drop a photo or video above to get started.</div>
    }
    return (
      <div className='flex flex-wrap gap-4'>
        {videos.map((video) => (
          <div
            key={video.id}
            onClick={() => setPlayerId(video.id)}
            className='relative cursor-pointer w-60 shadow rounded overflow-hidden bg-gray-50 hover:shadow-lg'
          >
            {video.type.startsWith('image/')
              ? (
                <img
                  src={video.info.preview || video.info.link}
                  alt={video.name}
                  className='w-full h-40 object-cover'
                />
                )
              : (
                <video
                  src={video.info.link}
                  className='w-full h-40 object-cover bg-black'
                  controls={false}
                  muted
                  preload='metadata'
                />
                )}
            <div className='p-2 flex items-center justify-between gap-2'>
              <div className='text-xs truncate flex-1' title={video.name}>{video.name}</div>
              <button
                onClick={(e) => onShare(e, video.id)}
                className='text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 shrink-0'
                title='Copy a shareable pear:// link to this clip'
              >
                {copiedFor === video.id ? '✓' : '🔗'}
              </button>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className='bg-white p-4 rounded'
    >
      <h2 className='text-lg font-bold mb-2'>Free clips</h2>
      {isDevPearLink() && (
        <div className='mb-3 text-xs text-gray-600 bg-amber-50 border border-amber-200 rounded px-3 py-2'>
          ℹ️ Dev mode: share links contain <code>&lt;your-pear-link&gt;</code> as a placeholder. Run <code>pear stage &lt;channel&gt;</code> to get a real <code>pear://</code> applink — once staged, the Share button fills it in automatically.
        </div>
      )}
      <div className='border-2 border-dashed border-blue-500 p-4 mb-4 bg-blue-50 text-center'>
        <p className='mb-1'>Drop photos or videos anywhere on this tab, or click below to browse</p>
        <input
          type='file'
          multiple
          accept='image/*,video/*'
          className='hidden'
          id='clipInput'
          onChange={handleSelect}
        />
        <label htmlFor='clipInput' className='cursor-pointer text-blue-500 underline'>Browse files</label>
      </div>
      {playerId ? renderPlayer() : renderGallery()}
    </div>
  )
}

function KeysPanel ({ accountInvite, configure }) {
  const [name, setName] = useState('')
  const [blindKey, setBlindKey] = useState('')
  const [invite, setInvite] = useState('')
  const [connecting, setConnecting] = useState(false)

  const connected = !!accountInvite

  const onConnect = () => {
    if (!name.trim() || !blindKey.trim()) return
    setConnecting(true)
    configure({
      name: name.trim(),
      blindPeerKey: blindKey.trim(),
      invite: invite.trim() || ''
    })
  }

  const onCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(accountInvite)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = accountInvite
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
  }

  if (!connected) {
    return (
      <div className='bg-white p-4 rounded max-w-lg mx-auto'>
        <h2 className='text-lg font-bold mb-1'>Setup</h2>
        <p className='text-sm text-gray-500 mb-4'>
          Start a blind peer in a terminal first, then enter your details below.
        </p>

        <div className='mb-4'>
          <label className='font-bold text-sm mb-1 block'>Your name</label>
          <input
            type='text'
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder='e.g. alice'
            className='w-full p-2 border border-gray-300 rounded'
          />
        </div>

        <div className='mb-4'>
          <label className='font-bold text-sm mb-1 block'>Blind peer listening key</label>
          <p className='text-xs text-gray-500 mb-1'>Paste the key from your running blind peer.</p>
          <input
            type='text'
            value={blindKey}
            onChange={e => setBlindKey(e.target.value)}
            placeholder='Paste blind peer key here...'
            className='w-full p-2 border border-gray-300 rounded font-mono text-sm'
          />
        </div>

        <div className='mb-6'>
          <label className='font-bold text-sm mb-1 block'>Account invite (optional)</label>
          <p className='text-xs text-gray-500 mb-1'>
            Leave empty to create a new account. Paste another user's invite to join their account.
          </p>
          <input
            type='text'
            value={invite}
            onChange={e => setInvite(e.target.value)}
            placeholder='Paste account invite to join...'
            className='w-full p-2 border border-gray-300 rounded font-mono text-sm'
          />
        </div>

        <button
          onClick={onConnect}
          disabled={!name.trim() || !blindKey.trim() || connecting}
          className='w-full bg-slate-700 text-white px-4 py-3 rounded font-bold disabled:opacity-50'
        >
          {connecting ? 'Connecting...' : 'Connect'}
        </button>
      </div>
    )
  }

  return (
    <div className='bg-white p-4 rounded'>
      <h2 className='text-lg font-bold mb-4'>Keys</h2>

      <div className='mb-6'>
        <h3 className='font-bold mb-1'>Your Account Invite</h3>
        <p className='text-sm text-gray-500 mb-2'>Share this with others so they can join your account.</p>
        <div className='flex gap-2'>
          <input
            type='text'
            value={accountInvite}
            readOnly
            className='flex-1 p-2 border border-gray-300 rounded bg-gray-50 text-sm font-mono'
          />
          <button
            onClick={onCopyInvite}
            className='bg-slate-700 text-white px-4 py-2 rounded'
          >
            Copy
          </button>
        </div>
      </div>

      <div className='text-sm text-green-600'>Connected</div>
    </div>
  )
}

function App () {
  const { rooms, messages, drives, tasks, courses, videos, accountInvite, addMessage, addFile, addTask, setTaskStatus, deleteTask, addCourse, setCourseStatus, deleteCourse, addVideo, configure } = useWorker()
  const [tab, setTab] = useState('keys')
  const [initialPlayerId, setInitialPlayerId] = useState()

  const connected = !!accountInvite

  useEffect(() => {
    if (connected && tab === 'keys') setTab('chat')
  }, [connected])

  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return
    const params = new URLSearchParams(hash.slice(1))
    const clipId = params.get('clip')
    if (clipId) {
      setTab('clips')
      setInitialPlayerId(clipId)
    }
  }, [])

  const tabBtn = (id, label) => (
    <button
      onClick={() => setTab(id)}
      disabled={!connected && id !== 'keys'}
      className={`px-4 py-2 rounded-t ${tab === id ? 'bg-white text-slate-800 font-bold' : 'bg-slate-400 text-white'} ${!connected && id !== 'keys' ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {label}
    </button>
  )

  return (
    <div className='bg-slate-700 min-h-screen p-4'>
      <div className='flex mb-3 gap-1 items-center'>
        {tabBtn('chat', 'Chat')}
        {tabBtn('files', 'Files')}
        {tabBtn('tasks', 'Tasks')}
        {tabBtn('courses', 'Courses')}
        {tabBtn('clips', 'Free clips')}
        {tabBtn('keys', 'Keys')}
        <div className='ml-auto text-xs text-slate-400 font-mono'>
          v{window.pear?.version || '?'}
        </div>
      </div>
      {tab === 'chat' && <ChatPanel rooms={rooms} messages={messages} addMessage={addMessage} />}
      {tab === 'files' && <FilesPanel drives={drives} addFile={addFile} />}
      {tab === 'tasks' && <TasksPanel tasks={tasks} addTask={addTask} setTaskStatus={setTaskStatus} deleteTask={deleteTask} />}
      {tab === 'courses' && <CoursesPanel courses={courses} addCourse={addCourse} setCourseStatus={setCourseStatus} deleteCourse={deleteCourse} />}
      {tab === 'clips' && <FreeClipsPanel videos={videos} addVideo={addVideo} accountInvite={accountInvite} initialPlayerId={initialPlayerId} />}
      {tab === 'keys' && <KeysPanel accountInvite={accountInvite} configure={configure} />}
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
