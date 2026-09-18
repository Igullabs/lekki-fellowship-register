// Pure helpers for analytics and member insights.

export function isTruthy(value) {
  return (
    value === true ||
    value === 'true' ||
    value === 'TRUE' ||
    value === '1' ||
    value === 1
  )
}

export function sessionDates(attendance) {
  return Object.keys(attendance || {}).sort()
}

export function memberStats(members, attendance) {
  const dates = sessionDates(attendance)
  const byId = {}
  for (const m of members || []) {
    const name = (m && m.name) || 'Unknown'
    let attended = 0
    let lastPresent = null
    for (const d of dates) {
      const entry = attendance[d] || {}
      const rec = (entry.records || []).find((r) => r.memberId === m.id)
      if (rec && isTruthy(rec.present)) {
        attended++
        lastPresent = d
      }
    }
    const sessions = dates.length
    const lastIdx = lastPresent === null ? -1 : dates.indexOf(lastPresent)
    const absentWeeks =
      lastPresent === null ? sessions : sessions - 1 - lastIdx
    let streak = 0
    if (lastPresent !== null) {
      for (let i = dates.length - 1; i >= 0; i--) {
        const entry = attendance[dates[i]] || {}
        const rec = (entry.records || []).find((r) => r.memberId === m.id)
        if (rec && isTruthy(rec.present)) streak++
        else break
      }
    }
    byId[m.id] = {
      id: m.id,
      name,
      fellowship: m.fellowship || 'General',
      location: m.location || 'Lekki',
      attended,
      sessions,
      streak,
      absentWeeks,
      lastPresent,
    }
  }
  return byId
}

export function attendanceLabel(st) {
  if (!st || !st.sessions) return 'No sessions yet'
  if (st.attended === 0) return 'Not attended'
  if (st.attended === 1) return 'First visit'
  if (st.attended <= 3) return 'New attendee'
  const ratio = st.attended / st.sessions
  return ratio >= 0.6 ? 'Regular' : 'Occasional'
}

export function fellowshipStats(members, stats) {
  const groups = {}
  for (const m of members || []) {
    const key = m.fellowship || 'General'
    groups[key] = groups[key] || { fellowship: key, total: 0, attended: 0 }
    groups[key].total++
    const st = stats[m.id]
    if (st && st.attended > 0) groups[key].attended++
  }
  return Object.values(groups)
}

export function trendSeries(attendance, n = 12) {
  const dates = sessionDates(attendance).slice(-n)
  return dates.map((d) => {
    const entry = attendance[d] || {}
    const total = (entry.records || []).length
    const present = (entry.records || []).filter((r) => isTruthy(r.present)).length
    return {
      date: d,
      present,
      total,
      pct: total ? Math.round((present / total) * 100) : 0,
    }
  })
}