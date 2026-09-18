import { useMemo } from 'react'
import {
  memberStats,
  fellowshipStats,
  trendSeries,
  attendanceLabel,
} from '../stats'

export default function AnalyticsView({ members, attendance }) {
  const stats = useMemo(
    () => memberStats(members, attendance),
    [members, attendance]
  )
  const trend = useMemo(
    () => trendSeries(attendance, 12),
    [attendance]
  )
  const fellowships = useMemo(
    () => fellowshipStats(members, stats),
    [members, stats]
  )
  const all = useMemo(() => Object.values(stats), [stats])

  const maxPct = trend.length ? Math.max(...trend.map((t) => t.pct), 10) : 10

  const absentCount = Math.min(3, trend.length)
  const followUps =
    absentCount >= 3
      ? all
          .filter((s) => s.sessions >= absentCount && s.absentWeeks >= absentCount)
          .sort((a, b) => b.absentWeeks - a.absentWeeks)
      : []

  const neverAttended = all
    .filter((s) => s.attended === 0)
    .sort((a, b) => (a.name < b.name ? -1 : 1))

  return (
    <div className="analytics">
      <div className="admin-section-title">Attendance trend</div>
      {trend.length === 0 ? (
        <div className="empty-state">
          No attendance recorded yet. Trends appear after you save a register.
        </div>
      ) : (
        <div className="trend-chart">
          {trend.map((t) => (
            <div className="trend-col" key={t.date}>
              <div className="trend-value">{t.pct}%</div>
              <div className="trend-bar-wrap">
                <div
                  className="trend-bar"
                  style={{ height: Math.max(6, Math.round((t.pct / maxPct) * 120)) + 'px' }}
                />
              </div>
              <div className="trend-label">
                {t.date.slice(8)}/{t.date.slice(5, 7)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="admin-section-title">Follow-up: absent 3+ weeks</div>
      {followUps.length === 0 ? (
        <div className="empty-state">
          {trend.length < 3
            ? 'Follow-up lists appear after 3+ meetings are tracked.'
            : 'No one has missed the last ' + absentCount + ' meetings. Great job!'}
        </div>
      ) : (
        <div className="followup-list">
          {followUps.map((s) => (
            <div className="followup-row" key={s.id}>
              <span className="followup-name">
                {s.name}
                <span className="pill">{s.fellowship}</span>
              </span>
              <span className="followup-meta">
                {s.attended === 0
                  ? 'Never attended'
                  : 'Last seen ' + (s.lastPresent || 'never')}
              </span>
              <span className="followup-badge">
                {s.attended === 0
                  ? `${s.sessions} meetings`
                  : `${s.absentWeeks} weeks absent`}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="stat-grid mini">
        <div className="stat-card">
          <div className="stat-value">{neverAttended.length}</div>
          <div className="stat-label">Never attended</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {all.filter((s) => s.attended === 1).length}
          </div>
          <div className="stat-label">First-timers</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {all.filter((s) => attendanceLabel(s) === 'Regular').length}
          </div>
          <div className="stat-label">Regulars</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{trend.length}</div>
          <div className="stat-label">Meetings tracked</div>
        </div>
      </div>

      <div className="admin-section-title">By fellowship</div>
      {fellowships.length === 0 ? (
        <div className="empty-state">No members yet.</div>
      ) : (
        <div className="fellow-table">
          <div className="fellow-head">
            <span>Fellowship</span>
            <span>Members</span>
            <span>Have attended</span>
          </div>
          {fellowships.map((f) => (
            <div className="fellow-row" key={f.fellowship}>
              <span className="fellow-name">{f.fellowship}</span>
              <span className="fellow-num">{f.total}</span>
              <span className="fellow-num">
                {f.attended}
                <span className="fellow-sub">
                  {' '}
                  ({f.total ? Math.round((f.attended / f.total) * 100) : 0}%)
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="admin-section-title">Member attendance</div>
      {all.length === 0 ? (
        <div className="empty-state">No members to analyse.</div>
      ) : (
        <div className="followup-list">
          {all
            .slice()
            .sort((a, b) => b.streak - a.streak || b.attended - a.attended)
            .slice(0, 8)
            .map((s) => (
              <div className="followup-row" key={s.id}>
                <span className="followup-name">
                  {s.name}
                  <span className="pill">{s.fellowship}</span>
                </span>
                <span className="followup-meta">
                  {s.attended}/{s.sessions} attended
                  {s.streak > 1 ? ` · streak ${s.streak}` : ''}
                </span>
                <span className="followup-badge">{attendanceLabel(s)}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}