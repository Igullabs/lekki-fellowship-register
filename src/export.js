// Helpers for exporting data as CSV / JSON.

function esc(v) {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

function rowsToCSV(rows) {
  if (!rows || !rows.length) return ''
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  const lines = [cols.map(esc).join(',')]
  for (const r of rows) lines.push(cols.map((c) => esc(r[c])).join(','))
  return lines.join('\n')
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadText(filename, text, mime = 'text/plain') {
  triggerDownload(new Blob([text], { type: mime }), filename)
}

export function downloadCSV(filename, rows) {
  downloadText(filename, rowsToCSV(rows), 'text/csv;charset=utf-8;')
}

export function downloadJSON(filename, data) {
  downloadText(filename, JSON.stringify(data, null, 2), 'application/json')
}
