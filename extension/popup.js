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
  if (!res.ok) return unpaired('That code is wrong, expired, or already used.')

  await chrome.storage.local.set({ token: res.data.token, deviceId: res.data.deviceId })
  render()
}

function idle() {
  show(
    el('p', 'm-mark', ''),
    el('p', 'm-meta', 'Paired. Declaring an intention arrives in the next step.'),
  )
  root.firstChild.dataset.state = 'idle'
}

function running(session) {
  show(
    el('p', 'm-sentence', session.intention),
    el('p', 'm-meta', `Started ${new Date(session.startedAt).toLocaleTimeString()}`),
  )
}

async function render() {
  const { token, session } = await chrome.storage.local.get(['token', 'session'])
  if (!token) return unpaired()
  if (session) return running(session)
  idle()
}

render()
