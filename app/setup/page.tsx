'use client'

import { useEffect, useState } from 'react'
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

export default function Setup() {
  const router = useRouter()
  const [lists, setLists] = useState<Lists | null>(null)

  useEffect(() => {
    fetch('/api/lists')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setLists)
      .catch(() => setLists({ workSites: [], distractSites: [] }))
  }, [])

  function update(next: Lists) {
    setLists(next)
    fetch('/api/lists', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(next),
    })
  }

  if (!lists) {
    return (
      <div data-surface="setup">
        <p className="m-meta">Loading…</p>
      </div>
    )
  }

  return (
    <div data-surface="setup">
      <ListEditor
        question="Where do you work?"
        hint="The sites your actual work happens on."
        domains={lists.workSites}
        onChange={(workSites) => update({ ...lists, workSites })}
      />
      <ListEditor
        question="What pulls you away?"
        domains={lists.distractSites}
        onChange={(distractSites) => update({ ...lists, distractSites })}
      />
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
