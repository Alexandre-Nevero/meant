// ADR-0084. Pure — no chrome.*, no Date.now(). One session, several tasks: chrome.storage's
// `session` is the ACTIVE task (so every listener keeps working unchanged), and the block parks
// the others, each stamped with the moment it stopped being active.
import { emptySlice } from './attribution.js'

export const MAX_TASKS = 4

/** Time a task sat inactive, as one `paused` event; null under one whole second. */
export function pausedEvent(sinceMs, atMs) {
  const seconds = Math.floor(Math.max(0, atMs - sinceMs) / 1000)
  if (seconds <= 0) return null
  return { kind: 'paused', domain: null, seconds, at: new Date(atMs).toISOString() }
}

function park(block, active, atMs) {
  return { ...block, tasks: [...block.tasks, { ...active, pausedAt: atMs }] }
}

/** The caller has already closed `active`'s slice. `task` shares the block's startedAt, so the
 *  time before it existed is inactive time and is accounted as paused, not as unrecorded. */
export function addTask(block, active, task, atMs) {
  if (1 + block.tasks.length >= MAX_TASKS) return null
  return {
    block: park(block, active, atMs),
    active: task,
    paused: pausedEvent(Date.parse(task.startedAt), atMs),
  }
}

/** The caller has already closed `active`'s slice. The resumed task starts a fresh slice: its
 *  old one ended when it was parked, and crediting the gap to its last site would be a lie. */
export function switchTask(block, active, targetId, atMs) {
  const target = block.tasks.find((t) => t.sessionId === targetId)
  if (!target) return null
  const { pausedAt, ...resumed } = target
  return {
    block: park({ ...block, tasks: block.tasks.filter((t) => t !== target) }, active, atMs),
    active: { ...resumed, slice: emptySlice(atMs), dwellSince: atMs },
    paused: pausedEvent(pausedAt, atMs),
  }
}

/** At the end, each parked task's last stretch of inactivity. */
export function closingEvents(block, atMs) {
  return (block?.tasks ?? [])
    .map((t) => ({ sessionId: t.sessionId, event: pausedEvent(t.pausedAt, atMs) }))
    .filter((e) => e.event !== null)
}

export function attendedSeconds(task) {
  return Object.values(task?.tally?.attention ?? {}).reduce((sum, s) => sum + s, 0)
}
