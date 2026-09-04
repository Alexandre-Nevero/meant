import { post, apiBase } from './api.js'
import { isEditable } from './lib/sentence-lock.js'
import { normalizeDomain } from './lib/normalize-domain.js'

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
 *  — the site rows' pool isn't fixed ahead of time. `onChange(value)` fires after every click
 *  or add. Keeps the `<button aria-pressed>` pattern (design.md §8). */
function chipGroup(options, { mono = false, multi = false, value, addable = false, onChange } = {}) {
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
    row.insertBefore(chip, plusButton)
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
      input.placeholder = 'domain.com'
      input.style.width = '96px'
      plusButton.replaceWith(input)
      input.focus()

      // Blur fires after Escape/Enter replace the input (removing a focused element blurs
      // it), so `settled` stops that from double-committing or overriding a discard.
      let settled = false
      const commit = () => {
        if (settled) return
        settled = true
        const v = normalizeDomain(input.value)
        input.replaceWith(plusButton)
        if (v && !selected.has(v)) {
          selected.add(v)
          addChip(v)
          if (onChange) onChange(currentValue())
        }
      }
      const discard = () => {
        if (settled) return
        settled = true
        input.replaceWith(plusButton)
      }

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') discard()
        else if (e.key === 'Enter') commit()
      })
      // Clicking Start (or anywhere else) without pressing Enter first must not silently
      // drop what was typed — blur commits exactly like Enter. Only Escape discards.
      input.addEventListener('blur', commit)
    })
    row.append(plusButton)
  }

  return { row, get value() { return currentValue() } }
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
  const workSites = chipGroup(workSiteOptions, { multi: true, addable: true, value: workSiteValues })

  // First ever session: blockedDomains defaults to the whole standing distract list.
  const blockedValues = lastChoice ? lastChoice.blockedDomains : distractSites
  const blockedOptions = [...new Set([...distractSites, ...blockedValues])].map((d) => ({ label: d, value: d }))
  const blockingLabel = el('p', 'm-meta', `blocking ${blockedValues.length}`)
  const blocked = chipGroup(blockedOptions, {
    multi: true,
    addable: true,
    value: blockedValues,
    onChange: (v) => { blockingLabel.textContent = `blocking ${v.length}` },
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
    // Bound to this click, the only user gesture in the flow — chrome.sidePanel.open()
    // requires one, and it's lost if this goes through a message to the service worker.
    const { companionEnabled } = await chrome.storage.local.get('companionEnabled')
    if (companionEnabled !== false) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab) chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {})
    }
    render()
  })

  show(mark, label, field, duration.row, cycle.row, cycle.customRow, siteCluster, start)
}

function running(session) {
  const mark = el('p', 'm-mark', '')
  mark.dataset.state = 'running'

  const startedAt = new Date(session.startedAt).getTime()
  const elapsedMinutes = Math.floor((Date.now() - startedAt) / 60000)
  const elapsed = el('p', 'm-meta', `${elapsedMinutes} min elapsed`)

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

  show(mark, sentenceNode, elapsed, stop)
}

async function render() {
  const { token, session, unpairedReason } = await chrome.storage.local.get(['token', 'session', 'unpairedReason'])
  if (!token) {
    if (unpairedReason) await chrome.storage.local.remove('unpairedReason')
    return unpaired(unpairedReason)
  }
  if (session) return running(session)
  await idle()
}

render()
