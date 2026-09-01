import { post } from './api.js'

const root = document.getElementById('root')
const domain = new URLSearchParams(location.search).get('d')

function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function remainingText(session) {
  const elapsedMs = Date.now() - new Date(session.startedAt).getTime()
  if (session.plannedMinutes == null) {
    return `${Math.floor(elapsedMs / 60000)} minutes in`
  }
  const leftMs = Math.max(0, session.plannedMinutes * 60000 - elapsedMs)
  return `${Math.ceil(leftMs / 60000)} minutes left`
}

// A single read, not a ticking clock — toolkit §9 refuses "a countdown that ticks."
async function render() {
  const { session } = await chrome.storage.local.get('session')
  if (!session) {
    root.replaceChildren(el('p', 'm-meta', 'No session is running.'))
    return
  }
  root.replaceChildren(
    el('p', 'm-sentence', session.intention),
    el('p', 'm-meta', "That's still true."),
    el('p', 'm-row-figure', remainingText(session)),
  )
}

async function recordHit() {
  const { session } = await chrome.storage.local.get('session')
  if (!session || !domain) return
  await post('/api/events', {
    sessionId: session.sessionId,
    events: [{ kind: 'block_hit', domain, seconds: null, at: new Date().toISOString() }],
  })
}

render()
recordHit()
