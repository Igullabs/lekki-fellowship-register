import { useEffect, useMemo, useState } from 'react'

const STORAGE_KEYS = {
  leaders: 'lekki_fellowship_leaders',
  members: 'lekki_fellowship_members',
  attendance: 'lekki_fellowship_attendance',
}

const ADMIN_PASSWORD = 'admin'

const CHURCH_NAME = 'Lekki Fellowship'
const CHURCH_LOCATION = 'Lekki, Lagos State'

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
      addedAt: Date.now(),
    },
    {
      id: 'l2',
      name: 'Sarah Okafor',
      fellowship: 'Singles',
      location: 'Ajah',
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
})

function normalize(state) {
  return {
    leaders: (state.leaders || []).map((l) => ({
      location: 'Lekki',
      ...l,
    })),
    members: (state.members || []).map((m) => ({
      location: 'Lekki',
      ...m,
    })),
    attendance: state.attendance || {},
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem('lekki_fellowship_state')
    if (raw) return normalize(JSON.parse(raw))
  } catch (e) {
    // ignore corrupt storage and use seed
  }
  const state = seed()
  try {
    localStorage.setItem('lekki_fellowship_state', JSON.stringify(state))
  } catch (e) {
    // ignore storage failures
  }
  return state
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
  const [state, setState] = useState(loadState)
  const [view, setView] = useState('landing')
  const [selectedLeaderId, setSelectedLeaderId] = useState('')

  useEffect(() => {
    try {
      localStorage.setItem('lekki_fellowship_state', JSON.stringify(state))
    } catch (e) {
      // ignore storage failures
    }
  }, [state])

  const { leaders, members, attendance } = state

  const addLeader = (leader) =>
    setState((s) => ({ ...s, leaders: [...s.leaders, leader] }))

  const addMember = (member) =>
    setState((s) => ({ ...s, members: [...s.members, member] }))

  const removeMember = (id) =>
    setState((s) => ({
      ...s,
      members: s.members.filter((m) => m.id !== id),
    }))

  const saveAttendance = (date, records, takenBy) =>
    setState((s) => ({
      ...s,
      attendance: { ...s.attendance, [date]: { records, takenBy } },
    }))

  const resetApp = () => {
    const fresh = seed()
    setState(fresh)
    setView('landing')
    setSelectedLeaderId('')
  }

  if (view === 'landing') {
    return (
      <Landing
        leaders={leaders}
        members={members}
        attendance={attendance}
        selectedLeaderId={selectedLeaderId}
        onLeaderChange={setSelectedLeaderId}
        onAddLeader={addLeader}
        onEnterAdmin={() => setView('admin-login')}
        onStartAttendance={(id) => {
          setSelectedLeaderId(id)
          setView('attendance')
        }}
      />
    )
  }

  return (
    <div className="app-container">
      <div className="card">
        {view === 'admin-login' && (
          <AdminLogin
            onSuccess={() => setView('admin')}
            onBack={() => setView('landing')}
          />
        )}
        {view === 'admin' && (
          <AdminPanel
            leaders={leaders}
            members={members}
            attendance={attendance}
            onAddLeader={addLeader}
            onAddMember={addMember}
            onRemoveMember={removeMember}
            onReset={resetApp}
            onBack={() => setView('landing')}
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
      </div>
    </div>
  )
}

function Landing({
  leaders,
  members,
  attendance,
  selectedLeaderId,
  onLeaderChange,
  onAddLeader,
  onEnterAdmin,
  onStartAttendance,
}) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [name, setName] = useState('')
  const [fellowship, setFellowship] = useState('')
  const [location, setLocation] = useState('Lekki Phase 1')

  const submitLeader = (e) => {
    e.preventDefault()
    if (!name.trim() || !fellowship.trim()) return
    onAddLeader({
      id: 'l' + Date.now(),
      name: name.trim(),
      fellowship: fellowship.trim(),
      location,
      addedAt: Date.now(),
    })
    setName('')
    setFellowship('')
    setLocation('Lekki Phase 1')
    setShowAddForm(false)
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
          <button className="btn btn-outline" onClick={onEnterAdmin}>
            Enter as Admin
          </button>
        </div>
      </header>

      <main>
        <section className="hero">
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
              Open attendance register
            </button>
            <button
              className="btn btn-outline"
              onClick={() => setShowAddForm((v) => !v)}
            >
              + Add myself as a leader
            </button>
          </div>

          {showAddForm && (
            <form className="add-leader-form mt-8" onSubmit={submitLeader}>
              <div className="form-group">
                <label htmlFor="leader-name">Your name</label>
                <input
                  id="leader-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ade Johnson"
                />
              </div>
              <div className="form-group">
                <label htmlFor="leader-fellowship">Fellowship / group</label>
                <input
                  id="leader-fellowship"
                  value={fellowship}
                  onChange={(e) => setFellowship(e.target.value)}
                  placeholder="e.g. Teens"
                />
              </div>
              <div className="form-group">
                <label htmlFor="leader-location">Location (Lekki, Lagos)</label>
                <select
                  id="leader-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                >
                  {LEKKI_LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn btn-primary btn-full">
                Save leader
              </button>
            </form>
          )}
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
            />
            <FeatureCard
              title="Member management"
              description="Add and remove members by fellowship and location across Lekki, from Phase 1 to Sangotedo."
            />
            <FeatureCard
              title="Leader profiles"
              description="Each leader has their own profile so the right person takes the right register, every meeting."
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

function FeatureCard({ title, description }) {
  return (
    <div className="feature-card">
      <div className="feature-card-dot" />
      <h3 className="feature-card-title">{title}</h3>
      <p className="feature-card-text">{description}</p>
    </div>
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
  onAddLeader,
  onAddMember,
  onRemoveMember,
  onReset,
  onBack,
}) {
  const [leaderName, setLeaderName] = useState('')
  const [leaderFellowship, setLeaderFellowship] = useState('')
  const [leaderLocation, setLeaderLocation] = useState('Lekki Phase 1')
  const [memberName, setMemberName] = useState('')
  const [memberFellowship, setMemberFellowship] = useState('')
  const [memberLocation, setMemberLocation] = useState('Lekki Phase 1')

  const submitLeader = (e) => {
    e.preventDefault()
    if (!leaderName.trim()) return
    onAddLeader({
      id: 'l' + Date.now(),
      name: leaderName.trim(),
      fellowship: leaderFellowship.trim() || 'General',
      location: leaderLocation,
      addedAt: Date.now(),
    })
    setLeaderName('')
    setLeaderFellowship('')
    setLeaderLocation('Lekki Phase 1')
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
  }

  const history = useMemo(() => {
    return Object.entries(attendance)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 10)
  }, [attendance])

  return (
    <div className="admin-panel">
      <div className="card-title">Admin dashboard</div>
      <div className="card-subtitle">Manage leaders, members and registers.</div>

      <div className="admin-section-title">Leaders</div>
      {leaders.length === 0 ? (
        <div className="no-leaders mb-16">No leaders yet.</div>
      ) : (
        <div className="member-list">
          {leaders.map((l) => (
            <div className="member-row" key={l.id}>
              <span>
                {l.name}{' '}
                <em className="no-leaders">
                  {l.fellowship} &middot; {l.location || 'Lekki'}
                </em>
              </span>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={submitLeader}>
        <div className="form-group">
          <input
            value={leaderName}
            onChange={(e) => setLeaderName(e.target.value)}
            placeholder="Leader name"
          />
        </div>
        <div className="form-group">
          <input
            value={leaderFellowship}
            onChange={(e) => setLeaderFellowship(e.target.value)}
            placeholder="Fellowship / group"
          />
        </div>
        <div className="form-group">
          <select
            value={leaderLocation}
            onChange={(e) => setLeaderLocation(e.target.value)}
          >
            {LEKKI_LOCATIONS.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary btn-full mb-16">
          Add leader
        </button>
      </form>

      <div className="divider" />

      <div className="admin-section-title">Members</div>
      <div className="member-list">
        {members.length === 0 ? (
          <div className="member-row no-leaders">No members yet.</div>
        ) : (
          members.map((m) => (
            <div className="member-row" key={m.id}>
              <span>
                {m.name}{' '}
                <em className="no-leaders">
                  {m.fellowship} &middot; {m.location || 'Lekki'}
                </em>
              </span>
              <button
                className="remove-btn"
                onClick={() => onRemoveMember(m.id)}
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
      <form onSubmit={submitMember}>
        <div className="form-group">
          <input
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            placeholder="Member name"
          />
        </div>
        <div className="form-group">
          <input
            value={memberFellowship}
            onChange={(e) => setMemberFellowship(e.target.value)}
            placeholder="Fellowship / group"
          />
        </div>
        <div className="form-group">
          <select
            value={memberLocation}
            onChange={(e) => setMemberLocation(e.target.value)}
          >
            {LEKKI_LOCATIONS.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary btn-full mb-16">
          Add member
        </button>
      </form>

      <div className="divider" />

      <div className="admin-section-title">Recent attendance</div>
      {history.length === 0 ? (
        <div className="no-leaders mb-16">No attendance recorded yet.</div>
      ) : (
        <div className="mb-16">
          {history.map(([date, entry]) => {
            const presentCount = entry.records.filter((r) => r.present).length
            return (
              <div className="history-card" key={date}>
                <div className="date">{new Date(date).toDateString()}</div>
                <div className="details">
                  {presentCount} of {entry.records.length} present &middot;{' '}
                  taken by {entry.takenBy}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="btn-row">
        <button className="btn" onClick={onBack}>
          Back
        </button>
        <button className="btn btn-danger" onClick={onReset}>
          Reset all data
        </button>
      </div>
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
          ? `${leader.name} — ${leader.fellowship} fellowship · ${leader.location || 'Lekki'}`
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