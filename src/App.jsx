import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import {
  isSheetConfigured,
  configureSheet,
  SHEET_NAMES,
  fetchRows,
  safeFetchRows,
  addRows,
  updateRows,
  deleteRows,
  deleteAllRows,
} from './sheetApi'

const ADMIN_PASSWORD = 'admin'

const CHURCH_NAME = 'Lekki Fellowship'
const CHURCH_LOCATION = 'Lekki, Lagos State'

const CACHE_KEY = 'lekki_fellowship_state'
const VIEW_KEY = 'lekki_view'
const LEADER_KEY = 'lekki_selected_leader'
const ADMIN_KEY = 'lekki_admin_session'
const ADMIN_SESSION_TTL = 30 * 60 * 1000 // 30 minutes

const LEKKI_LOCATIONS = [
  'Lekki Phase 1',
  'Lekki Phase 2',
  'Ikate',
  'Ajah',
  'Chevron',
  'Ikota',
  'Jakande',
  'Oniru',
  'Victoria Garden City (VGC)',
  'Maruwa',
  'Osapa London',
  'Igbo Efon',
  'Addo',
  'Badore',
  'Sangotedo',
  'Other',
]

const seed = () => ({
  leaders: [
    {
      id: 'l1',
      name: 'Ade Johnson',
      fellowship: 'Teens',
      location: 'Lekki Phase 1',
      phone: '0803 123 4567',
      addedAt: Date.now(),
    },
    {
      id: 'l2',
      name: 'Sarah Okafor',
      fellowship: 'Singles',
      location: 'Ajah',
      phone: '0805 987 6543',
      addedAt: Date.now(),
    },
  ],
  members: [
    { id: 'm1', name: 'Chinedu Eze', fellowship: 'Teens', location: 'Ikate' },
    { id: 'm2', name: 'Mary Adeyemi', fellowship: 'Singles', location: 'Chevron' },
    { id: 'm3', name: 'Tunde Bakare', fellowship: 'Workers', location: 'Lekki Phase 2' },
    { id: 'm4', name: 'Blessing Nwosu', fellowship: 'Teens', location: 'Ikota' },
    { id: 'm5', name: 'Emeka Obi', fellowship: 'Singles', location: 'Jakande' },
    { id: 'm6', name: 'Grace Ogu', fellowship: 'Workers', location: 'Oniru' },
  ],
  attendance: {},
  reports: [],
})

function normalize(state) {
  return {
    leaders: (state.leaders || []).map((l) => ({
      location: 'Lekki',
      phone: '',
      ...l,
    })),
    members: (state.members || []).map((m) => ({ location: 'Lekki', ...m })),
    attendance: state.attendance || {},
    reports: state.reports || [],
  }
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) return normalize(JSON.parse(raw))
  } catch (e) {
    // ignore corrupt cache and use seed
  }
  return seed()
}

function saveCache(state) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(state))
  } catch (e) {
    // ignore storage failures
  }
}

function loadView() {
  try {
    const v = localStorage.getItem(VIEW_KEY)
    if (['admin', 'admin-login', 'attendance', 'report', 'landing'].includes(v)) return v
  } catch (e) { /* ignore */ }
  return 'landing'
}

function saveView(view) {
  try { localStorage.setItem(VIEW_KEY, view) } catch (e) { /* ignore */ }
}

function loadLeaderId() {
  try { return localStorage.getItem(LEADER_KEY) || '' } catch (e) { return '' }
}

function saveLeaderId(id) {
  try { id ? localStorage.setItem(LEADER_KEY, id) : localStorage.removeItem(LEADER_KEY) } catch (e) { /* ignore */ }
}

function loadAdminSession() {
  try {
    const raw = localStorage.getItem(ADMIN_KEY)
    if (!raw) return false
    const s = JSON.parse(raw)
    return s && s.authenticated && Date.now() - s.ts < ADMIN_SESSION_TTL
  } catch (e) { return false }
}

function saveAdminSession() {
  try { localStorage.setItem(ADMIN_KEY, JSON.stringify({ authenticated: true, ts: Date.now() })) } catch (e) { /* ignore */ }
}

function clearAdminSession() {
  try { localStorage.removeItem(ADMIN_KEY) } catch (e) { /* ignore */ }
}

function groupAttendance(rows) {
  const map = {}
  for (const row of rows || []) {
    if (!row.date) continue
    map[row.date] = map[row.date] || { records: [], takenBy: '' }
    map[row.date].records.push({ memberId: row.memberId, present: row.present === 'true' || row.present === true })
    if (row.takenBy) map[row.date].takenBy = row.takenBy
  }
  return map
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function todayLabel() {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function App() {
  const [state, setState] = useState(loadCache)
  const [view, setView] = useState(() => {
    const v = loadView()
    if (v === 'admin' && !loadAdminSession()) return 'landing'
    return v
  })
  const [selectedLeaderId, setSelectedLeaderId] = useState(loadLeaderId)
  const [syncStatus, setSyncStatus] = useState(
    isSheetConfigured() ? 'loading' : 'unconfigured'
  )
  const [toasts, setToasts] = useState([])
  const toastId = useRef(0)

  const addToast = useCallback((message, tone = 'success') => {
    const id = ++toastId.current
    setToasts((t) => [...t, { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])

  useEffect(() => {
    saveCache(state)
  }, [state])

  useEffect(() => {
    saveView(view)
  }, [view])

  useEffect(() => {
    saveLeaderId(selectedLeaderId)
  }, [selectedLeaderId])

  useEffect(() => {
    if (!isSheetConfigured()) return
    let cancelled = false
    ;(async () => {
      try {
        const [leaders, members, attendance, reports] = await Promise.all([
          fetchRows(SHEET_NAMES.leaders),
          fetchRows(SHEET_NAMES.members),
          fetchRows(SHEET_NAMES.attendance),
          safeFetchRows(SHEET_NAMES.reports),
        ])
        if (cancelled) return
        const loaded = {
          leaders: leaders.length ? leaders : [],
          members: members.length ? members : [],
          attendance: groupAttendance(attendance),
          reports: reports || [],
        }
        if (loaded.leaders.length || loaded.members.length) {
          setState(loaded)
        }
        setSyncStatus('synced')
      } catch (e) {
        if (!cancelled) setSyncStatus('offline')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const { leaders, members, attendance, reports } = state

  const addLeader = async (leader) => {
    const nextLeaders = [...state.leaders, leader]
    setState((s) => ({ ...s, leaders: nextLeaders }))
    addToast('Leader added')
    if (!isSheetConfigured()) return
    try {
      await addRows(SHEET_NAMES.leaders, [leader])
      setSyncStatus('synced')
    } catch (e) {
      setSyncStatus('offline')
    }
  }

  const addMember = async (member) => {
    const nextMembers = [...state.members, member]
    setState((s) => ({ ...s, members: nextMembers }))
    addToast('Member added')
    if (!isSheetConfigured()) return
    try {
      await addRows(SHEET_NAMES.members, [member])
      setSyncStatus('synced')
    } catch (e) {
      setSyncStatus('offline')
    }
  }

  const removeMember = async (id) => {
    const nextMembers = state.members.filter((m) => m.id !== id)
    setState((s) => ({ ...s, members: nextMembers }))
    addToast('Member removed')
    if (!isSheetConfigured()) return
    try {
      await deleteRows(SHEET_NAMES.members, { id })
      setSyncStatus('synced')
    } catch (e) {
      setSyncStatus('offline')
    }
  }

  const editLeader = async (id, updates) => {
    const nextLeaders = state.leaders.map((l) =>
      l.id === id ? { ...l, ...updates } : l
    )
    setState((s) => ({ ...s, leaders: nextLeaders }))
    addToast('Leader updated')
    if (!isSheetConfigured()) return
    try {
      await updateRows(SHEET_NAMES.leaders, 'id', id, updates)
      setSyncStatus('synced')
    } catch (e) {
      setSyncStatus('offline')
    }
  }

  const editMember = async (id, updates) => {
    const nextMembers = state.members.map((m) =>
      m.id === id ? { ...m, ...updates } : m
    )
    setState((s) => ({ ...s, members: nextMembers }))
    addToast('Member updated')
    if (!isSheetConfigured()) return
    try {
      await updateRows(SHEET_NAMES.members, 'id', id, updates)
      setSyncStatus('synced')
    } catch (e) {
      setSyncStatus('offline')
    }
  }

  const removeLeader = async (id) => {
    const nextLeaders = state.leaders.filter((l) => l.id !== id)
    setState((s) => ({ ...s, leaders: nextLeaders }))
    if (selectedLeaderId === id) setSelectedLeaderId('')
    addToast('Leader removed')
    if (!isSheetConfigured()) return
    try {
      await deleteRows(SHEET_NAMES.leaders, { id })
      setSyncStatus('synced')
    } catch (e) {
      setSyncStatus('offline')
    }
  }

  const saveAttendance = async (date, records, takenBy) => {
    const nextAttendance = { ...state.attendance, [date]: { records, takenBy } }
    setState((s) => ({ ...s, attendance: nextAttendance }))
    addToast('Attendance saved')
    if (!isSheetConfigured()) return
    try {
      await deleteRows(SHEET_NAMES.attendance, { date })
      await addRows(
        SHEET_NAMES.attendance,
        records.map((r) => ({
          date,
          memberId: r.memberId,
          present: r.present ? 'true' : 'false',
          takenBy,
        }))
      )
      setSyncStatus('synced')
    } catch (e) {
      setSyncStatus('offline')
    }
  }

  const addReport = async (report) => {
    const next = [...state.reports, report]
    setState((s) => ({ ...s, reports: next }))
    addToast('Report sent to admin')
    if (!isSheetConfigured()) return
    try {
      await addRows(SHEET_NAMES.reports, [report])
      setSyncStatus('synced')
    } catch (e) {
      setSyncStatus('offline')
    }
  }

  const markReportRead = async (id) => {
    setState((s) => ({
      ...s,
      reports: (s.reports || []).map((r) =>
        r.id === id ? { ...r, read: 'true' } : r
      ),
    }))
    if (!isSheetConfigured()) return
    try {
      await updateRows(SHEET_NAMES.reports, 'id', id, { read: 'true' })
      setSyncStatus('synced')
    } catch (e) {
      setSyncStatus('offline')
    }
  }

  const refreshFromSheet = async () => {
    if (!isSheetConfigured()) return
    setSyncStatus('loading')
    try {
      const [leaders, members, attendance, reports] = await Promise.all([
        fetchRows(SHEET_NAMES.leaders),
        fetchRows(SHEET_NAMES.members),
        fetchRows(SHEET_NAMES.attendance),
        safeFetchRows(SHEET_NAMES.reports),
      ])
      setState({
        leaders: leaders.length ? leaders : [],
        members: members.length ? members : [],
        attendance: groupAttendance(attendance),
        reports: reports || [],
      })
      setSyncStatus('synced')
      addToast('Data refreshed from Google Sheets')
    } catch (e) {
      setSyncStatus('offline')
      addToast('Could not reach the Google Sheet', 'warn')
    }
  }

  const connectSheet = async (id) => {
    configureSheet(id)
    if (!isSheetConfigured()) {
      setSyncStatus('unconfigured')
      return
    }
    setSyncStatus('loading')
    try {
      const [leaders, members, attendance, reports] = await Promise.all([
        fetchRows(SHEET_NAMES.leaders),
        fetchRows(SHEET_NAMES.members),
        fetchRows(SHEET_NAMES.attendance),
        safeFetchRows(SHEET_NAMES.reports),
      ])
      setState({
        leaders: leaders.length ? leaders : [],
        members: members.length ? members : [],
        attendance: groupAttendance(attendance),
        reports: reports || [],
      })
      setSyncStatus('synced')
      addToast('Google Sheet connected')
    } catch (e) {
      setSyncStatus('offline')
    }
  }

  const resetApp = async () => {
    const fresh = seed()
    setState(fresh)
    setView('landing')
    setSelectedLeaderId('')
    clearAdminSession()
    addToast('All data reset')
    if (!isSheetConfigured()) return
    try {
      await deleteAllRows(SHEET_NAMES.leaders)
      await deleteAllRows(SHEET_NAMES.members)
      await deleteAllRows(SHEET_NAMES.attendance)
      await deleteAllRows(SHEET_NAMES.reports)
      setState(seed())
      setSyncStatus('synced')
    } catch (e) {
      setSyncStatus('offline')
    }
  }

  if (view === 'landing') {
    return (
      <Landing
        leaders={leaders}
        members={members}
        attendance={attendance}
        selectedLeaderId={selectedLeaderId}
        syncStatus={syncStatus}
        onLeaderChange={setSelectedLeaderId}
        onEnterAdmin={() => setView('admin-login')}
        onConnect={connectSheet}
        onStartAttendance={(id) => {
          setSelectedLeaderId(id)
          setView('attendance')
        }}
        onStartReport={(id) => {
          setSelectedLeaderId(id)
          setView('report')
        }}
      />
    )
  }

  return (
    <div className="app-container">
      <div className="card">
        {view === 'admin-login' && (
          <AdminLogin
            onSuccess={() => {
              saveAdminSession()
              setView('admin')
            }}
            onBack={() => setView('landing')}
          />
        )}
        {view === 'admin' && (
          <AdminPanel
            leaders={leaders}
            members={members}
            attendance={attendance}
            reports={reports}
            syncStatus={syncStatus}
            onRefresh={refreshFromSheet}
            onConnect={connectSheet}
            onAddLeader={addLeader}
            onAddMember={addMember}
            onEditLeader={editLeader}
            onEditMember={editMember}
            onRemoveLeader={removeLeader}
            onRemoveMember={removeMember}
            onMarkReportRead={markReportRead}
            onReset={resetApp}
            onBack={() => {
              clearAdminSession()
              setView('landing')
            }}
          />
        )}
        {view === 'attendance' && (
          <AttendanceView
            leader={leaders.find((l) => l.id === selectedLeaderId)}
            members={members}
            attendance={attendance}
            onSave={saveAttendance}
            onBack={() => setView('landing')}
          />
        )}
        {view === 'report' && (
          <ReportView
            leader={leaders.find((l) => l.id === selectedLeaderId)}
            onSend={addReport}
            onBack={() => setView('landing')}
          />
        )}
      </div>
      <ToastStack toasts={toasts} />
    </div>
  )
}

function ToastStack({ toasts }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={'toast toast-' + (t.tone || 'success')}>
          {t.message}
        </div>
      ))}
    </div>
  )
}

function ReportView({ leader, onSend, onBack }) {
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    if (!leader || !message.trim()) return
    onSend({
      id: 'r' + Date.now(),
      date: todayKey(),
      leaderId: leader.id,
      leaderName: leader.name,
      message: message.trim(),
      read: 'false',
    })
    setMessage('')
    setSent(true)
  }

  return (
    <>
      <div className="card-title">Send a report to the admin</div>
      <div className="card-subtitle">
        {leader
          ? `Reporting as ${leader.name} · ${leader.fellowship}`
          : 'Select your leader profile first.'}
      </div>

      {sent ? (
        <div className="report-sent">
          <div className="report-sent-icon">&#10003;</div>
          <p>Your report has been sent to the admin. Thank you.</p>
          <button className="btn" onClick={() => setSent(false)}>
            Send another report
          </button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="form-group">
            <label>What would you like to report?</label>
            <textarea
              className="report-input"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Attendance was low this week, a few members travelled. Prayer requests: …"
              rows="5"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={!message.trim()}>
            Send report
          </button>
        </form>
      )}

      <button type="button" className="btn mt-8 btn-full" onClick={onBack}>
        Back
      </button>
    </>
  )
}

function Landing({
  leaders,
  members,
  attendance,
  selectedLeaderId,
  syncStatus,
  onLeaderChange,
  onEnterAdmin,
  onConnect,
  onStartAttendance,
  onStartReport,
}) {
  const [showConnect, setShowConnect] = useState(false)
  const [sheetId, setSheetId] = useState('')

  const submitConnect = (e) => {
    e.preventDefault()
    if (!sheetId.trim()) return
    onConnect(sheetId)
    setSheetId('')
    setShowConnect(false)
  }

  const leader = leaders.find((l) => l.id === selectedLeaderId)

  const today = todayKey()
  const todays = attendance[today]
  const presentToday = todays
    ? todays.records.filter((r) => r.present).length
    : 0

  const scrollToSignIn = () => {
    document.getElementById('signin')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="nav-brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>
            <strong>Lekki Fellowship</strong>
            <em>Register</em>
          </span>
        </div>
        <div className="nav-actions">
          <SyncStatus status={syncStatus} />
          {syncStatus === 'unconfigured' && (
            <button className="btn btn-outline btn-sm" onClick={() => setShowConnect(true)}>
              Connect Sheet
            </button>
          )}
          <button className="btn btn-outline" onClick={onEnterAdmin}>
            Enter as Admin
          </button>
        </div>
      </header>

      <main>
        <section className="hero" style={{ backgroundImage: 'url(/images/church-community.jpg)' }}>
          <div className="hero-overlay" />
          <div className="hero-inner">
            <span className="hero-badge">
              {CHURCH_NAME} &middot; {CHURCH_LOCATION}
            </span>
            <h1 className="hero-title">
              Welcome to the
              <br />
              Lekki Fellowship Register
            </h1>
            <p className="hero-subtitle">
              Sign in to take attendance or manage members. Keeping our
              church family connected, one meeting at a time.
            </p>
            <div className="hero-stats">
              <div className="hero-stat">
                <div className="hero-stat-value">{members.length}</div>
                <div className="hero-stat-label">Registered members</div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-value">{leaders.length}</div>
                <div className="hero-stat-label">Leaders</div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-value">{presentToday}</div>
                <div className="hero-stat-label">Present today</div>
              </div>
            </div>
            <div className="hero-cta">
              <button
                className="btn btn-primary btn-lg"
                onClick={scrollToSignIn}
              >
                Take Attendance
              </button>
              <button
                className="btn btn-outline-invert btn-lg"
                onClick={onEnterAdmin}
              >
                Manage Members
              </button>
            </div>
          </div>
        </section>

        <section className="signin-section" id="signin">
          <div className="section-heading">
            <h2 className="section-title">Sign in to the register</h2>
            <p className="section-subtitle">
              Choose your leader profile to open today's attendance register.
            </p>
          </div>

          {(syncStatus === 'unconfigured' || showConnect) && (
            <form className="add-leader-form connect-form" onSubmit={submitConnect}>
              <h3 className="connect-title">Connect Google Sheet</h3>
              <p className="connect-subtitle">
                Paste your SheetDB API id to use a Google Sheet as the
                database for this app.
              </p>
              <div className="form-group">
                <input
                  value={sheetId}
                  onChange={(e) => setSheetId(e.target.value)}
                  placeholder="e.g. a1b2c3d4e5f6g7h8i9j0k1l2m3"
                />
              </div>
              <div className="btn-row">
                <button type="submit" className="btn btn-primary">
                  Connect
                </button>
                {syncStatus !== 'unconfigured' && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setShowConnect(false)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}

          <label className="label">I am a leader for:</label>
          {leaders.length === 0 ? (
            <p className="no-leaders landing-note">
              No leaders added yet. Sign in as Admin to add one.
            </p>
          ) : (
            <select
              className="leader-select"
              value={selectedLeaderId}
              onChange={(e) => onLeaderChange(e.target.value)}
            >
              <option value="">Select your leader profile</option>
              {leaders.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} &mdash; {l.fellowship} ({l.location || 'Lekki'})
                </option>
              ))}
            </select>
          )}

          <div className="btn-row signin-actions">
            <button
              className="btn btn-primary"
              disabled={!selectedLeaderId}
              onClick={() => onStartAttendance(leader.id)}
            >
              Take attendance
            </button>
            <button
              className="btn btn-outline"
              disabled={!selectedLeaderId}
              onClick={() => onStartReport(leader.id)}
            >
              Send report to admin
            </button>
          </div>

          <p className="signin-hint">
            Leaders can take attendance and send reports back to the admin.
            Member and leader registration is managed by the admin.
          </p>
        </section>

        <section className="features">
          <div className="section-heading">
            <h2 className="section-title">Everything the register needs</h2>
            <p className="section-subtitle">
              Tools built for {CHURCH_NAME}, serving the {CHURCH_LOCATION} community.
            </p>
          </div>
          <div className="feature-grid">
            <FeatureCard
              title="Daily attendance"
              description="Mark members present or absent and save the register for the day. Updates are kept automatically."
              image="/images/people-gathering.jpg"
            />
            <FeatureCard
              title="Member management"
              description="Add and remove members by fellowship and location across Lekki, from Phase 1 to Sangotedo."
              image="/images/lagos-skyline.jpg"
            />
            <FeatureCard
              title="Leader profiles"
              description="Each leader has their own profile so the right person takes the right register, every meeting."
              image="/images/church-community.jpg"
            />
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <p>
          {CHURCH_NAME} &middot; {CHURCH_LOCATION}
        </p>
        <p>Attendance register for our church family.</p>
      </footer>
    </div>
  )
}

function FeatureCard({ title, description, image }) {
  return (
    <div className="feature-card">
      {image && (
        <img
          src={image}
          alt={title}
          className="feature-card-image"
          loading="lazy"
        />
      )}
      <h3 className="feature-card-title">{title}</h3>
      <p className="feature-card-text">{description}</p>
    </div>
  )
}

const SYNC_LABELS = {
  synced: { text: 'Connected to Google Sheets', tone: 'ok' },
  loading: { text: 'Syncing data…', tone: 'pending' },
  offline: { text: 'Offline - changes saved locally', tone: 'warn' },
  unconfigured: { text: 'Sheet not connected yet', tone: 'warn' },
}

function SyncStatus({ status }) {
  const info = SYNC_LABELS[status] || SYNC_LABELS.unconfigured
  return (
    <span className={`sync-status sync-${info.tone}`}>
      <span className="sync-dot" />
      {info.text}
    </span>
  )
}

function AdminLogin({ onSuccess, onBack }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      onSuccess()
    } else {
      setError(true)
      setPassword('')
    }
  }

  return (
    <>
      <div className="card-title">Admin sign in</div>
      <div className="card-subtitle">
        Enter the admin password to manage the register.
      </div>
      <form onSubmit={submit}>
        <div className="form-group">
          <label htmlFor="admin-password">Admin password</label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
          />
        </div>
        {error && (
          <div className="no-leaders">Incorrect password. Try again.</div>
        )}
        <button type="submit" className="btn btn-primary btn-full">
          Sign in
        </button>
        <button type="button" className="btn mt-8 btn-full" onClick={onBack}>
          Back
        </button>
      </form>
    </>
  )
}

function AdminPanel({
  leaders,
  members,
  attendance,
  reports,
  syncStatus,
  onRefresh,
  onConnect,
  onAddLeader,
  onAddMember,
  onEditLeader,
  onEditMember,
  onRemoveLeader,
  onRemoveMember,
  onMarkReportRead,
  onReset,
  onBack,
}) {
  const [tab, setTab] = useState('leaders')
  const [showAddLeader, setShowAddLeader] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [leaderName, setLeaderName] = useState('')
  const [leaderFellowship, setLeaderFellowship] = useState('')
  const [leaderLocation, setLeaderLocation] = useState('Lekki Phase 1')
  const [leaderPhone, setLeaderPhone] = useState('')
  const [memberName, setMemberName] = useState('')
  const [memberFellowship, setMemberFellowship] = useState('')
  const [memberLocation, setMemberLocation] = useState('Lekki Phase 1')
  const [editing, setEditing] = useState(null)
  const [sheetIdInput, setSheetIdInput] = useState('')

  const today = todayKey()
  const todayEntry = attendance[today]
  const presentToday = todayEntry
    ? todayEntry.records.filter((r) => r.present).length
    : 0
  const todayTotal = todayEntry ? todayEntry.records.length : 0
  const recordDays = Object.keys(attendance).length
  const unreadReports = (reports || []).filter((r) => r.read !== 'true').length

  const submitConnect = (e) => {
    e.preventDefault()
    if (!sheetIdInput.trim()) return
    onConnect(sheetIdInput)
    setSheetIdInput('')
  }

  const submitLeader = (e) => {
    e.preventDefault()
    if (!leaderName.trim()) return
    onAddLeader({
      id: 'l' + Date.now(),
      name: leaderName.trim(),
      fellowship: leaderFellowship.trim() || 'General',
      location: leaderLocation,
      phone: leaderPhone.trim(),
      addedAt: Date.now(),
    })
    setLeaderName('')
    setLeaderFellowship('')
    setLeaderLocation('Lekki Phase 1')
    setLeaderPhone('')
    setShowAddLeader(false)
  }

  const submitMember = (e) => {
    e.preventDefault()
    if (!memberName.trim()) return
    onAddMember({
      id: 'm' + Date.now(),
      name: memberName.trim(),
      fellowship: memberFellowship.trim() || 'General',
      location: memberLocation,
    })
    setMemberName('')
    setMemberFellowship('')
    setMemberLocation('Lekki Phase 1')
    setShowAddMember(false)
  }

  const startEdit = (type, item) => {
    setEditing({
      type,
      id: item.id,
      name: item.name,
      fellowship: item.fellowship || 'General',
      location: item.location || 'Lekki Phase 1',
      phone: item.phone || '',
    })
  }

  const saveEdit = (e) => {
    e.preventDefault()
    if (!editing || !editing.name.trim()) return
    const updates = {
      name: editing.name.trim(),
      fellowship: editing.fellowship.trim() || 'General',
      location: editing.location,
    }
    if (editing.type === 'leader') {
      updates.phone = editing.phone.trim()
      onEditLeader(editing.id, updates)
    } else {
      onEditMember(editing.id, updates)
    }
    setEditing(null)
  }

  const history = useMemo(() => {
    return Object.entries(attendance)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 10)
  }, [attendance])

  const sortedReports = useMemo(() => {
    return (reports || []).slice().sort((a, b) =>
      a.id < b.id ? 1 : -1
    )
  }, [reports])

  const tabButtons = [
    { id: 'leaders', label: 'Leaders', count: leaders.length },
    { id: 'members', label: 'Members', count: members.length },
    { id: 'attendance', label: 'Attendance' },
    { id: 'reports', label: 'Reports', count: unreadReports, unread: unreadReports },
    { id: 'settings', label: 'Settings' },
  ]

  const locationOptions = () =>
    LEKKI_LOCATIONS.map((loc) => (
      <option key={loc} value={loc}>
        {loc}
      </option>
    ))

  const renderEditForm = () => (
    <form className="edit-form" onSubmit={saveEdit}>
      <div className="edit-fields">
        <input
          value={editing.name}
          onChange={(e) => setEditing({ ...editing, name: e.target.value })}
          placeholder="Full name"
        />
        <input
          value={editing.fellowship}
          onChange={(e) => setEditing({ ...editing, fellowship: e.target.value })}
          placeholder="Fellowship / group"
        />
        <select
          value={editing.location}
          onChange={(e) => setEditing({ ...editing, location: e.target.value })}
        >
          {locationOptions()}
        </select>
        {editing.type === 'leader' && (
          <input
            value={editing.phone}
            onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
            placeholder="Phone number"
            type="tel"
          />
        )}
      </div>
      <div className="btn-row">
        <button type="submit" className="btn btn-primary btn-sm">
          Save
        </button>
        <button type="button" className="btn btn-sm" onClick={() => setEditing(null)}>
          Cancel
        </button>
      </div>
    </form>
  )

  const rowActions = (type, item) => (
    <div className="member-actions">
      <button className="btn btn-sm" onClick={() => startEdit(type, item)}>
        Edit
      </button>
      <button
        className="btn btn-sm btn-remove"
        onClick={() =>
          type === 'leader' ? onRemoveLeader(item.id) : onRemoveMember(item.id)
        }
      >
        Delete
      </button>
    </div>
  )

  const renderRow = (type, item) =>
    editing && editing.type === type && editing.id === item.id ? (
      <div className="member-row edit-row" key={item.id}>
        {renderEditForm()}
      </div>
    ) : (
      <div className="member-row" key={item.id}>
        <div className="member-info">
          <span className="member-name">{item.name}</span>
          <span className="member-meta">
            {item.fellowship} <span className="pill">{item.location || 'Lekki'}</span>
            {type === 'leader' && item.phone && (
              <a className="phone-link" href={`tel:${item.phone}`}>
                &#9742; {item.phone}
              </a>
            )}
          </span>
        </div>
        {rowActions(type, item)}
      </div>
    )

  return (
    <div className="admin-panel">
      <div className="admin-head">
        <div>
          <div className="card-title">Admin dashboard</div>
          <div className="card-subtitle">Manage leaders, members and registers.</div>
        </div>
        <SyncStatus status={syncStatus} />
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{leaders.length}</div>
          <div className="stat-label">Leaders</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{members.length}</div>
          <div className="stat-label">Members</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {presentToday}
            {todayTotal > 0 && <span className="stat-suffix">/{todayTotal}</span>}
          </div>
          <div className="stat-label">Present today</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{recordDays}</div>
          <div className="stat-label">Register days</div>
        </div>
      </div>

      <div className="tab-bar">
        {tabButtons.map((t) => (
          <button
            key={t.id}
            className={'tab-btn' + (tab === t.id ? ' active' : '')}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {typeof t.count === 'number' && (
              <span className={'tab-count' + (t.unread ? ' unread' : '')}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'leaders' && (
        <div className="tab-panel">
          <div className="admin-section-title">Leaders</div>
          {leaders.length === 0 ? (
            <div className="empty-state">No leaders yet. Add the first one below.</div>
          ) : (
            <div className="roster">{leaders.map((l) => renderRow('leader', l))}</div>
          )}

          {showAddLeader ? (
            <form className="add-form" onSubmit={submitLeader}>
              <div className="form-grid">
                <input
                  value={leaderName}
                  onChange={(e) => setLeaderName(e.target.value)}
                  placeholder="Leader name"
                />
                <input
                  value={leaderFellowship}
                  onChange={(e) => setLeaderFellowship(e.target.value)}
                  placeholder="Fellowship / group"
                />
                <select
                  value={leaderLocation}
                  onChange={(e) => setLeaderLocation(e.target.value)}
                >
                  {locationOptions()}
                </select>
                <input
                  value={leaderPhone}
                  onChange={(e) => setLeaderPhone(e.target.value)}
                  placeholder="Phone number"
                  type="tel"
                />
              </div>
              <div className="btn-row">
                <button type="submit" className="btn btn-primary">
                  Add leader
                </button>
                <button type="button" className="btn" onClick={() => setShowAddLeader(false)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button className="btn btn-outline" onClick={() => setShowAddLeader(true)}>
              + Add leader
            </button>
          )}
        </div>
      )}

      {tab === 'members' && (
        <div className="tab-panel">
          <div className="admin-section-title">Members</div>
          {members.length === 0 ? (
            <div className="empty-state">No members yet. Add the first one below.</div>
          ) : (
            <div className="roster">{members.map((m) => renderRow('member', m))}</div>
          )}

          {showAddMember ? (
            <form className="add-form" onSubmit={submitMember}>
              <div className="form-grid">
                <input
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="Member name"
                />
                <input
                  value={memberFellowship}
                  onChange={(e) => setMemberFellowship(e.target.value)}
                  placeholder="Fellowship / group"
                />
                <select
                  value={memberLocation}
                  onChange={(e) => setMemberLocation(e.target.value)}
                >
                  {locationOptions()}
                </select>
              </div>
              <div className="btn-row">
                <button type="submit" className="btn btn-primary">
                  Add member
                </button>
                <button type="button" className="btn" onClick={() => setShowAddMember(false)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button className="btn btn-outline" onClick={() => setShowAddMember(true)}>
              + Add member
            </button>
          )}
        </div>
      )}

      {tab === 'attendance' && (
        <div className="tab-panel">
          <div className="admin-section-title">Recent attendance</div>
          {history.length === 0 ? (
            <div className="empty-state">No attendance recorded yet.</div>
          ) : (
            <div className="history-list">
              {history.map(([date, entry]) => {
                const presentCount = entry.records.filter((r) => r.present).length
                return (
                  <div className="history-card" key={date}>
                    <div className="history-top">
                      <span className="date">{new Date(date).toDateString()}</span>
                      <span className="count-badge">
                        {presentCount} / {entry.records.length}
                      </span>
                    </div>
                    <div className="details">
                      {presentCount} present &middot; taken by {entry.takenBy}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'reports' && (
        <div className="tab-panel">
          <div className="admin-section-title">Leader reports</div>
          <p className="panel-note">
            Reports sent by leaders are shown here. Tap "Mark read" once
            you have seen one.
          </p>
          {sortedReports.length === 0 ? (
            <div className="empty-state">No reports from leaders yet.</div>
          ) : (
            <div className="report-list">
              {sortedReports.map((r) => (
                <div
                  key={r.id}
                  className={'report-card' + (r.read === 'true' ? ' read' : '')}
                >
                  <div className="report-head">
                    <span className="report-author">
                      <span className="report-avatar">
                        {r.leaderName ? r.leaderName.charAt(0).toUpperCase() : '?'}
                      </span>
                      {r.leaderName}
                    </span>
                    {r.read !== 'true' && <span className="unread-pill">New</span>}
                  </div>
                  <p className="report-body">{r.message}</p>
                  <div className="report-foot">
                    <span className="report-date">{new Date(r.date + 'T00:00:00').toDateString()}</span>
                    {r.read !== 'true' && (
                      <button className="btn btn-sm" onClick={() => onMarkReportRead(r.id)}>
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'settings' && (
        <div className="tab-panel">
          <div className="admin-section-title">Google Sheet database</div>
          <div className="settings-box">
            <p>
              {syncStatus === 'synced'
                ? 'Connected. The app reads and writes your Google Sheet.'
                : syncStatus === 'offline'
                  ? 'Sheet is configured but could not be reached. Check the API id and your internet.'
                  : syncStatus === 'loading'
                    ? 'Syncing with your Google Sheet…'
                    : 'No sheet connected. Paste your SheetDB API id to use a Google Sheet as the database.'}
            </p>
            <form className="form-row" onSubmit={submitConnect}>
              <input
                value={sheetIdInput}
                onChange={(e) => setSheetIdInput(e.target.value)}
                placeholder="SheetDB API id"
              />
              <button type="submit" className="btn btn-primary">
                {syncStatus === 'unconfigured' ? 'Connect' : 'Update / connect'}
              </button>
            </form>
            {syncStatus === 'synced' && (
              <button className="btn btn-sm mt-8" onClick={onRefresh}>
                Refresh from sheet
              </button>
            )}
          </div>

          <div className="admin-section-title">Danger zone</div>
          <div className="btn-row">
            <button className="btn" onClick={onBack}>
              &larr; Back
            </button>
            <button className="btn btn-danger" onClick={onReset}>
              Reset all data
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function AttendanceView({ leader, members, attendance, onSave, onBack }) {
  const date = todayKey()
  const label = todayLabel()
  const existing = attendance[date]
  const [records, setRecords] = useState(() =>
    existing
      ? existing.records
      : members.map((m) => ({ memberId: m.id, present: false }))
  )

  const memberMap = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m])),
    [members]
  )

  const setPresent = (id, present) =>
    setRecords((rs) => rs.map((r) => (r.memberId === id ? { ...r, present } : r)))

  const presentCount = records.filter((r) => r.present).length
  const savedBy = existing ? existing.takenBy : null

  const submit = () => {
    onSave(date, records, leader ? leader.name : 'Unknown')
  }

  return (
    <>
      <div className="card-title">Attendance register</div>
      <div className="card-subtitle">
        {leader
          ? `${leader.name} — ${leader.fellowship} fellowship · ${leader.location || 'Lekki'}`
          : 'Register'}
      </div>
      <span className="date-badge">{label}</span>
      {existing && savedBy && (
        <div className="summary">
          Already recorded &middot; taken by {savedBy}. You can update the
          register below.
        </div>
      )}
      <div className="attendance-list">
        {records.length === 0 ? (
          <div className="no-leaders">
            No members on register yet. Ask an admin to add members.
          </div>
        ) : (
          records.map((r) => {
            const member = memberMap[r.memberId]
            return (
              <AttendanceRow
                key={r.memberId}
                name={member ? member.name : 'Unknown'}
                fellowship={member ? member.fellowship : ''}
                location={member ? member.location : ''}
                present={r.present}
                onToggle={() => setPresent(r.memberId, !r.present)}
              />
            )
          })
        )}
      </div>
      <div className="summary">
        {presentCount} of {records.length} present
      </div>
      <div className="btn-row">
        <button className="btn btn-primary" disabled={records.length === 0} onClick={submit}>
          Save register
        </button>
        <button className="btn" onClick={onBack}>
          Back
        </button>
      </div>
    </>
  )
}

function AttendanceRow({ name, fellowship, location, present, onToggle }) {
  return (
    <div className="attendance-row">
      <div>
        <div className="name">{name}</div>
        <div className="no-leaders">
          {fellowship}
          {location ? ` · ${location}` : ''}
        </div>
      </div>
      <button
        className={
          'toggle-btn ' + (present ? 'active-present' : 'active-absent')
        }
        onClick={onToggle}
      >
        {present ? 'Present' : 'Absent'}
      </button>
    </div>
  )
}