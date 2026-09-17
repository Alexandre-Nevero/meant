'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { normalizeDomain } from '@/lib/domains'

type Lists = { workSites: string[]; distractSites: string[] }

function ListEditor({
  question,
  hint,
  domains,
  onChange,
}: {
  question: string
  hint?: string
  domains: string[]
  onChange: (domains: string[]) => void
}) {
  const [value, setValue] = useState('')

  function add() {
    const domain = normalizeDomain(value)
    if (!domain || domains.includes(domain)) return
    onChange([...domains, domain])
    setValue('')
  }

  function remove(domain: string) {
    onChange(domains.filter((d) => d !== domain))
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p className="m-sentence">{question}</p>
      {hint && <p className="m-meta">{hint}</p>}
      <input
        className="m-field"
        placeholder="add a site and press enter"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add()
          }
        }}
      />
      {domains.length > 0 && (
        <div className="m-chip-row">
          {domains.map((domain) => (
            <button
              key={domain}
              type="button"
              className="m-chip"
              aria-label={`Remove ${domain}`}
              onClick={() => remove(domain)}
            >
              {domain} ×
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

type Loaded =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; lists: Lists }

export default function Setup() {
  const router = useRouter()
  const [state, setState] = useState<Loaded>({ status: 'loading' })
  const [saveFailed, setSaveFailed] = useState(false)
  // Two edits in flight: without a sequence number, a slow failing PUT can roll back a later
  // successful one. Only the newest response is allowed to act.
  const seq = useRef(0)

  function load() {
    // React's dev-mode double-invoke of mount effects fires load() twice. Guard with the same
    // seq ref as update(): a late-resolving duplicate GET must not clobber state a newer load()
    // or update() has since moved past — that stale overwrite is the exact class of data loss
    // this task fixes, just arriving through a second read instead of a slow write.
    const mine = ++seq.current
    setState({ status: 'loading' })
    fetch('/api/lists')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      // Loading, loaded and failed are three states, not two. #42: catching a read failure
      // into an empty list told the user they had configured nothing, and then let them save
      // that over the real thing. There is no history and no soft delete, so it was final.
      .then((lists: Lists) => {
        if (seq.current !== mine) return
        setState({ status: 'ready', lists })
      })
      .catch(() => {
        if (seq.current !== mine) return
        setState({ status: 'failed' })
      })
  }

  useEffect(load, [])

  function update(next: Lists, previous: Lists) {
    const mine = ++seq.current
    setSaveFailed(false)
    setState({ status: 'ready', lists: next })
    fetch('/api/lists', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(next),
    })
      .then((r) => {
        if (r.ok || seq.current !== mine) return
        // The optimistic chip is a claim the server did not honour. Withdraw it.
        setState({ status: 'ready', lists: previous })
        setSaveFailed(true)
      })
      .catch(() => {
        if (seq.current !== mine) return
        setState({ status: 'ready', lists: previous })
        setSaveFailed(true)
      })
  }

  if (state.status === 'loading') {
    return (
      <div data-surface="setup">
        <p className="m-meta">Loading…</p>
      </div>
    )
  }

  if (state.status === 'failed') {
    return (
      <div data-surface="setup">
        <p className="m-meta" role="alert">Your sites didn&rsquo;t load. Nothing here has been changed.</p>
        <button className="m-btn" data-variant="quiet" onClick={load}>Try again</button>
      </div>
    )
  }

  const { lists } = state

  return (
    <div data-surface="setup">
      <ListEditor
        question="Where do you work?"
        hint="The sites your actual work happens on."
        domains={lists.workSites}
        onChange={(workSites) => update({ ...lists, workSites }, lists)}
      />
      <ListEditor
        question="What pulls you away?"
        domains={lists.distractSites}
        onChange={(distractSites) => update({ ...lists, distractSites }, lists)}
      />
      {saveFailed && <p className="m-meta" role="alert">That didn&rsquo;t save. Nothing was changed.</p>}
      <div style={{ display: 'flex', gap: 14 }}>
        <button className="m-btn" data-variant="primary" onClick={() => router.push('/dashboard')}>
          Done
        </button>
        <button className="m-btn" data-variant="quiet" onClick={() => router.push('/dashboard')}>
          skip for now
        </button>
      </div>
    </div>
  )
}
