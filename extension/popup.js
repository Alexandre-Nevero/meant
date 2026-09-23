import { post, get, apiBase } from './api.js'
import { isEditable } from './lib/sentence-lock.js'
import { normalizeDomain } from './lib/normalize-domain.js'
import { resolveSitePhrase } from './lib/resolve-sites.js'
import { withOpenSlice, toSegments } from './lib/tally.js'
import { MAX_CYCLES, clampCount, plannedMinutesFor, restoreCycle } from './lib/cycles.js'
import { PRESETS } from './blocklists.js'
import { matchPreset, presetBlockSet } from './lib/presets.js'

const root = document.getElementById('root')

// N8. Also D34's sentence-edit window. Matches lib/thresholds.ts's GRACE_MS — the plain-JS
// extension can't import that TS module (T4 note). Task 10's gate.js reconciles the
// duplication once it lands; this is a magic-number duplication, not a forward reference.
const GRACE_MS = 60_000

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
 *  `<button aria-pressed>` pattern (docs/design.md §8). */
function chipGroup(options, { mono = false, multi = false, value, addable = false, removable = false, onChange, onRemove } = {}) {
  const row = el('div', 'm-chip-row')
  const selected = multi ? new Set(value ?? []) : null
  let single = multi ? null : (value ?? options[0]?.value)
  let plusButton = null
  const chips = new Map() // value -> its chip body button, so set() can re-press them

  function currentValue() {
    return multi ? [...selected] : single
  }

  function addChip(v, label = v) {
    const chip = el('button', 'm-chip', label)
    chip.type = 'button'
    chip.dataset.mono = String(mono)
    chip.setAttribute('aria-pressed', String(multi ? selected.has(v) : single === v))
    chips.set(v, chip)
    chip.addEventListener('click', () => {
      if (multi) {
        if (selected.has(v)) selected.delete(v)
        else selected.add(v)
        chip.setAttribute('aria-pressed', String(selected.has(v)))
      } else {
        single = v
        // Direct children only: the cycle row nests its stepper's −/+ buttons (also .m-chip)
        // inside the same row, and a single-select click must never stamp aria-pressed on them.
        for (const b of row.querySelectorAll(':scope > .m-chip')) b.setAttribute('aria-pressed', String(b === chip))
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
      chips.delete(v)
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

  /** ADR-0083. Programmatic pre-fill for multi groups: adds a chip for any value not yet shown,
   *  presses exactly `values`, and deliberately does NOT fire onChange — onChange means the user
   *  touched the chips, and a pre-fill must never look like that. */
  function set(values) {
    if (!multi) return
    for (const v of values) if (!chips.has(v)) addChip(v)
    selected.clear()
    for (const v of values) selected.add(v)
    for (const [v, chip] of chips) chip.setAttribute('aria-pressed', String(selected.has(v)))
  }

  /** ADR-0083. Removes chips added purely as a preset seed — never a user's own chip or one
   *  from the standing list, since applyPreset only ever passes its own seededExtras here. */
  function remove(values) {
    for (const v of values) {
      if (!chips.has(v)) continue
      selected.delete(v)
      const chip = chips.get(v)
      chips.delete(v)
      ;(chip.closest('[data-chip-item]') || chip).remove()
    }
  }

  return { row, get value() { return currentValue() }, set, remove }
}

function navRow() {
  const row = el('div', 'm-chip-row')
  const history = el('button', 'm-btn')
  history.dataset.variant = 'quiet'
  history.setAttribute('aria-label', 'View session history')
  history.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.5"/><path d="M7 4v3l2 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>'
  history.addEventListener('click', async () => {
    chrome.tabs.create({ url: (await apiBase()) + '/dashboard' })
  })
  const landing = el('button', 'm-btn')
  landing.dataset.variant = 'quiet'
  landing.setAttribute('aria-label', 'Open meant.app')
  landing.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M6 2H2v10h10V8M8 2h4v4M12 2 6 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>'
  landing.addEventListener('click', async () => {
    chrome.tabs.create({ url: (await apiBase()) + '/' })
  })
  row.append(history, landing)
  return row
}

// Top-right header: the popup's own mark glyph beside the (now icon-only) nav row.
// data-popup-header, not a new class — the class contract stays frozen (13 fixed classes
// plus .m-chip/.m-chip-row/.m-companion-*).
function header(mark) {
  const wrap = el('div')
  wrap.dataset.popupHeader = 'true'
  wrap.append(mark, navRow())
  return wrap
}

/** Two labelled presets, a cycle count, then custom (ADR-0081). Custom reveals labelled
 *  work/break inputs plus two more chips (until I stop / no cycles), at-most-one-of-two. The
 *  count applies to the presets and to custom "timed", and is hidden where it means nothing.
 *  `.value` is `{ plannedMinutes, cycle }` directly — the exact shape the Start handler sends
 *  to sw.js, so nothing downstream of this picker needs to change. */
function cycleDurationPicker(lastChoice) {
  const restored = restoreCycle(lastChoice)
  let mode = restored.mode
  let customMode = restored.customMode
  let count = restored.count

  const workLabelText = el('span', null, customMode === 'none' ? 'minutes' : 'work')
  const workLabel = el('label', 'm-meta')
  const workInput = el('input', 'm-chip')
  workInput.type = 'number'
  workInput.min = '1'
  workInput.dataset.chipRole = 'number'
  workInput.value = String(restored.work)
  workLabel.append(workLabelText, workInput)

  const breakLabelText = el('span', null, 'break')
  const breakLabel = el('label', 'm-meta')
  const brkInput = el('input', 'm-chip')
  brkInput.type = 'number'
  brkInput.min = '1'
  brkInput.dataset.chipRole = 'number'
  brkInput.value = String(restored.brk)
  brkInput.disabled = customMode === 'none'
  breakLabel.append(breakLabelText, brkInput)

  const inputsRow = el('div')
  inputsRow.dataset.chipLayout = 'custom'
  inputsRow.append(workLabel, el('span', null, '/'), breakLabel)

  const openChip = el('button', 'm-chip', 'until I stop')
  openChip.type = 'button'
  openChip.setAttribute('aria-pressed', String(customMode === 'open'))
  const noneChip = el('button', 'm-chip', 'no cycles')
  noneChip.type = 'button'
  noneChip.setAttribute('aria-pressed', String(customMode === 'none'))
  const customChipsRow = el('div', 'm-chip-row')
  customChipsRow.append(openChip, noneChip)

  const customRow = el('div')
  customRow.append(inputsRow, customChipsRow)
  customRow.hidden = mode !== 'custom'

  // The count: static text plus −/+ (a stepper, not a dial — ADR-0045 refuses the dial).
  const countText = el('span', 'm-meta')
  const fewer = el('button', 'm-chip', '−')
  fewer.type = 'button'
  fewer.dataset.chipRole = 'step'
  fewer.setAttribute('aria-label', 'Fewer cycles')
  const more = el('button', 'm-chip', '+')
  more.type = 'button'
  more.dataset.chipRole = 'step'
  more.setAttribute('aria-label', 'More cycles')
  const stepper = el('div')
  stepper.dataset.chipLayout = 'count'
  stepper.append(countText, fewer, more)

  function setCount(next) {
    count = clampCount(next)
    countText.textContent = `× ${count} ${count === 1 ? 'cycle' : 'cycles'}`
    fewer.disabled = count <= 1
    more.disabled = count >= MAX_CYCLES
  }
  fewer.addEventListener('click', () => setCount(count - 1))
  more.addEventListener('click', () => setCount(count + 1))
  setCount(count)

  // A count means nothing without an end ("until I stop") or without cycles ("no cycles").
  function syncStepper() {
    stepper.hidden = mode === 'custom' && customMode !== 'timed'
  }

  function setCustomMode(next) {
    customMode = next
    openChip.setAttribute('aria-pressed', String(next === 'open'))
    noneChip.setAttribute('aria-pressed', String(next === 'none'))
    brkInput.disabled = next === 'none'
    workLabelText.textContent = next === 'none' ? 'minutes' : 'work'
    syncStepper()
  }
  openChip.addEventListener('click', () => setCustomMode(customMode === 'open' ? 'timed' : 'open'))
  noneChip.addEventListener('click', () => setCustomMode(customMode === 'none' ? 'timed' : 'none'))
  // Typing in either field is itself a choice of "timed" — editing numbers a pressed
  // chip is ignoring would be a trap. workInput's guard is asymmetric on purpose: under
  // "no cycles" the work field IS the session length, so editing it must not leave "none".
  workInput.addEventListener('input', () => { if (customMode === 'open') setCustomMode('timed') })
  brkInput.addEventListener('input', () => { if (customMode !== 'timed') setCustomMode('timed') })

  const level1 = chipGroup(
    [
      { label: '25 work · 5 break', value: '25/5' },
      { label: '50 work · 10 break', value: '50/10' },
      { label: 'custom', value: 'custom' },
    ],
    { mono: true, value: mode, onChange: (v) => { mode = v; customRow.hidden = v !== 'custom'; syncStepper() } },
  )
  level1.row.dataset.chipLayout = 'paired'
  // Presets on the first line; the count and custom on the second (the owner's layout,
  // 2026-09-23). A zero-height full-width span forces the wrap without a second chipGroup —
  // exclusive single-select has to span all three chips.
  const customChip = level1.row.lastElementChild
  const lineBreak = el('span')
  lineBreak.dataset.chipLayout = 'break'
  level1.row.insertBefore(lineBreak, customChip)
  level1.row.insertBefore(stepper, customChip)
  syncStepper()

  return {
    row: level1.row,
    customRow,
    get value() {
      const w = Number(workInput.value) || 25
      const b = Number(brkInput.value) || 5
      if (level1.value !== 'custom') {
        const [pw, pb] = level1.value.split('/').map(Number)
        return { plannedMinutes: plannedMinutesFor({ work: pw, break: pb, count }), cycle: { work: pw, break: pb, count } }
      }
      if (customMode === 'none') return { plannedMinutes: w, cycle: null }
      if (customMode === 'open') return { plannedMinutes: null, cycle: { work: w, break: b } }
      return { plannedMinutes: plannedMinutesFor({ work: w, break: b, count }), cycle: { work: w, break: b, count } }
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
  field.spellcheck = false

  const [{ lastChoice }, lists] = await Promise.all([
    chrome.storage.local.get('lastChoice'),
    fetchLists(),
  ])
  const knownWorkSites = lists.workSites ?? []
  const distractSites = lists.distractSites ?? []

  // First ever session: 25/5, one cycle (25 min, ADR-0081). A returning session recalls last time's pick.
  const picker = cycleDurationPicker(lastChoice)

  // First ever session: workSites from the API, none pre-selected.
  const workSiteValues = lastChoice ? lastChoice.workSites : []
  const workSiteOptions = [...new Set([...knownWorkSites, ...workSiteValues])].map((d) => ({ label: d, value: d }))
  const workSites = chipGroup(workSiteOptions, {
    multi: true, addable: true, removable: true, value: workSiteValues,
    onRemove: (domain) => removeFromList('work', domain),
    // ADR-0083: a work site picked AFTER the intention was typed must still re-exclude it from
    // the block set — applyPreset reads workSites.value fresh each time it runs.
    onChange: () => applyPreset(currentPresetId),
  })

  // First ever session: blockedDomains defaults to the whole standing distract list.
  const blockedValues = lastChoice ? lastChoice.blockedDomains : distractSites
  const blockedOptions = [...new Set([...distractSites, ...blockedValues])].map((d) => ({ label: d, value: d }))
  const blockingLabel = el('p', 'm-meta', 'what to block')
  // ADR-0083: any user action on these chips freezes the intention's pre-fill for this view.
  let blocksTouched = false
  const blocked = chipGroup(blockedOptions, {
    multi: true,
    addable: true,
    removable: true,
    value: blockedValues,
    onRemove: (domain) => removeFromList('distract', domain),
    onChange: () => { blocksTouched = true },
  })

  // ADR-0083. The intention picks a preset: keyword first, instantly; the AI classifier only when
  // no keyword matched, 800ms after typing stops. Either way it only PRE-FILLS the chips — the
  // first manual toggle freezes them, and Start never waits for an answer.
  let started = false
  let aiTimer = null
  const aiAnswers = new Map() // settled intention text -> preset id | null, this view's lifetime
  const presetNote = el('p', 'm-meta', '')
  presetNote.hidden = true

  // ADR-0083: set() only ever adds chips, never removes — so a preset's seed-only extras
  // (below) must be tracked and cleared before the next preset seeds its own, or they'd
  // accumulate as permanent unpressed ghosts across an intention edit within the same view.
  const initialBlockedDomains = new Set(blockedOptions.map((o) => o.value))
  let seededExtras = []
  let currentPresetId = null // ADR-0083: last preset id applied (or null), so a later work-site
                              // change can re-run the same preset with fresh workSites.value

  function applyPreset(id) {
    currentPresetId = id
    if (blocksTouched || started) return
    if (seededExtras.length) {
      blocked.remove(seededExtras)
      seededExtras = []
    }
    if (!id) {
      blocked.set(blockedValues)
      presetNote.hidden = true
      return
    }
    const preset = PRESETS[id]
    // Seed a chip for every domain this preset would normally touch — including one the
    // intention names, like instagram.com in PRESETS.admin.block — so it exists to be shown
    // unpressed below. set() never removes a chip, only adds missing ones and re-presses the
    // full accumulated set, so this is safe to immediately re-press to the real, adjusted set;
    // both calls are synchronous, before the next paint — no flicker, nothing animates.
    seededExtras = preset.block.filter((d) => !initialBlockedDomains.has(d))
    blocked.set(preset.block)
    blocked.set(presetBlockSet({ standing: distractSites, preset, workSites: workSites.value, intention: field.value }))
    presetNote.textContent = `${preset.label} preset`
    presetNote.hidden = false
  }

  field.addEventListener('input', () => {
    clearTimeout(aiTimer)
    const text = field.value.trim()
    const byKeyword = matchPreset(text)
    if (byKeyword || text.length < 3) return applyPreset(byKeyword)
    if (aiAnswers.has(text)) return applyPreset(aiAnswers.get(text))
    applyPreset(null)
    aiTimer = setTimeout(async () => {
      const res = await post('/api/presets/classify', { intention: text }, { queue: false })
      const id = res.ok && typeof res.data?.preset === 'string' && PRESETS[res.data.preset] ? res.data.preset : null
      aiAnswers.set(text, id)
      if (field.value.trim() === text) applyPreset(id)
    }, 800)
  })

  // data-chip-layout, not a class: the class contract is frozen at 13 fixed classes plus
  // .m-chip/.m-chip-row/.m-companion-* — attribute values stay extensible, class names don't.
  const whereGroup = el('div')
  whereGroup.dataset.chipLayout = 'group'
  whereGroup.append(el('p', 'm-meta', 'where it happens'), workSites.row)
  const blockGroup = el('div')
  blockGroup.dataset.chipLayout = 'group'
  blockGroup.append(blockingLabel, presetNote, blocked.row)
  const siteCluster = el('div')
  siteCluster.dataset.chipLayout = 'cluster'
  siteCluster.append(whereGroup, blockGroup)

  const start = el('button', 'm-btn', 'Start')
  start.dataset.variant = 'primary'
  start.addEventListener('click', async () => {
    start.disabled = true
    clearTimeout(aiTimer) // ADR-0083: a pending classify call answers nothing Start would use
    started = true // ADR-0083: a classifier answer landing after this must change nothing
    const { plannedMinutes, cycle: cycleValue } = picker.value
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
      started = false
      show(header(mark), label, field, picker.row, picker.customRow, siteCluster, start,
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
    await chrome.storage.local.set({ token: null, deviceId: null, session: null, block: null, pendingReview: null, askPending: false })
    await chrome.action.setBadgeText({ text: '' })
    render()
  })

  show(header(mark), label, field, picker.row, picker.customRow, siteCluster, start, disconnect)
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

  // A single read, not a ticking clock — toolkit §9 refuses "a countdown that ticks".
  // This is phase-remaining time (current work/break block), not session-remaining time —
  // for a multi-cycle session (count > 1) those differ, the session total being the larger,
  // unshown number. blocked.js's own remaining line reads the opposite way: it's the whole
  // session's plannedMinutes, not the current phase — the two screens deliberately answer
  // different questions ("how much of this block is left" vs "how much of this site-block
  // is left"), so don't unify them.
  const phaseLine = phase
    ? el('p', 'm-meta', phase.phase === 'break'
        ? `${elapsedMinutes} min · break, ${phase.remainingMinutes} min left`
        : `${elapsedMinutes} min · ${phase.remainingMinutes} min left`)
    : el('p', 'm-meta', `${elapsedMinutes} min elapsed`)

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
    sentenceNode.spellcheck = false

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

  // The intention's own box doubles as the session's live attention loop: an authored SVG
  // path traced around the pill's existing rounded-rect shape (same 26px corner radius as
  // --m-r-field — this doesn't change the pill's shape, only how its outline is drawn),
  // segmented by which sites the time actually went to. Unconditional — this draws every
  // time, independent of whether a cycle is configured, since it visualizes live attention
  // data, not phase progress. Static only: one requestAnimationFrame measurement frame,
  // gated on document.fonts.ready so a font-swap reflow can't leave the viewBox stale.
  const pillWrap = el('div')
  pillWrap.dataset.timerPill = 'true'
  pillWrap.append(sentenceNode)

  const merged = withOpenSlice(session.tally, session.slice, Date.now())
  const segments = toSegments(merged)

  const attentionRows = segments
    .filter((s) => s.kind.startsWith('attention'))
    .map((s) => {
      const row = el('div', 'm-row')
      const bar = el('span', 'm-row-bar')
      bar.dataset.kind = s.kind
      const domain = el('p', 'm-row-domain', s.domain)
      const minutes = s.flex > 0 ? Math.max(1, Math.round(s.flex / 60)) : 0
      const figure = el('p', 'm-row-figure', `${minutes} min`)
      row.append(bar, domain, figure)
      return row
    })

  const blockingLabel = session.blockedDomains?.length ? el('p', 'm-meta', 'blocking') : null
  const blockedRows = (session.blockedDomains ?? []).map((domain) => {
    const row = el('div', 'm-row')
    const bar = el('span', 'm-row-bar')
    bar.dataset.kind = 'step-open' // neutral outline swatch — blocked domains are config, not measured attention
    const label = el('p', 'm-row-domain', domain)
    row.append(bar, label)
    return row
  })
  const blockedRowsContainer = blockedRows.length > 0 ? el('div') : null
  if (blockedRowsContainer) {
    blockedRowsContainer.dataset.scrollList = 'true'
    blockedRowsContainer.append(...blockedRows)
  }

  document.fonts.ready.then(() => requestAnimationFrame(() => {
    pillWrap.dataset.loop = 'on' // CSS makes the border transparent without changing clientWidth/Height
    const width = pillWrap.clientWidth
    const height = pillWrap.clientHeight

    const SVG_NS = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
    svg.setAttribute('aria-hidden', 'true') // the figures beside it carry the same information
    svg.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; pointer-events:none;'

    // Clockwise from top-dead-centre. Same rounded-rect geometry as --m-r-field (26px), so
    // the pill's shape does not change — only where the outline's zero point is and how it
    // is painted. inset = 1 (half the 2px stroke), r = 26.
    const inset = 1
    const r = 26
    function loopPath() {
      const x = inset, y = inset
      const w = width - inset * 2, h = height - inset * 2
      const rr = Math.min(r, w / 2, h / 2) // matches the rx/ry clamp <rect> would apply
      return [
        `M ${x + w / 2} ${y}`,
        `H ${x + w - rr}`,
        `A ${rr} ${rr} 0 0 1 ${x + w} ${y + rr}`,
        `V ${y + h - rr}`,
        `A ${rr} ${rr} 0 0 1 ${x + w - rr} ${y + h}`,
        `H ${x + rr}`,
        `A ${rr} ${rr} 0 0 1 ${x} ${y + h - rr}`,
        `V ${y + rr}`,
        `A ${rr} ${rr} 0 0 1 ${x + rr} ${y}`,
        `H ${x + w / 2}`,
      ].join(' ')
      // No `Z` — the path already returns to its start point, and a `Z` would add a
      // zero-length close that some engines count in getTotalLength().
    }
    const d = loopPath()

    // A throwaway path just to measure the real rendered perimeter — getTotalLength()
    // gives the exact number for THIS pill's real, measured size (it can wrap to two
    // lines), no manual perimeter formula needed.
    const measurer = document.createElementNS(SVG_NS, 'path')
    measurer.setAttribute('d', d)
    svg.append(measurer)
    const L = measurer.getTotalLength()
    measurer.remove()

    // §3.1 — the loop's full length means the session's planned duration. "until I stop"
    // (plannedMinutes == null) has no target, so the loop just fills with real proportions
    // (denom = measured). Math.max(..., measured) clamps a session that overruns its plan
    // instead of letting segments run past L.
    const measured = segments.reduce((sum, s) => sum + s.flex, 0)
    const denom = session.plannedMinutes == null
      ? Math.max(measured, 1)
      : Math.max(session.plannedMinutes * 60, measured)

    const PAINT = {
      'attention-1': 'var(--m-clay)',
      'attention-2': 'var(--m-clay-2)',
      'attention-3': 'var(--m-clay-3)',
      remainder: 'var(--m-edge)',
    }
    const GAP = 3 // px of path length — matches .m-mark:not(:empty) { gap: 3px }
    const MIN_ARC = 0.02 * L // item D — never render nothing at t≈0
    const MIN_DRAWN = 8 // below this a segment cannot read as a segment

    function arc(kind, start, len) {
      const p = document.createElementNS(SVG_NS, 'path')
      p.setAttribute('d', d) // the same authored d for every segment
      p.dataset.kind = kind // debuggable, and greppable against .m-row-bar
      p.style.fill = 'none'
      p.style.stroke = PAINT[kind]
      p.style.strokeWidth = '2' // --m-stroke-loud — the smallest weight that holds --m-clay-3
      p.style.strokeLinecap = 'butt' // round caps would eat into the 3px gaps
      p.style.strokeDasharray = `${len} ${L - len}` // sums to exactly L: a segment crossing
      p.style.strokeDashoffset = `${(L - start) % L}` // the seam wraps instead of clipping
      svg.append(p)
    }

    // 1. shares, in path-length units — away/break fold into the remainder (see PAINT: no
    //    away/break entry — a hatch can't survive a 2px stroke, and "away is a hatch, never
    //    solid grey" rules out painting it solid; the full away/break vocabulary lives on
    //    the outcome screen's 14px band instead, Task 6).
    const shares = segments
      .filter((s) => s.kind.startsWith('attention'))
      .map((s) => ({ kind: s.kind, len: (s.flex / denom) * L }))
      .filter((s) => s.len >= MIN_DRAWN) // a sub-8px sliver is noise; its time falls into
                                          // the remainder, unpainted

    // 2. the floor (item D) — first segment only, never a permanent offset once real
    //    progress exceeds it.
    if (shares.length === 0) shares.push({ kind: 'attention-1', len: MIN_ARC }) // cold start
    else shares[0].len = Math.max(shares[0].len, MIN_ARC)

    // 3. lay them out clockwise from 0 (= top-dead-centre), gaps carved out of each
    //    segment's tail.
    let cursor = 0
    for (const s of shares) {
      arc(s.kind, cursor, Math.max(s.len - GAP, 2))
      cursor += s.len
    }

    // 4. the remainder closes the loop, leaving one final gap before wrapping to top-centre.
    const remainder = L - cursor
    if (remainder > GAP + MIN_DRAWN) arc('remainder', cursor, remainder - GAP)

    pillWrap.append(svg)
  }))

  show(
    header(mark),
    pillWrap,
    phaseLine,
    ...attentionRows,
    ...(blockingLabel ? [blockingLabel] : []),
    ...(blockedRowsContainer ? [blockedRowsContainer] : []),
    stop,
  )
}

/** ADR-0082. The marker, the pending auto-open and the badge always clear together. */
async function clearPending() {
  await chrome.storage.local.remove(['pendingReview', 'askPending'])
  await chrome.action.setBadgeText({ text: '' })
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
      await clearPending()
      render()
    })
    return show(mark, el('p', 'm-meta', "Can't reach it right now."), done)
  }
  if (!res.ok || !res.data) {
    await clearPending()
    return idle()
  }
  const data = res.data

  const nodes = [header(mark)]
  if (data.intention) {
    nodes.push(el('p', 'm-meta', 'You meant to'), el('p', 'm-sentence', data.intention))
  } else {
    nodes.push(el('p', 'm-meta', "You didn't say what you meant to do."))
  }

  const bandSegments = toSegments({
    attention: Object.fromEntries(data.topAttention.map((r) => [r.domain, r.seconds])),
    away: data.awaySeconds,
    break: 0,
  })
  if (bandSegments.length > 0) {
    const band = el('p', 'm-mark')
    band.dataset.state = 'ended'
    band.dataset.band = 'session'
    for (const s of bandSegments) {
      const bar = el('span', 'm-row-bar')
      bar.dataset.kind = s.kind
      bar.style.flex = String(s.flex) // the one legitimate inline style: it IS the data
      band.append(bar)
    }
    nodes.push(band)
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
    nodes.push(yes, notYet)
  } else {
    nodes.push(el('p', 'm-meta', data.outcome === 'yes'
      ? `Good. That's ${data.finished} of ${data.answered}.`
      : 'Noted. It carries over.'))
    const done = el('button', 'm-btn', 'Done')
    done.dataset.variant = 'quiet'
    done.addEventListener('click', async () => {
      await clearPending()
      render()
    })
    nodes.push(done)
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
