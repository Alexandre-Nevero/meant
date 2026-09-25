// #21. post() (api.js:33) queues silently on a failed fetch — nothing told the user their
// work might not be recorded. This turns the raw queue array into the one line the popup
// shows for it. Pure: no chrome.* here, so it's unit-testable without a browser.
export function queueStatusMessage(queue) {
  const count = Array.isArray(queue) ? queue.length : 0
  if (count === 0) return null
  return count === 1
    ? '1 update is waiting. It will send next time MEANT reaches the app.'
    : `${count} updates are waiting. They will send next time MEANT reaches the app.`
}
