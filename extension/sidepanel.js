const root = document.getElementById('root')
let capsule = null
let currentSessionId = null

function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function gaze(state) {
  capsule = el('div', 'm-companion-capsule')
  capsule.dataset.state = state
  const gazeInner = el('div', 'm-companion-gaze')
  gazeInner.append(el('div', 'm-companion-aperture'))
  capsule.append(gazeInner)
  return capsule
}

function disclosure() {
  const button = el('button', 'm-companion-disclosure', 'what this reads')
  const text = el(
    'p',
    'm-meta',
    'It reads the site name of the tab you are on, to notice when it stops matching what you said you would do. It keeps the site name and nothing else — no page text, no title, no log.',
  )
  text.hidden = true
  button.addEventListener('click', () => {
    text.hidden = !text.hidden
    button.textContent = text.hidden ? 'what this reads' : 'hide'
  })
  return [button, text]
}

// Full re-render only when the session itself changes — it replaces the capsule node,
// which would snap a transition instead of playing it. A companionState-only change
// (the common case, many times a session) mutates the existing node's attribute so
// the CSS transition actually has a "from" state to animate from.
async function render() {
  const { session, companionState } = await chrome.storage.local.get(['session', 'companionState'])
  if (!session) {
    currentSessionId = null
    capsule = null
    root.replaceChildren(el('p', 'm-meta', 'No session is running.'))
    return
  }

  const nodes = [gaze(companionState ?? 'settled')]
  if (session.intention) nodes.push(el('p', 'm-sentence', session.intention))
  nodes.push(el('p', 'm-meta', 'reading this tab'))
  nodes.push(...disclosure())
  root.replaceChildren(...nodes)
  currentSessionId = session.sessionId
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return
  if (changes.session) return render()
  if (changes.companionState && capsule && currentSessionId) {
    capsule.dataset.state = changes.companionState.newValue ?? 'settled'
  }
})

render()
