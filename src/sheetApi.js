// Google Sheets bridge via SheetDB (https://sheetdb.io)
//
// This deployment is attached to a spreadsheet by default (DEFAULT_SHEET_ID
// below). To point the app at a different spreadsheet, create a Google Sheet,
// add tabs named exactly "leaders", "members" and "attendance", create an API
// at https://sheetdb.io/dashboard for it, then paste the API id into the app's
// "Google Sheet database" box in the Admin panel (saved per browser).
//
// Sheet columns (Google Sheet tabs must have these exact headers):
//  leaders   : id | name | fellowship | location | phone | addedAt
//  members   : id | name | fellowship | location
//  attendance: date | memberId | present | takenBy
//  reports   : id | date | leaderId | leaderName | message | read
//  messages  : id | date | fromRole | fromName | to | message | read
//              (to is 'admin', a leader id, or 'all' for a broadcast)
//  notes     : id | memberId | note | date | by

export const SHEET_NAMES = {
  leaders: 'leaders',
  members: 'members',
  attendance: 'attendance',
  reports: 'reports',
  messages: 'messages',
  notes: 'notes',
}

const STORAGE_KEY = 'lekki_sheetdb_id'
// Default spreadsheet attached to this deployment. The in-app "Connect
// Google Sheet" box can override it per browser.
const DEFAULT_SHEET_ID = 'c80ktq1fvhr2b'

export function getSheetId() {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_SHEET_ID
  } catch (e) {
    return DEFAULT_SHEET_ID
  }
}

export function configureSheet(id) {
  const cleaned = (id || '').trim().replace(/\/+$/, '')
  const match = cleaned.match(/\/api\/v1\/([A-Za-z0-9]+)/)
  const finalId = match ? match[1] : cleaned
  try {
    localStorage.setItem(STORAGE_KEY, finalId)
  } catch (e) {
    // ignore storage failures
  }
  return finalId
}

export function isSheetConfigured() {
  return Boolean(getSheetId())
}

function baseUrl() {
  return `https://sheetdb.io/api/v1/${getSheetId()}`
}

async function request(path, options = {}) {
  const res = await fetch(`${baseUrl()}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    throw new Error(`Sheet sync failed (${res.status})`)
  }
  return res.json()
}

export async function fetchRows(sheet) {
  return request(`?sheet=${sheet}`)
}

export async function safeFetchRows(sheet) {
  try {
    return await fetchRows(sheet)
  } catch (e) {
    return []
  }
}

export async function addRows(sheet, rows) {
  return request(`?sheet=${sheet}`, {
    method: 'POST',
    body: JSON.stringify({ data: rows }),
  })
}

export async function updateRows(sheet, column, value, data) {
  // SheetDB free plan does not support PATCH/PUT with any path form. Emulate
  // an update by deleting the matching row and re-inserting the complete
  // replacement row (data must be the full row, not a partial update).
  try {
    await deleteRows(sheet, { [column]: value })
  } catch (e) {
    // row may not exist in the sheet yet; the insert below still applies
  }
  await addRows(sheet, [data])
}

export async function deleteRows(sheet, criteria) {
  const entry = Object.entries(criteria)[0]
  if (!entry) throw new Error('deleteRows requires at least one criterion')
  const [column, value] = entry
  return request(
    `/${encodeURIComponent(column)}/${encodeURIComponent(value)}?sheet=${sheet}`,
    { method: 'DELETE' }
  )
}

export async function deleteAllRows(sheet) {
  return request(`/all?sheet=${sheet}`, { method: 'DELETE' })
}

// Replays a queued, offline-saved operation against the sheet. Op kinds:
//  add          : { kind, sheet, rows }
//  deleteRows   : { kind, sheet, criteria }
//  deleteAll    : { kind, sheet }
//  replace      : { kind, sheet, column, value, data }  (full-row update)
//  attendance   : { kind, date, records, takenBy }
export async function replayPendingOp(op) {
  switch (op.kind) {
    case 'add':
      await addRows(op.sheet, op.rows)
      break
    case 'deleteRows':
      await deleteRows(op.sheet, op.criteria)
      break
    case 'deleteAll':
      await deleteAllRows(op.sheet)
      break
    case 'replace':
      await updateRows(op.sheet, op.column, op.value, op.data)
      break
    case 'attendance':
      await deleteRows(SHEET_NAMES.attendance, { date: op.date })
      await addRows(
        SHEET_NAMES.attendance,
        op.records.map((r) => ({
          date: op.date,
          memberId: r.memberId,
          present: r.present ? 'true' : 'false',
          takenBy: op.takenBy,
        }))
      )
      break
    default:
      throw new Error('Unknown pending op: ' + op.kind)
  }
}