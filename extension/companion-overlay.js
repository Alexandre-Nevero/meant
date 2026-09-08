// The companion, floating on the page instead of docked in a side panel — present
// only while a session is running, draggable, and gone the instant the session ends.
// Visual language: the "Orbit" reference (a minimal orbital dot, states told by ring
// presence/style, never by color) — deliberately adopted over the prior 3.1 companion
// spec (docs/dead-ends.md and PRODUCT.md record the reversal and why).
//
// Runs on <all_urls> (content_scripts), so it's a Shadow DOM: an arbitrary host page's
// own CSS must never leak in, and this widget's styles must never leak out onto the
// page. Token values are redeclared on :host rather than read from design/tokens.css,
// because :root on the host page has no MEANT tokens to inherit from. Colors reuse
// --m-ink/--m-clay/--m-ground — this codebase's rule is tokens-first, one palette,
// never a component's own hex value, even when matching an external reference.

const DEFAULT_POSITION = { right: 24, bottom: 24 }
const SIZE = 28

let hostEl = null
let shadow = null
let dot = null
let dragState = null
let returnTimer = null

function css() {
  return `
    :host {
      --m-ground: #F3F1EE;
      --m-ink: #14120F;
      --m-clay: #C75B39;
      --m-ease: cubic-bezier(0.23, 1, 0.32, 1);
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

    /* Three nodes, each one job — the same split the prior design used, for the same
     * reason: a running CSS animation overrides a transition on the same property
     * of the same element, so the ring's state-change transition and the dot's
     * always-on breathing animation cannot live on one node. */
    .dot-wrap {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
      touch-action: none;
    }
    .dot-wrap[data-dragging="true"] { cursor: grabbing; }

    /* .ring — presence + style tells the state. Never a color change (an orbit that
     * changes hue reads as a status light, not a witness) — solid vs. dashed vs. none. */
    .ring {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 1.5px solid var(--m-clay);
      opacity: 0;
      transition: opacity 220ms var(--m-ease);
    }
    .dot-wrap[data-state="focus"] .ring { opacity: 0.55; }
    .dot-wrap[data-state="drift"] .ring {
      opacity: 1;
      border-style: dashed;
      animation: pulse-drift 1.2s ease-out infinite;
    }
    .dot-wrap[data-returning="true"] .ring {
      opacity: 1;
      border-style: solid;
      animation: return-pulse 0.6s ease-out;
    }
    @keyframes pulse-drift {
      0% { transform: scale(1); opacity: 1; }
      100% { transform: scale(1.35); opacity: 0; }
    }
    @keyframes return-pulse {
      0% { transform: scale(1); opacity: 1; }
      100% { transform: scale(1.6); opacity: 0; }
    }

    /* .dot — aliveness, sub-perceptual, always on. */
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--m-ink);
      animation: breathe 1.6s ease-in-out infinite;
    }
    @keyframes breathe {
      0%, 100% { transform: scale(1); opacity: 0.92; }
      50% { transform: scale(1.12); opacity: 1; }
    }

    @media (prefers-reduced-motion: reduce) {
      * { animation: none !important; transition: none !important; }
    }
  `
}

function clampFraction(frac) {
  return Math.min(Math.max(frac, 0), 1)
}

async function positionHost() {
  const { companionPosition } = await chrome.storage.local.get('companionPosition')
  // A stale {left, top} (pre-fraction format) has no xFrac/yFrac — treat it exactly
  // like "nothing stored" rather than writing a migration: a dragged-position
  // preference is low-stakes, and the next drag naturally re-saves the new format.
  if (companionPosition?.xFrac != null && companionPosition?.yFrac != null) {
    const left = clampFraction(companionPosition.xFrac) * (window.innerWidth - SIZE)
    const top = clampFraction(companionPosition.yFrac) * (window.innerHeight - SIZE)
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
  dot.dataset.dragging = 'true'
  dot.setPointerCapture(e.pointerId)
}

function onDrag(e) {
  if (!dragState) return
  const left = Math.min(Math.max(e.clientX - dragState.offsetX, 0), Math.max(window.innerWidth - SIZE, 0))
  const top = Math.min(Math.max(e.clientY - dragState.offsetY, 0), Math.max(window.innerHeight - SIZE, 0))
  hostEl.style.left = `${left}px`
  hostEl.style.top = `${top}px`
  hostEl.style.right = ''
  hostEl.style.bottom = ''
}

async function endDrag() {
  if (!dragState) return
  dragState = null
  dot.dataset.dragging = 'false'
  const left = parseInt(hostEl.style.left, 10)
  const top = parseInt(hostEl.style.top, 10)
  await chrome.storage.local.set({
    companionPosition: {
      xFrac: window.innerWidth > SIZE ? left / (window.innerWidth - SIZE) : 0,
      yFrac: window.innerHeight > SIZE ? top / (window.innerHeight - SIZE) : 0,
    },
  })
}

async function ensureMounted() {
  if (hostEl) return
  hostEl = document.createElement('div')
  hostEl.dataset.meantCompanion = 'true'
  // 'open' — the only thing 'closed' would hide is what's already readable off the host
  // element's own `title` attribute (the intention sentence), so closed bought no real
  // privacy while making the widget's internals opaque to automated testing.
  shadow = hostEl.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = css()
  dot = document.createElement('div')
  dot.className = 'dot-wrap'
  const ring = document.createElement('div')
  ring.className = 'ring'
  const core = document.createElement('div')
  core.className = 'dot'
  dot.append(ring, core)
  shadow.append(style, dot)
  document.documentElement.append(hostEl)
  await positionHost()

  dot.addEventListener('pointerdown', startDrag)
  dot.addEventListener('pointermove', onDrag)
  dot.addEventListener('pointerup', endDrag)
  dot.addEventListener('pointercancel', endDrag)
}

function unmount() {
  if (!hostEl) return
  hostEl.remove()
  hostEl = null
  shadow = null
  dot = null
  clearTimeout(returnTimer)
}

// Real data today only has two values: 'settled' | 'drifting' — "Resting" (no ring at
// all) and a distinct "Focus" have no signal to tell them apart yet (that needs the
// dwell/resolve work later tasks build), so both map to the same ring-on state for now.
// The Drift -> Focus transition is the one moment worth a one-shot animation: I2 forbids
// celebrating an outcome, not a state's own witness settling back down, which the prior
// gaze-transform design already did wordlessly on every return — this is that same
// acknowledgment, reskinned, not a new kind of on-screen reward.
function applyVisualState(next) {
  if (!dot) return
  const prev = dot.dataset.state
  dot.dataset.state = next
  if (prev === 'drift' && next === 'focus') {
    dot.dataset.returning = 'true'
    clearTimeout(returnTimer)
    returnTimer = setTimeout(() => { if (dot) dot.dataset.returning = 'false' }, 620)
  }
}

async function applyState(session, companionState) {
  if (!session) {
    unmount()
    return
  }
  await ensureMounted()
  applyVisualState(companionState === 'drifting' ? 'drift' : 'focus')
  dot.title = session.intention || ''
}

async function render() {
  const { session, companionState } = await chrome.storage.local.get(['session', 'companionState'])
  await applyState(session, companionState)
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return
  if (changes.session) return render()
  if (changes.companionState && dot) {
    applyVisualState(changes.companionState.newValue === 'drifting' ? 'drift' : 'focus')
  }
})

render()
