// D34: the running popup's sentence stays an editable field for GRACE_MS after the session
// starts, then locks to plain text. Pure — no chrome.*, no Date.now() — so popup.js's DOM
// branch is testable without a DOM: it just passes real values through.
export function isEditable(now, startedAt, graceMs) {
  return now - startedAt < graceMs
}
