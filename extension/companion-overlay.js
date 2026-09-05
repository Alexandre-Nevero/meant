// The companion, floating on the page instead of docked in a side panel — present
// only while a session is running, draggable, and gone the instant the session ends.
// Runs on <all_urls> (content_scripts), so it's a Shadow DOM: an arbitrary host page's
// own CSS must never leak in, and this widget's styles must never leak out onto the
// page. Token values are redeclared on :host rather than read from design/tokens.css,
// because :root on the host page has no MEANT tokens to inherit from.

const DEFAULT_POSITION = { right: 24, bottom: 24 }
const SIZE = 104

let hostEl = null
let shadow = null
let capsule = null
let dragState = null

function css() {
  return `
    :host {
      --m-ground: #F3F1EE;
      --m-ink: #14120F;
      --m-clay: #C75B39;
      --m-r-panel: 20px;
      --m-stroke: 1.5px;
      --m-stroke-loud: 2px;
      --m-ease: cubic-bezier(0.23, 1, 0.32, 1);
      --m-dur-rise: 280ms;
      all: initial;
      position: fixed;
      z-index: 2147483647;
      width: ${SIZE}px;
      height: ${SIZE}px;
    }
    @media (prefers-color-scheme: dark) {
      :host { --m-ground: #14120F; --m-ink: #F3F1EE; --m-clay: #E06B44; }
    }
    * { box-sizing: border-box; }
    .capsule {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--m-ground);
      border: var(--m-stroke) solid var(--m-ink);
      border-radius: var(--m-r-panel);
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18);
      cursor: grab;
      touch-action: none;
    }
    .capsule[data-dragging="true"] { cursor: grabbing; }
    .capsule::after {
      content: '';
      position: absolute;
      inset: -1px;
      border: var(--m-stroke-loud) solid var(--m-ink);
      border-radius: inherit;
      opacity: 0;
      transition: opacity var(--m-dur-rise) var(--m-ease);
    }
    .capsule[data-state="drifting"]::after { opacity: 1; }
    .gaze {
      width: 44px;
      height: 30px;
      transform: translateY(27px) scaleY(0.333);
      transition: transform var(--m-dur-rise) var(--m-ease);
    }
    .capsule[data-state="drifting"] .gaze { transform: translateY(0) scaleY(1); }
    .aperture {
      width: 100%;
      height: 100%;
      background: var(--m-clay);
      border-radius: 15px;
      animation: breathe 4.2s ease-in-out infinite, blink 6.7s linear infinite;
    }
    @keyframes breathe {
      0%, 100% { opacity: 0.92; transform: scaleY(1); }
      50% { opacity: 1; transform: scaleY(1.06); }
    }
    @keyframes blink {
      0%, 96%, 100% { opacity: 1; }
      97.5% { opacity: 0.15; }
    }
    @media (prefers-reduced-motion: reduce) {
      * { animation: none !important; transition: none !important; }
    }
  `
}

function clampToViewport(left, top) {
  const maxLeft = window.innerWidth - SIZE
  const maxTop = window.innerHeight - SIZE
  return { left: Math.min(Math.max(left, 0), Math.max(maxLeft, 0)), top: Math.min(Math.max(top, 0), Math.max(maxTop, 0)) }
}

async function positionHost() {
  const { companionPosition } = await chrome.storage.local.get('companionPosition')
  if (companionPosition?.left != null && companionPosition?.top != null) {
    const { left, top } = clampToViewport(companionPosition.left, companionPosition.top)
    hostEl.style.left = `${left}px`
    hostEl.style.top = `${top}px`
    hostEl.style.right = ''
    hostEl.style.bottom = ''
  } else {
    hostEl.style.right = `${DEFAULT_POSITION.right}px`
    hostEl.style.bottom = `${DEFAULT_POSITION.bottom}px`
    hostEl.style.left = ''
    hostEl.style.top = ''
  }
}

function startDrag(e) {
  const rect = hostEl.getBoundingClientRect()
  dragState = { offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top }
  capsule.dataset.dragging = 'true'
  capsule.setPointerCapture(e.pointerId)
}

function onDrag(e) {
  if (!dragState) return
  const { left, top } = clampToViewport(e.clientX - dragState.offsetX, e.clientY - dragState.offsetY)
  hostEl.style.left = `${left}px`
  hostEl.style.top = `${top}px`
  hostEl.style.right = ''
  hostEl.style.bottom = ''
}

async function endDrag() {
  if (!dragState) return
  dragState = null
  capsule.dataset.dragging = 'false'
  await chrome.storage.local.set({
    companionPosition: { left: parseInt(hostEl.style.left, 10), top: parseInt(hostEl.style.top, 10) },
  })
}

async function ensureMounted() {
  if (hostEl) return
  hostEl = document.createElement('div')
  shadow = hostEl.attachShadow({ mode: 'closed' })
  const style = document.createElement('style')
  style.textContent = css()
  capsule = document.createElement('div')
  capsule.className = 'capsule'
  const gaze = document.createElement('div')
  gaze.className = 'gaze'
  const aperture = document.createElement('div')
  aperture.className = 'aperture'
  gaze.append(aperture)
  capsule.append(gaze)
  shadow.append(style, capsule)
  document.documentElement.append(hostEl)
  await positionHost()

  capsule.addEventListener('pointerdown', startDrag)
  capsule.addEventListener('pointermove', onDrag)
  capsule.addEventListener('pointerup', endDrag)
  capsule.addEventListener('pointercancel', endDrag)
}

function unmount() {
  if (!hostEl) return
  hostEl.remove()
  hostEl = null
  shadow = null
  capsule = null
}

async function applyState(session, companionState) {
  if (!session) {
    unmount()
    return
  }
  await ensureMounted()
  capsule.dataset.state = companionState ?? 'settled'
  capsule.title = session.intention || ''
}

async function render() {
  const { session, companionState } = await chrome.storage.local.get(['session', 'companionState'])
  await applyState(session, companionState)
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return
  if (changes.session) return render()
  if (changes.companionState && capsule) {
    capsule.dataset.state = changes.companionState.newValue ?? 'settled'
  }
})

render()
