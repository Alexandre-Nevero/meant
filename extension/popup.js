import { post, apiBase } from './api.js'

const root = document.getElementById('root')

function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function show(...nodes) {
  root.replaceChildren(...nodes)
}

/** A single-select row of chips. Returns { row, get value() }. */
function chipGroup(options, { mono = false } = {}) {
  const row = el('div', 'm-chip-row')
  let value = options[0].value
  const buttons = options.map(({ label, value: v }) => {
    const chip = el('button', 'm-chip', label)
    chip.type = 'button'
    chip.dataset.mono = String(mono)
    chip.setAttribute('aria-pressed', String(v === value))
    chip.addEventListener('click', () => {
      value = v
      for (const b of buttons) b.setAttribute('aria-pressed', String(b === chip))
    })
    row.append(chip)
    return chip
  })
  return { row, get value() { return value } }
}

function unpaired(message) {
  const mark = el('p', 'm-mark', '')
  mark.dataset.state = 'idle'

  const field = el('input', 'm-field')
  field.placeholder = 'PAIRING CODE'
  field.maxLength = 6
  field.dataset.pairingCode = 'true'
  field.addEventListener('input', () => {
    field.value = field.value.toUpperCase()
  })
  field.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') claim(field.value)
  })

  const button = el('button', 'm-btn', 'Pair')
  button.dataset.variant = 'primary'
  button.addEventListener('click', () => claim(field.value))

  const link = el('button', 'm-btn', 'Get a code')
  link.dataset.variant = 'quiet'
  link.addEventListener('click', async () => {
    chrome.tabs.create({ url: (await apiBase()) + '/pair' })
  })

  const nodes = [mark, el('p', 'm-meta', 'Connect this browser to your account.')]
  if (message) nodes.push(el('p', 'm-meta', message))
  nodes.push(field, button, link)
  show(...nodes)
}

async function claim(value) {
  const code = value.trim().toUpperCase()
  if (code.length !== 6) return unpaired('A code is six characters.')

  const res = await post('/api/pair/claim', { code }, { queue: false })
  if (res.offline) return unpaired('No connection. Try again when you are back online.')
  if (!res.ok || !res.data?.token) return unpaired('That code is wrong, expired, or already used.')

  await chrome.storage.local.set({ token: res.data.token, deviceId: res.data.deviceId })
  render()
}

function idle() {
  const mark = el('p', 'm-mark', '')
  mark.dataset.state = 'idle'

  const label = el('p', 'm-meta', 'What do you mean to do?')

  const field = el('input', 'm-field')
  field.placeholder = ''

  const duration = chipGroup(
    [{ label: '25 min', value: '25' }, { label: '50 min', value: '50' }, { label: 'until I stop', value: '' }],
    { mono: true },
  )
  const blocklist = chipGroup([{ label: 'social', value: 'social' }, { label: 'video', value: 'video' }, { label: 'news', value: 'news' }])

  const start = el('button', 'm-btn', 'Start')
  start.dataset.variant = 'primary'
  start.addEventListener('click', async () => {
    start.disabled = true
    const res = await chrome.runtime.sendMessage({
      type: 'start',
      intention: field.value,
      plannedMinutes: duration.value ? Number(duration.value) : null,
      blocklist: [blocklist.value],
    })
    if (!res?.ok) {
      start.disabled = false
      show(mark, label, field, duration.row, blocklist.row, start,
        el('p', 'm-meta', res?.offline ? 'No connection. A session needs one to start.' : 'Could not start.'))
      return
    }
    render()
  })

  show(mark, label, field, duration.row, blocklist.row, start)
}

function running(session) {
  const mark = el('p', 'm-mark', '')
  mark.dataset.state = 'running'

  const elapsedMinutes = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 60000)
  const elapsed = el('p', 'm-meta', `${elapsedMinutes} min elapsed`)

  const stop = el('button', 'm-btn', 'Stop')
  stop.dataset.variant = 'quiet'
  stop.addEventListener('click', async () => {
    stop.disabled = true
    await chrome.runtime.sendMessage({ type: 'stop' })
    render()
  })

  show(mark, el('p', 'm-sentence', session.intention), elapsed, stop)
}

async function render() {
  const { token, session, unpairedReason } = await chrome.storage.local.get(['token', 'session', 'unpairedReason'])
  if (!token) {
    if (unpairedReason) await chrome.storage.local.remove('unpairedReason')
    return unpaired(unpairedReason)
  }
  if (session) return running(session)
  idle()
}

render()
