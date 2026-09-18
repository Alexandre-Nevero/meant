// A second injection of this same script (from reinjectCompanion() in sw.js, e.g. after
// a browser restart re-runs onStartup on a tab this exact version already mounted into
// normally) must not create a second host element. This check has to live in the DOM,
// not in this module's own scope — verified empirically: chrome.scripting.executeScript()
// does NOT get a fresh module scope when the tab's frame never navigated. Chrome reuses
// that frame's existing isolated world across repeated injections, so a module-level
// guard (a variable) would never even get declared a second time — its file fails to
// parse at all (see the IIFE wrapper below, added for exactly this reason). A guard
// living in the DOM is the only thing both injections can actually observe.
if (document.documentElement.querySelector('[data-meant-companion]')) {
  throw new Error('meant-companion-already-mounted')
}

// The companion, floating on the page instead of docked in a side panel — present
// only while a session is running, draggable, and gone the instant the session ends.
// Visual language: The Tomato Companion Pet (Codex Pet Style) wrapped in the orbital band,
// combining the warmth of the character with the calm discipline of the MEANT witness.
//
// On hover: Emil Kowalski physics — lifts upward, softens shadow, gentle clockwise ripple
// through the clay band segments, and displays a small pill containing the user's current
// intention (strictly neutral, never motivational copy).
//
// One tap: records ADR-0058's "this isn't the work" label.
//
// Runs on <all_urls> (content_scripts), so it's a Shadow DOM: an arbitrary host page's
// own CSS must never leak in, and this widget's styles must never leak out onto the
// page. Token values are redeclared on :host rather than read from design/tokens.css,
// because :root on the host page has no MEANT tokens to inherit from. Colors reuse
// --m-ink/--m-clay/--m-ground — this codebase's rule is tokens-first, one palette,
// never a component's own hex value, even when matching an external reference.

;(function () {
const DEFAULT_POSITION = { right: 24, bottom: 24 }
const SIZE = 52

let hostEl = null
let shadow = null
let dot = null
let companionImg = null
let dragState = null
let returnTimer = null
let downAt = null
let currentSession = null
let hoverPill = null
let hoverTimer = null

function css() {
  return `
    :host {
      --m-ground: #F3F1EE;
      --m-clay: #C75B39;
      --m-ease: cubic-bezier(0.23, 1, 0.32, 1);
      --m-dur-press: 160ms;
      --m-stroke-loud: 2px;
      all: initial;
      position: fixed;
      z-index: 2147483647;
      width: ${SIZE}px;
      height: ${SIZE}px;
      animation: wake 360ms var(--m-ease);
    }
    @media (prefers-color-scheme: dark) {
      :host { --m-ground: #14120F; }
    }
    @keyframes wake {
      0% { transform: scale(0.5); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
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
      transition: transform 380ms var(--m-ease), filter 380ms var(--m-ease);
    }
    .dot-wrap[data-dragging="true"] {
      cursor: grabbing;
      transform: scale(0.96);
    }
    .dot-wrap:hover {
      transform: translateY(-4px);
      filter: drop-shadow(0 12px 20px rgba(20, 18, 15, 0.08));
    }

    .companion-img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      user-select: none;
      pointer-events: none;
      z-index: 1;
    }

    .band-overlay-svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2;
    }

    .ripple-seg {
      opacity: 0;
      transition: opacity 140ms ease-out, filter 140ms ease-out;
    }

    /* Staggered sequential clockwise ripple on hover */
    .dot-wrap:hover .ripple-seg-1 {
      animation: bandWakeRipple 320ms cubic-bezier(0.25, 1, 0.5, 1) 0ms forwards;
    }
    .dot-wrap:hover .ripple-seg-2 {
      animation: bandWakeRipple 320ms cubic-bezier(0.25, 1, 0.5, 1) 80ms forwards;
    }
    .dot-wrap:hover .ripple-seg-3 {
      animation: bandWakeRipple 320ms cubic-bezier(0.25, 1, 0.5, 1) 160ms forwards;
    }
    .dot-wrap:hover .ripple-seg-4 {
      animation: bandWakeRipple 320ms cubic-bezier(0.25, 1, 0.5, 1) 240ms forwards;
    }

    @keyframes bandWakeRipple {
      0% { opacity: 0; filter: brightness(1); }
      40% { opacity: 0.95; filter: brightness(1.4) drop-shadow(0 0 6px rgba(224, 125, 93, 0.8)); }
      100% { opacity: 0; filter: brightness(1); }
    }

    /* .ring — presence tells the state. Never a colour change (an orbit that changes hue
     * reads as a status light, not a witness). ADR-0057 deleted the drift signal, so while a
     * session runs there is exactly ONE state: solid, present, breathing. The dashed variant
     * and its pulse were kept unreferenced for a week after that and are now gone —
     * applyState() has only ever passed 'focus' since. */
    .ring {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 1.5px solid var(--m-clay);
      opacity: 0;
      transition: opacity 220ms var(--m-ease);
      z-index: 3;
    }
    .dot-wrap[data-state="focus"] .ring { opacity: 0.55; }

    /* The receipt for the one-tap label (ADR-0058). It is ADR-0026's return-pulse motion,
     * freed when the drift signal went — but NOT its duration: 0.6s was chosen when this
     * meant the witness settling after drift, which is a moment. As feedback for a tap it
     * belongs in the 100-160ms press band, and 600ms reads as lag. */
    .dot-wrap[data-returning="true"] .ring {
      opacity: 1;
      border-style: solid;
      animation: receipt var(--m-dur-press) var(--m-ease);
    }
    @keyframes receipt {
      0% { transform: scale(1); opacity: 1; }
      100% { transform: scale(1.6); opacity: 0; }
    }

    /* .dot — aliveness, sub-perceptual, always on. Fixed --m-clay fill, not --m-ink:
     * --m-ink used to flip near-black/near-white under prefers-color-scheme, which
     * reflects the user's OS setting, not the actual page's background — a dark-mode
     * user on an ordinary light page got a near-invisible near-white dot. --m-clay
     * (orange in both schemes) has working contrast against both a light and a dark
     * background, so visibility no longer depends on guessing the host page's colors. */
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--m-clay);
      animation: breathe 1.6s ease-in-out infinite;
      z-index: 4;
    }
    @keyframes breathe {
      0%, 100% { transform: scale(1); opacity: 0.92; }
      50% { transform: scale(1.12); opacity: 1; }
    }

    /* Deliberate exception to tokens-first: a contrast-critical pill floating over an
     * arbitrary, unknown page background must not depend on the OS dark-mode preference,
     * which reflects nothing about the actual page behind it. Do not tokenize these. */
    [data-companion-hover-pill] {
      position: absolute;
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      opacity: 0;
      pointer-events: none;
      transition: opacity 140ms var(--m-ease);
      margin: 0;
      padding: 6px 12px;
      max-width: 260px;
      display: flex;
      align-items: center;
      gap: 6px;
      overflow: hidden;
      border-radius: 6px;
      border: 1px solid #C8C2BA;
      background: #FAF8F5;
      color: #14120F;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(20, 18, 15, 0.08);
      white-space: nowrap;
    }
    [data-companion-hover-pill]::before {
      content: '';
      position: static;
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: var(--m-clay);
      flex-shrink: 0;
    }
    [data-companion-hover-pill] span {
      display: inline-block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 220px;
    }

    /* Reduced-motion overrides (PRD-A11Y-01 / I4) */
    @media (prefers-reduced-motion: reduce) {
      :host { animation: none; }
      .ring { transition: none; }
      .dot { animation: none; }
      .dot-wrap { transition: none !important; }
      .dot-wrap:hover { transform: none !important; }
      .ripple-seg { animation: none !important; }
      .dot-wrap[data-returning="true"] .ring {
        animation: none;
        opacity: 1;
        border-width: var(--m-stroke-loud);
      }
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
  // downAt is the tap guard (ADR-0058): the dot is draggable, so without it every reposition
  // would also file a "this isn't the work" label.
  downAt = { x: e.clientX, y: e.clientY, t: Date.now() }
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

/** ADR-0058 — one tap, one meaning: "this isn't the work."
 *
 *  Not two meanings. With no live drift flag there is nothing for "this IS the work" to
 *  correct, and the user already declared their work sites at session start (ADR-0035).
 *  A self-report cannot be a false positive, which is the whole reason this replaces the
 *  signal ADR-0057 removed rather than repairing it.
 *
 *  The receipt it plays is ADR-0026's ring-collapse, freed when the drift signal went and
 *  retimed to feedback speed (ADR-0058, #50). Same motion, new meaning: a RECEIPT, not a
 *  celebration. I2 forbids positive feedback during a session; it does not forbid telling
 *  the user their deliberate action registered. Without it the tap is indistinguishable
 *  from a dead control. */
const TAP_SLOP_PX = 4
const TAP_MAX_MS = 500

function wasTap(e) {
  if (!downAt) return false
  return Math.abs(e.clientX - downAt.x) <= TAP_SLOP_PX &&
         Math.abs(e.clientY - downAt.y) <= TAP_SLOP_PX &&
         Date.now() - downAt.t <= TAP_MAX_MS
}

// Two windows, because the two receipts are different things. The animated one must clear as
// soon as it has played, or [data-returning] lingers as a visible opacity change long after
// the motion ended. The static one must be held long enough to be *seen*, since it neither
// moves nor fades.
const RECEIPT_ANIMATED_MS = 180
const RECEIPT_STATIC_MS = 600

function receiptWindow() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches
    ? RECEIPT_STATIC_MS
    : RECEIPT_ANIMATED_MS
}

function playReceipt() {
  if (!dot) return
  dot.dataset.returning = 'true'
  clearTimeout(returnTimer)
  returnTimer = setTimeout(() => { if (dot) dot.dataset.returning = 'false' }, receiptWindow())
}

async function endDrag(e) {
  const tap = e && wasTap(e)
  downAt = null
  if (tap && currentSession) {
    playReceipt()
    // Fire-and-forget: the service worker may be asleep, and the receipt must not wait on
    // a round trip. Nothing on screen depends on the response.
    chrome.runtime.sendMessage({ type: 'not-the-work' }).catch(() => {})
  }
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
  dot.className = 'dot-wrap companion-wrap'

  companionImg = document.createElement('img')
  companionImg.className = 'companion-img'
  companionImg.src = chrome.runtime.getURL('assets/the-tomato-transparent.png')
  companionImg.alt = 'MEANT Tomato Companion'

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('class', 'band-overlay-svg')
  svg.setAttribute('viewBox', '0 0 200 200')
  svg.setAttribute('aria-hidden', 'true')
  svg.innerHTML = `
    <path class="ripple-seg ripple-seg-1" d="M 32 118 A 74 20 0 0 0 54 125" fill="none" stroke="#FFA380" stroke-width="10" stroke-linecap="round" />
    <path class="ripple-seg ripple-seg-2" d="M 58 126 A 74 20 0 0 0 84 133" fill="none" stroke="#FFA380" stroke-width="10" stroke-linecap="round" />
    <path class="ripple-seg ripple-seg-3" d="M 88 134 A 74 20 0 0 0 114 136" fill="none" stroke="#FFA380" stroke-width="10" stroke-linecap="round" />
    <path class="ripple-seg ripple-seg-4" d="M 118 136 A 74 20 0 0 0 144 134" fill="none" stroke="#FFA380" stroke-width="10" stroke-linecap="round" />
  `

  const ring = document.createElement('div')
  ring.className = 'ring'
  const core = document.createElement('div')
  core.className = 'dot'
  dot.append(companionImg, svg, ring, core)
  hoverPill = document.createElement('p')
  hoverPill.dataset.companionHoverPill = 'true'
  shadow.append(style, dot, hoverPill)
  document.documentElement.append(hostEl)
  await positionHost()

  dot.addEventListener('pointerdown', startDrag)
  dot.addEventListener('pointermove', onDrag)
  dot.addEventListener('pointerup', endDrag)
  dot.addEventListener('pointercancel', endDrag)
  dot.addEventListener('pointerenter', showHoverPill)
  dot.addEventListener('pointerleave', hideHoverPill)
}

function showHoverPill() {
  if (!currentSession?.intention) return
  clearTimeout(hoverTimer)
  hoverTimer = setTimeout(() => {
    hoverPill.replaceChildren(document.createElement('span'))
    hoverPill.firstChild.textContent = currentSession.intention
    hoverPill.style.opacity = '1'
    hoverPill.style.bottom = 'calc(100% + 8px)'
    hoverPill.style.top = ''
    hoverPill.style.left = '50%'
    hoverPill.style.transform = 'translateX(-50%)'
    requestAnimationFrame(() => {
      const rect = hoverPill.getBoundingClientRect()
      if (rect.top < 0) {
        hoverPill.style.top = 'calc(100% + 8px)'
        hoverPill.style.bottom = ''
      }
      const overflowRight = rect.right - window.innerWidth
      const overflowLeft = -rect.left
      if (overflowRight > 0) hoverPill.style.transform = `translateX(calc(-50% - ${overflowRight}px))`
      else if (overflowLeft > 0) hoverPill.style.transform = `translateX(calc(-50% + ${overflowLeft}px))`
    })
  }, 150)
}

function hideHoverPill() {
  clearTimeout(hoverTimer)
  if (hoverPill) hoverPill.style.opacity = '0'
}

function unmount() {
  if (!hostEl) return
  hostEl.remove()
  hostEl = null
  shadow = null
  dot = null
  hoverPill = null
  companionImg = null
  clearTimeout(returnTimer)
  clearTimeout(hoverTimer)
}

// ADR-0057 removed the drift signal, so a running session has exactly one visual state: a
// solid, breathing ring. The drift->focus branch that used to live here was unreachable —
// applyState() has only ever passed 'focus'. Its motion survives, with a new meaning and a
// new duration, as the receipt in playReceipt() (ADR-0058).
function applyVisualState(next) {
  if (!dot) return
  dot.dataset.state = next
}

async function applyState(session, companionState) {
  if (!session) {
    unmount()
    currentSession = null
    return
  }
  currentSession = session
  await ensureMounted()
  applyVisualState('focus')
  dot.title = session.intention || ''
}

async function render() {
  const { session, companionState } = await chrome.storage.local.get(['session', 'companionState'])
  await applyState(session, companionState)
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return
  if (changes.session) return render()
  if (changes.companionState && dot) applyVisualState('focus')
})

render()
})()
