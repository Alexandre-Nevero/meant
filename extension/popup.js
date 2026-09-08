import { post, get, apiBase } from './api.js'
import { isEditable } from './lib/sentence-lock.js'
import { normalizeDomain } from './lib/normalize-domain.js'
import { resolveSitePhrase } from './lib/resolve-sites.js'

const root = document.getElementById('root')

// N8. Also D34's sentence-edit window. Matches lib/thresholds.ts's GRACE_MS — the plain-JS
// extension can't import that TS module (T4 note). Task 10's gate.js reconciles the
// duplication once it lands; this is a magic-number duplication, not a forward reference.
const GRACE_MS = 60_000

// D39. Matches lib/thresholds.ts's CYCLE_PRESETS, same cross-import limitation as GRACE_MS
// above. `custom` is any pair; `null` cycle means one continuous block (today's behaviour).
const CYCLE_PRESETS = [{ work: 25, break: 5 }, { work: 50, break: 10 }]

function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function show(...nodes) {
  root.replaceChildren(...nodes)
}

/** A row of chips. Single-select by default — `aria-pressed` on exactly one, defaulting to
 *  `options[0]` unless `value` is given. Pass `{ multi: true, value: [...] }` for independent
 *  per-chip toggling, defaulting to that starting set. Pass `{ addable: true }` (multi-select
 *  only) to append a '+' chip that turns into a text input for adding a new option at runtime
 *  — the site rows' pool isn't fixed ahead of time. Pass `{ removable: true, onRemove }` (multi
 *  only) to split each chip into two sibling buttons sharing a `div[data-chip-item]` wrapper
 *  (never nested — a `<button>` inside a `<button>` is invalid HTML): the chip body still
 *  toggles per-session inclusion via `aria-pressed`, exactly like the non-removable case, while
 *  a small trailing `.m-chip[data-chip-role="delete"]` ("×", `aria-label="Remove <label>"`)
 *  deletes it from local state and calls `onRemove(value)` — the real standing-list removal.
 *  `onChange(value)` fires after every click (toggle or delete) or add. Keeps the
 *  `<button aria-pressed>` pattern (design.md §8). */
function chipGroup(options, { mono = false, multi = false, value, addable = false, removable = false, onChange, onRemove } = {}) {
  const row = el('div', 'm-chip-row')
  const selected = multi ? new Set(value ?? []) : null
  let single = multi ? null : (value ?? options[0]?.value)
  let plusButton = null

  function currentValue() {
    return multi ? [...selected] : single
  }

  function addChip(v, label = v) {
    const chip = el('button', 'm-chip', label)
    chip.type = 'button'
    chip.dataset.mono = String(mono)
    chip.setAttribute('aria-pressed', String(multi ? selected.has(v) : single === v))
    chip.addEventListener('click', () => {
      if (multi) {
        if (selected.has(v)) selected.delete(v)
        else selected.add(v)
        chip.setAttribute('aria-pressed', String(selected.has(v)))
      } else {
        single = v
        for (const b of row.querySelectorAll('.m-chip')) b.setAttribute('aria-pressed', String(b === chip))
      }
      if (onChange) onChange(currentValue())
    })

    if (!removable) {
      row.insertBefore(chip, plusButton)
      return chip
    }

    // Two sibling click targets, one visual chip: the body toggles (above), the "×"
    // deletes from the standing list. A wrapper keeps them moving together in the
    // flex-wrap row without nesting one button inside another.
    const del = el('button', 'm-chip', '×')
    del.type = 'button'
    del.dataset.chipRole = 'delete'
    del.setAttribute('aria-label', `Remove ${label}`)
    del.addEventListener('click', () => {
      selected.delete(v)
      wrap.remove()
      if (onRemove) onRemove(v)
      if (onChange) onChange(currentValue())
    })
    const wrap = el('div')
    wrap.dataset.chipItem = 'removable'
    wrap.append(chip, del)
    row.insertBefore(wrap, plusButton)
    return chip
  }

  for (const { label, value: v } of options) addChip(v, label)

  if (multi && addable) {
    plusButton = el('button', 'm-chip', '+')
    plusButton.type = 'button'
    plusButton.setAttribute('aria-pressed', 'false')
    plusButton.addEventListener('click', () => {
      const input = el('input', 'm-chip')
      input.type = 'text'
      input.placeholder = 'domain.com, or "gmail, docs"'
      input.style.width = '160px'
      const error = el('p', 'm-meta', '')
      error.hidden = true
      plusButton.replaceWith(input)
      input.after(error)
      input.focus()

      let settled = false
      let pendingSuggestion = null

      function showError(message) {
        error.textContent = message
        error.hidden = false
      }
      function clearError() {
        error.hidden = true
        pendingSuggestion = null
      }

      // Returns true on success (input closed, chips added or nothing typed), false if it
      // stayed open showing an error — the blur handler uses this to re-focus rather than
      // let a bad phrase silently vanish.
      const attemptCommit = () => {
        if (settled) return true
        let text = input.value
        if (pendingSuggestion && text === pendingSuggestion.rawText) {
          // Replace by TOKEN POSITION, not a raw string .replace() — a bad token that is
          // itself a substring of an earlier valid token (e.g. "doc" inside "docs") would
          // otherwise get hit at the wrong spot and oscillate forever. Split the same way
          // resolveSitePhrase does internally (extension/lib/resolve-sites.js).
          const tokens = text.split(/,| and /i).map((t) => t.trim())
          tokens[pendingSuggestion.badIndex] = pendingSuggestion.suggestion
          text = tokens.join(', ')
          input.value = text
        }
        if (!text.trim()) {
          settled = true
          error.remove()
          input.replaceWith(plusButton)
          return true
        }
        const result = resolveSitePhrase(text)
        if (!result.ok) {
          pendingSuggestion = result.suggestion
            ? { rawText: input.value, badIndex: result.badIndex, suggestion: result.suggestion }
            : null
          showError(
            result.suggestion
              ? `did you mean ${result.suggestion}? Press Enter to use it`
              : `"${result.badToken}" isn't a known site — type the full domain`,
          )
          return false
        }
        settled = true
        error.remove()
        input.replaceWith(plusButton)
        let changed = false
        for (const domain of result.domains) {
          if (!selected.has(domain)) {
            selected.add(domain)
            addChip(domain)
            changed = true
          }
        }
        if (changed && onChange) onChange(currentValue())
        return true
      }

      const discard = () => {
        if (settled) return
        settled = true
        error.remove()
        input.replaceWith(plusButton)
      }

      input.addEventListener('input', clearError)
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') discard()
        else if (e.key === 'Enter') attemptCommit()
      })
      input.addEventListener('blur', () => {
        if (!attemptCommit()) input.focus()
      })
    })
    row.append(plusButton)
  }

  return { row, get value() { return currentValue() } }
}

function navRow() {
  const row = el('div', 'm-chip-row')
  const history = el('button', 'm-btn', 'History')
  history.dataset.variant = 'quiet'
  history.addEventListener('click', async () => {
    chrome.tabs.create({ url: (await apiBase()) + '/dashboard' })
  })
  const landing = el('button', 'm-btn', 'meant.app')
  landing.dataset.variant = 'quiet'
  landing.addEventListener('click', async () => {
    chrome.tabs.create({ url: (await apiBase()) + '/' })
  })
  row.append(history, landing)
  return row
}

function cyclePresetKey(cycle) {
  if (!cycle) return 'none'
  const preset = CYCLE_PRESETS.find((p) => p.work === cycle.work && p.break === cycle.break)
  return preset ? `${preset.work}/${preset.break}` : 'custom'
}

/** 25/5 · 50/10 · custom · no cycles. `custom` reveals two number inputs (`customRow`,
 *  rendered separately so the caller controls where it sits). `.value` is `{work,break}` or
 *  `null` — `null` (picking "no cycles") is today's one-continuous-block behaviour. */
function cyclePicker(initialCycle) {
  const key = cyclePresetKey(initialCycle)
  const options = [
    ...CYCLE_PRESETS.map((p) => ({ label: `${p.work}/${p.break}`, value: `${p.work}/${p.break}` })),
    { label: 'custom', value: 'custom' },
    { label: 'no cycles', value: 'none' },
  ]

  const customWork = el('input', 'm-chip')
  customWork.type = 'number'
  customWork.min = '1'
  customWork.style.width = '64px'
  const customBreak = el('input', 'm-chip')
  customBreak.type = 'number'
  customBreak.min = '1'
  customBreak.style.width = '64px'
  customWork.value = String(key === 'custom' ? initialCycle.work : 25)
  customBreak.value = String(key === 'custom' ? initialCycle.break : 5)

  const customRow = el('div', 'm-chip-row')
  customRow.append(customWork, el('span', null, '/'), customBreak)
  customRow.hidden = key !== 'custom'

  const group = chipGroup(options, {
    mono: true,
    value: key,
    onChange: (v) => { customRow.hidden = v !== 'custom' },
  })

  return {
    row: group.row,
    customRow,
    get value() {
      const v = group.value
      if (v === 'none') return null
      if (v === 'custom') {
        return { work: Number(customWork.value) || 25, break: Number(customBreak.value) || 5 }
      }
      const [work, brk] = v.split('/').map(Number)
      return { work, break: brk }
    },
  }
}

async function fetchLists() {
  const base = await apiBase()
  const { token } = await chrome.storage.local.get('token')
  try {
    const res = await fetch(`${base}/api/lists`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) return { workSites: [], distractSites: [] }
    return await res.json()
  } catch {
    return { workSites: [], distractSites: [] }
  }
}

async function removeFromList(kind, domain) {
  const res = await fetchLists()
  const next = {
    workSites: kind === 'work' ? res.workSites.filter((d) => d !== domain) : res.workSites,
    distractSites: kind === 'distract' ? res.distractSites.filter((d) => d !== domain) : res.distractSites,
  }
  await post('/api/lists', next, { method: 'PUT' })
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

async function idle() {
  const mark = el('p', 'm-mark', '')
  mark.dataset.state = 'idle'

  const label = el('p', 'm-meta', 'What do you mean to do?')

  const field = el('input', 'm-field')
  field.placeholder = ''

  const [{ lastChoice }, lists] = await Promise.all([
    chrome.storage.local.get('lastChoice'),
    fetchLists(),
  ])
  const knownWorkSites = lists.workSites ?? []
  const distractSites = lists.distractSites ?? []

  const duration = chipGroup(
    [{ label: '25 min', value: '25' }, { label: '50 min', value: '50' }, { label: 'until I stop', value: '' }],
    { mono: true, value: lastChoice ? (lastChoice.plannedMinutes == null ? '' : String(lastChoice.plannedMinutes)) : '25' },
  )

  // First ever session: cycle defaults to 50/10 (Step 3). A returning session recalls last time's pick.
  const cycle = cyclePicker(lastChoice ? lastChoice.cycle : { work: 50, break: 10 })

  // First ever session: workSites from the API, none pre-selected.
  const workSiteValues = lastChoice ? lastChoice.workSites : []
  const workSiteOptions = [...new Set([...knownWorkSites, ...workSiteValues])].map((d) => ({ label: d, value: d }))
  const workSites = chipGroup(workSiteOptions, {
    multi: true, addable: true, removable: true, value: workSiteValues,
    onRemove: (domain) => removeFromList('work', domain),
  })

  // First ever session: blockedDomains defaults to the whole standing distract list.
  const blockedValues = lastChoice ? lastChoice.blockedDomains : distractSites
  const blockedOptions = [...new Set([...distractSites, ...blockedValues])].map((d) => ({ label: d, value: d }))
  const blockingLabel = el('p', 'm-meta', 'what to block')
  const blocked = chipGroup(blockedOptions, {
    multi: true,
    addable: true,
    removable: true,
    value: blockedValues,
    onRemove: (domain) => removeFromList('distract', domain),
  })

  // data-chip-layout, not a class: the class contract is frozen at 13 fixed classes plus
  // .m-chip/.m-chip-row/.m-companion-* — attribute values stay extensible, class names don't.
  const whereGroup = el('div')
  whereGroup.dataset.chipLayout = 'group'
  whereGroup.append(el('p', 'm-meta', 'where it happens'), workSites.row)
  const blockGroup = el('div')
  blockGroup.dataset.chipLayout = 'group'
  blockGroup.append(blockingLabel, blocked.row)
  const siteCluster = el('div')
  siteCluster.dataset.chipLayout = 'cluster'
  siteCluster.append(whereGroup, blockGroup)

  const start = el('button', 'm-btn', 'Start')
  start.dataset.variant = 'primary'
  start.addEventListener('click', async () => {
    start.disabled = true
    const plannedMinutes = duration.value ? Number(duration.value) : null
    const cycleValue = cycle.value
    const workSitesValue = workSites.value
    const blockedDomainsValue = blocked.value
    const res = await chrome.runtime.sendMessage({
      type: 'start',
      intention: field.value,
      plannedMinutes,
      workSites: workSitesValue,
      blockedDomains: blockedDomainsValue,
      blocklists: [],
      cycle: cycleValue,
    })
    if (!res?.ok) {
      console.error('popup: start failed', res, chrome.runtime.lastError)
      start.disabled = false
      show(mark, label, field, duration.row, cycle.row, cycle.customRow, siteCluster, start,
        el('p', 'm-meta', res?.offline ? 'No connection. A session needs one to start.' : 'Could not start.'))
      return
    }
    await chrome.storage.local.set({
      lastChoice: {
        plannedMinutes,
        cycle: cycleValue,
        blockedDomains: blockedDomainsValue,
        blocklists: [],
        workSites: workSitesValue,
      },
    })
    // The companion floats on the page itself now (extension/companion-overlay.js) —
    // it reacts to chrome.storage's session/companionState on its own; nothing here
    // needs to open or target a surface.
    render()
  })

  const disconnect = el('button', 'm-btn', 'Disconnect this device')
  disconnect.dataset.variant = 'quiet'
  disconnect.addEventListener('click', async () => {
    disconnect.disabled = true
    // Fire-and-forget the revoke: even if it's offline, clearing the local token is
    // what matters for "I want this device paired to nothing" — the same shape as
    // the automatic 401 path in api.js, applied on purpose instead of on rejection.
    await post('/api/device', undefined, { method: 'DELETE', queue: false })
    // pendingReview too: a stale marker from a previous account/device must never show
    // someone else's (or a revoked device's) outcome question after a fresh pairing.
    await chrome.storage.local.set({ token: null, deviceId: null, session: null, pendingReview: null })
    render()
  })

  show(mark, label, field, duration.row, cycle.row, cycle.customRow, siteCluster, start, disconnect, navRow())
}

// Pure computation, no chrome.* API — which phase (work/break) the elapsed time
// currently falls into, and how much of it remains. Read-only display only: this does
// NOT drive extension/lib/attribution.js's 'break' mode, which stays undriven exactly
// as it is today.
function cyclePhase(session) {
  if (!session.cycle) return null
  const { work, break: brk } = session.cycle
  const cycleMs = (work + brk) * 60_000
  const workMs = work * 60_000
  const elapsedMs = Date.now() - new Date(session.startedAt).getTime()
  const posInCycle = ((elapsedMs % cycleMs) + cycleMs) % cycleMs // guard against a negative elapsed edge case
  if (posInCycle < workMs) {
    return { phase: 'work', elapsedInPhaseMs: posInCycle, phaseMs: workMs, remainingMinutes: Math.ceil((workMs - posInCycle) / 60_000) }
  }
  return { phase: 'break', elapsedInPhaseMs: posInCycle - workMs, phaseMs: brk * 60_000, remainingMinutes: Math.ceil((cycleMs - posInCycle) / 60_000) }
}

function running(session) {
  const mark = el('p', 'm-mark', '')
  mark.dataset.state = 'running'

  const phase = cyclePhase(session)

  const startedAt = new Date(session.startedAt).getTime()
  const elapsedMinutes = Math.floor((Date.now() - startedAt) / 60000)
  const elapsed = el('p', 'm-meta', `${elapsedMinutes} min elapsed`)

  const phaseLine = phase ? el('p', 'm-meta', `${phase.phase} — ${phase.remainingMinutes} min left`) : null

  const blockedList = session.blockedDomains?.length
    ? el('p', 'm-meta', `blocking: ${session.blockedDomains.join(', ')}`)
    : null

  const stop = el('button', 'm-btn', 'Stop')
  stop.dataset.variant = 'quiet'
  stop.addEventListener('click', async () => {
    stop.disabled = true
    await chrome.runtime.sendMessage({ type: 'stop' })
    render()
  })

  let sentenceNode
  if (isEditable(Date.now(), startedAt, GRACE_MS)) {
    sentenceNode = el('input', 'm-field')
    sentenceNode.value = session.intention

    const commit = async () => {
      const value = sentenceNode.value.trim()
      if (!value || value === session.intention) return
      session.intention = value
      await chrome.storage.local.set({ session })
      post(`/api/sessions/${session.sessionId}`, { intention: value }, { method: 'PATCH' })
    }
    sentenceNode.addEventListener('blur', commit)
    sentenceNode.addEventListener('keydown', (e) => { if (e.key === 'Enter') sentenceNode.blur() })
  } else {
    sentenceNode = el('p', 'm-sentence', session.intention)
  }

  // The intention's own box doubles as the cycle's static progress indicator: an SVG
  // stroke traced around the pill's existing rounded-rect shape (same 26px corner radius
  // as --m-r-field — this doesn't change the pill's shape, only how its outline is
  // drawn), instead of a flat strip on one edge. `.m-field`/`.m-sentence` cannot show a
  // two-tone border directly (an <input> can't hold child DOM nodes, and CSS
  // border-image doesn't combine reliably with border-radius across browsers) — an SVG
  // sibling avoids both problems. Static only — recomputed on the popup's own natural
  // re-render, never a live tick; getTotalLength() gives the exact rendered perimeter for
  // THIS pill's real, measured size (it can grow to two lines), no manual formula needed.
  const pillWrap = el('div')
  pillWrap.dataset.timerPill = 'true'
  pillWrap.append(sentenceNode)
  if (phase) {
    requestAnimationFrame(() => {
      const { width, height } = pillWrap.getBoundingClientRect()
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
      svg.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; pointer-events:none;'

      const r = 26
      function track(strokeColor) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        rect.setAttribute('x', '0.75')
        rect.setAttribute('y', '0.75')
        rect.setAttribute('width', String(width - 1.5))
        rect.setAttribute('height', String(height - 1.5))
        rect.setAttribute('rx', String(r))
        rect.setAttribute('ry', String(r))
        rect.setAttribute('fill', 'none')
        rect.setAttribute('stroke', strokeColor)
        rect.setAttribute('stroke-width', '1.5')
        return rect
      }

      const remainderTrack = track('var(--m-edge)')
      remainderTrack.setAttribute('stroke-dasharray', '3 3')
      const elapsedTrack = track('var(--m-clay)')
      svg.append(remainderTrack, elapsedTrack)
      pillWrap.append(svg)
      pillWrap.style.border = 'none'

      const perimeter = elapsedTrack.getTotalLength()
      const elapsedFraction = phase.elapsedInPhaseMs / phase.phaseMs
      elapsedTrack.setAttribute('stroke-dasharray', `${perimeter * elapsedFraction} ${perimeter}`)
    })
  }

  show(mark, pillWrap, ...(phaseLine ? [phaseLine] : []), elapsed, ...(blockedList ? [blockedList] : []), stop, navRow())
}

async function outcome(sessionId) {
  const mark = el('p', 'm-mark', '')
  mark.dataset.state = 'ended'

  const res = await get(`/api/sessions/${sessionId}/review`)
  // Transient (offline, or the server itself is down): the review data may just be
  // unreachable right now, not gone — don't discard pendingReview on the first network
  // hiccup. Only a genuine 404/401 (below) is treated as final.
  if (res.offline || (typeof res.status === 'number' && res.status >= 500)) {
    const done = el('button', 'm-btn', 'Done')
    done.dataset.variant = 'quiet'
    done.addEventListener('click', async () => {
      await chrome.storage.local.remove('pendingReview')
      render()
    })
    return show(mark, el('p', 'm-meta', "Can't reach it right now."), done)
  }
  if (!res.ok || !res.data) {
    await chrome.storage.local.remove('pendingReview')
    return idle()
  }
  const data = res.data

  const nodes = [mark]
  if (data.intention) {
    nodes.push(el('p', 'm-meta', 'You meant to'), el('p', 'm-sentence', data.intention))
  } else {
    nodes.push(el('p', 'm-meta', "You didn't say what you meant to do."))
  }
  for (const row of data.topAttention) {
    nodes.push(el('p', 'm-meta', `${row.domain} — ${Math.round(row.seconds / 60)} min`))
  }
  if (data.awaySeconds > 0) {
    nodes.push(el('p', 'm-meta', `away — ${Math.round(data.awaySeconds / 60)} min`))
  }
  if (data.blockedAttempts > 0) {
    nodes.push(el('p', 'm-meta', `${data.blockedAttempts} blocked attempts`))
  }

  if (data.outcome === 'unanswered') {
    nodes.push(el('p', 'm-rate', 'Did you?'))
    const yes = el('button', 'm-answer', 'Yes')
    const notYet = el('button', 'm-answer', 'Not yet')
    const answer = async (value) => {
      yes.disabled = true
      notYet.disabled = true
      await post(`/api/sessions/${sessionId}/outcome`, { outcome: value }, { method: 'PATCH' })
      // pendingReview stays set — re-render the same outcome view so the resolved
      // "Good/Noted" message shows; only the Done button below clears the marker.
      render()
    }
    yes.addEventListener('click', () => answer('yes'))
    notYet.addEventListener('click', () => answer('no'))
    nodes.push(yes, notYet, navRow())
  } else {
    nodes.push(el('p', 'm-meta', data.outcome === 'yes'
      ? `Good. That's ${data.finished} of ${data.answered}.`
      : 'Noted. It carries over.'))
    const done = el('button', 'm-btn', 'Done')
    done.dataset.variant = 'quiet'
    done.addEventListener('click', async () => {
      await chrome.storage.local.remove('pendingReview')
      render()
    })
    nodes.push(done, navRow())
  }

  show(...nodes)
}

async function render() {
  const { token, session, unpairedReason, pendingReview } = await chrome.storage.local.get(['token', 'session', 'unpairedReason', 'pendingReview'])
  if (!token) {
    if (unpairedReason) await chrome.storage.local.remove('unpairedReason')
    return unpaired(unpairedReason)
  }
  if (session) return running(session)
  if (pendingReview) return outcome(pendingReview.sessionId)
  await idle()
}

render()
