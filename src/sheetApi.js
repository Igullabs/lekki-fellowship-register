// Google Sheets bridge via SheetDB (https://sheetdb.io)
//
// How to connect (done once, from the app's admin panel or manually):
//  1. Create a Google Sheet at https://sheets.new
//  2. Add three tabs named exactly: "leaders", "members", "attendance"
//     with the headers described below.
//  3. At https://sheetdb.io/dashboard create an API from that sheet URL
//     and follow SheetDB's Google share step (Edit access).
//  4. Copy the API id (the part after /api/v1/) into the app's
//     "Connect Google Sheet" box. It is saved on this browser, so the
//     whole app reads/writes that spreadsheet.
//
// Sheet columns:
//  leaders   : id | name | fellowship | location | addedAt
//  members   : id | name | fellowship | location
//  attendance: date | memberId | present | takenBy

export const SHEET_NAMES = {
  leaders: 'leaders',
  members: 'members',
  attendance: 'attendance',
}

const STORAGE_KEY = 'lekki_sheetdb_id'

export function getSheetId() {
  try {
    return localStorage.getItem(STORAGE_KEY) || ''
  } catch (e) {
    return ''
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

export async function addRows(sheet, rows) {
  return request(`?sheet=${sheet}`, {
    method: 'POST',
    body: JSON.stringify({ data: rows }),
  })
}

export async function deleteRows(sheet, criteria) {
  return request(`/q?sheet=${sheet}`, {
    method: 'DELETE',
    body: JSON.stringify({ q: criteria }),
  })
}

export async function deleteAllRows(sheet) {
  return request(`/all?sheet=${sheet}`, { method: 'DELETE' })
}