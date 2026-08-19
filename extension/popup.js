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

function unpaired(message) {
  const field = el('input', 'm-field')
  field.placeholder = 'Pairing code'
  field.maxLength = 6

  const button = el('button', 'm-btn', 'Pair')
  button.dataset.variant = 'primary'
  button.addEventListener('click', () => claim(field.value))

  const link = el('button', 'm-btn', 'Get a code')
  link.dataset.variant = 'quiet'
  link.addEventListener('click', async () => {
    chrome.tabs.create({ url: (await apiBase()) + '/pair' })
  })

  const nodes = [el('p', 'm-meta', 'Connect this browser to your account.'), field, button, link]
  if (message) nodes.push(el('p', 'm-meta', message))
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
  const field = el('input', 'm-field')
  field.placeholder = 'What will you finish?'

  const duration = el('select', 'm-field')
  for (const [label, value] of [['25 minutes', '25'], ['50 minutes', '50'], ['Until I stop', '']]) {
    const option = el('option', null, label)
    option.value = value
    duration.append(option)
  }

  const list = el('select', 'm-field')
  for (const name of ['social', 'video', 'news']) {
    const option = el('option', null, name)
    option.value = name
    list.append(option)
  }

  const start = el('button', 'm-btn', 'Start')
  start.dataset.variant = 'primary'
  start.addEventListener('click', async () => {
    start.disabled = true
    const res = await chrome.runtime.sendMessage({
      type: 'start',
      intention: field.value,
      plannedMinutes: duration.value ? Number(duration.value) : null,
      blocklist: list.value,
    })
    if (!res?.ok) {
      start.disabled = false
      show(...idleNodes(field, duration, list, start),
        el('p', 'm-meta', res?.offline ? 'No connection. A session needs one to start.' : 'Could not start.'))
      return
    }
    render()
  })

  show(...idleNodes(field, duration, list, start))
}

function idleNodes(field, duration, list, start) {
  const mark = el('p', 'm-mark', '')
  mark.dataset.state = 'idle'
  return [mark, field, duration, list, start]
}

function running(session) {
  const mark = el('p', 'm-mark', '')
  mark.dataset.state = 'running'

  const elapsed = el('p', 'm-meta', '')
  const paint = () => {
    const minutes = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 60000)
    elapsed.textContent = `${minutes} min elapsed`
  }
  paint()
  setInterval(paint, 1000)

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
  const { token, session } = await chrome.storage.local.get(['token', 'session'])
  if (!token) return unpaired()
  if (session) return running(session)
  idle()
}

render()
