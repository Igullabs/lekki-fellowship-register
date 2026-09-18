import { useMemo, useState, useEffect } from 'react'
import { isTruthy } from '../stats'

function fmtDate(value) {
  if (!value) return ''
  const d = new Date(value.length === 10 ? value + 'T00:00:00' : value)
  if (isNaN(d.getTime())) return String(value)
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function MessagesView({
  viewer,
  leader,
  leaders,
  messages,
  onSend,
  onMarkRead,
  onBack,
}) {
  const [text, setText] = useState('')
  const [recipient, setRecipient] = useState('all')
  const [activeThread, setActiveThread] = useState(null)
  const [sent, setSent] = useState(false)

  const all = messages || []

  const leaderById = useMemo(
    () => Object.fromEntries((leaders || []).map((l) => [l.id, l])),
    [leaders]
  )

  const inThread = useMemo(() => {
    const sorted = all
      .slice()
      .sort((a, b) => (a.id < b.id ? -1 : 1))
    if (viewer === 'leader') {
      const lid = leader ? leader.id : null
      return sorted.filter(
        (m) =>
          (m.to === lid) ||
          (m.to === 'all' && m.fromRole === 'admin') ||
          (m.fromRole === 'leader' && m.fromId === lid && m.to === 'admin')
      )
    }
    if (activeThread === 'all') {
      return sorted.filter(
        (m) => m.fromRole === 'admin' && m.to === 'all'
      )
    }
    if (activeThread) {
      return sorted.filter(
        (m) =>
          (m.fromRole === 'leader' &&
            (m.fromId === activeThread || m.fromName === leaderById[activeThread]?.name) &&
            m.to === 'admin') ||
          (m.fromRole === 'admin' && m.to === activeThread)
      )
    }
    return []
  }, [viewer, leader, all, activeThread, leaderById])

  const conversations = useMemo(() => {
    const map = new Map()
    for (const m of all) {
      let key = null
      let label = null
      if (m.fromRole === 'admin') {
        if (m.to === 'all') {
          key = 'all'
          label = 'All leaders'
        } else {
          key = m.to
          label = leaderById[m.to] ? leaderById[m.to].name : 'Leader'
        }
      } else if (m.fromRole === 'leader') {
        key = m.fromId || m.fromName
        label = leaderById[m.fromId]
          ? leaderById[m.fromId].name
          : m.fromName || 'Leader'
      }
      if (!key) continue
      let convo = map.get(key)
      if (!convo) {
        convo = { key, label, count: 0, last: m.id }
        map.set(key, convo)
      }
      convo.last = m.id > convo.last ? m.id : convo.last
      if (m.to === 'admin' && !isTruthy(m.read)) convo.count++
    }
    return Array.from(map.values()).sort((a, b) => (a.last < b.last ? 1 : -1))
  }, [all, leaderById])

  const unreadInThread = useMemo(
    () => inThread.filter((m) => isAdminInbox(m, viewer) && !isTruthy(m.read)),
    [inThread, viewer]
  )

  const send = (e) => {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    if (viewer === 'admin') {
      onSend({
        id: 'msg' + Date.now(),
        date: new Date().toISOString(),
        fromRole: 'admin',
        fromName: 'Admin',
        to: recipient,
        message: body,
        read: 'false',
      })
    } else if (leader) {
      onSend({
        id: 'msg' + Date.now(),
        date: new Date().toISOString(),
        fromRole: 'leader',
        fromName: leader.name,
        fromId: leader.id,
        to: 'admin',
        message: body,
        read: 'false',
      })
    }
    setText('')
    setSent(true)
    setTimeout(() => setSent(false), 2000)
  }

  useEffect(() => {
    const incoming = inThread.filter(
      (m) => isAdminInbox(m, viewer) && !isTruthy(m.read)
    )
    if (incoming.length) onMarkRead(incoming.map((m) => m.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, activeThread, inThread.length])

  return (
    <div className="messages-view">
      <div className="messages-head">
      {onBack && (
        <button type="button" className="back-link" onClick={onBack}>
          <span className="back-arrow" aria-hidden="true">&larr;</span>
          Back
        </button>
      )}
        <div className="card-title">Messages</div>
        <div className="card-subtitle">
          {viewer === 'admin'
            ? 'Chat, broadcast and reply to house fellowship leaders.'
            : leader
              ? `${leader.name} · ${leader.fellowship} · talk to the admin`
              : 'Select your leader profile first.'}
        </div>
      </div>

      {viewer === 'admin' ? (
        <div className="messages-admin-layout">
          <div className="messages-convos">
            <div className="admin-section-title">Conversations</div>
            {conversations.length === 0 ? (
              <div className="empty-state">No messages yet.</div>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.key}
                  className={
                    'convo-row' +
                    (activeThread === c.key ? ' active' : '') +
                    (c.count > 0 ? ' has-unread' : '')
                  }
                  onClick={() => {
                    setActiveThread(c.key)
                    if (c.key !== 'all') setRecipient(c.key)
                  }}
                >
                  <span className="convo-name">{c.label}</span>
                  {c.count > 0 && <span className="convo-unread">{c.count}</span>}
                </button>
              ))
            )}
          </div>

          <div className="messages-thread">
            <div className="compose-box">
              <form onSubmit={send}>
                <label className="label">Send to</label>
                <select
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                >
                  <option value="all">All leaders (broadcast)</option>
                  {(leaders || []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} &mdash; {l.fellowship}
                    </option>
                  ))}
                </select>
                <textarea
                  className="report-input"
                  rows="3"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Write a message to send…"
                />
                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={!text.trim()}
                >
                  Send message
                </button>
              </form>
            </div>

            <div className="message-conversation">
              {activeThread ? (
                inThread.length === 0 ? (
                  <div className="empty-state">No messages in this conversation.</div>
                ) : (
                  inThread.map((m) => (
                    <MessageBubble key={m.id} m={m} adminView />
                  ))
                )
              ) : (
                <div className="empty-state">
                  Select a conversation on the left to read it, or use the
                  composer above to start a new one.
                </div>
              )}
              {unreadInThread.length > 0 && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() =>
                    onMarkRead(unreadInThread.map((m) => m.id))
                  }
                >
                  Mark {unreadInThread.length} as read
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="messages-thread">
          {inThread.length === 0 && (
            <div className="empty-state">
              No messages yet. Say hello to the admin or share an update from
              your fellowship.
            </div>
          )}
          <div className="message-conversation">
            {inThread.map((m) => (
              <MessageBubble key={m.id} m={m} />
            ))}
          </div>
          <form className="compose-box" onSubmit={send}>
            <textarea
              className="report-input"
              rows="3"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Reply to the admin…"
            />
            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={!leader || !text.trim()}
            >
              {sent ? 'Sent' : 'Send to admin'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

function isAdminInbox(m, viewer) {
  if (viewer === 'leader') return m.fromRole === 'admin'
  return m.fromRole === 'leader'
}

function MessageBubble({ m, adminView }) {
  const fromAdmin = m.fromRole === 'admin'
  return (
    <div className={'msg-row ' + (fromAdmin ? 'from-admin' : 'from-leader')}>
      <div className="msg-bubble">
        <div className="msg-meta">
          <span className="msg-sender">
            {fromAdmin
              ? m.to === 'all'
                ? 'Admin · Broadcast'
                : 'Admin'
              : m.fromName || 'Leader'}
          </span>
          <span className="msg-date">{fmtDate(m.date)}</span>
        </div>
        <div className="msg-body">{m.message}</div>
        {adminView && !fromAdmin && !isTruthy(m.read) && (
          <span className="unread-pill">New</span>
        )}
      </div>
    </div>
  )
}