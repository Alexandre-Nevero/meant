'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type FeatureKey = 'companion' | 'judge' | 'coach'
type FeatureSettings = Record<FeatureKey, boolean>

const FEATURES: { key: FeatureKey; label: string; blurb: string }[] = [
  { key: 'companion', label: 'Companion', blurb: 'The small mark that stays on the page while you work.' },
  { key: 'judge', label: 'Judge', blurb: 'Looks back at a finished session and says which sites were the work.' },
  { key: 'coach', label: 'Coach', blurb: 'The chat on your dashboard and ledger.' },
]

// ADR-0087. Turning a feature off costs money too, at app/api/judge/analyze and
// app/api/coach/chat, not just this page — this is the switch, not the enforcement.
function FeatureToggle({
  featureKey,
  label,
  blurb,
  on,
  onChange,
}: {
  featureKey: FeatureKey
  label: string
  blurb: string
  on: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div data-feature={featureKey} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="m-meta">
        {label}. {blurb}
      </span>
      <div className="m-chip-row">
        <button
          type="button"
          className="m-chip"
          aria-pressed={on}
          data-selected={on ? 'true' : undefined}
          onClick={() => onChange(true)}
        >
          On
        </button>
        <button
          type="button"
          className="m-chip"
          aria-pressed={!on}
          data-selected={!on ? 'true' : undefined}
          onClick={() => onChange(false)}
        >
          Off
        </button>
      </div>
    </div>
  )
}

export default function Settings() {
  const [theme, setTheme] = useState<'cream' | 'dark'>('cream')
  const [features, setFeatures] = useState<FeatureSettings | null>(null)
  const [forgetStep, setForgetStep] = useState<'idle' | 'confirm' | 'done'>('idle')
  const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm' | 'working'>('idle')

  useEffect(() => {
    const isDark = document.documentElement.dataset.theme === 'dark'
    setTheme(isDark ? 'dark' : 'cream')

    fetch('/api/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setFeatures({ companion: data.companion, judge: data.judge, coach: data.coach })
      })
      .catch(() => {})
  }, [])

  function switchTheme(nextTheme: 'cream' | 'dark') {
    setTheme(nextTheme)
    if (nextTheme === 'dark') {
      document.documentElement.dataset.theme = 'dark'
      document.cookie = 'meant_theme=dark; path=/; max-age=31536000; SameSite=Lax'
    } else {
      delete document.documentElement.dataset.theme
      document.cookie = 'meant_theme=cream; path=/; max-age=31536000; SameSite=Lax'
    }
  }

  async function setFeature(key: FeatureKey, on: boolean) {
    setFeatures((prev) => (prev ? { ...prev, [key]: on } : prev)) // optimistic — reverted below on failure
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ [key]: on }),
    })
    if (res.ok) setFeatures(await res.json())
    else setFeatures((prev) => (prev ? { ...prev, [key]: !on } : prev))
  }

  async function confirmForget() {
    const res = await fetch('/api/me/forget', { method: 'POST' })
    if (res.ok) setForgetStep('done')
  }

  async function confirmDelete() {
    setDeleteStep('working')
    const res = await fetch('/api/me', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ confirm: 'delete' }),
    })
    if (res.ok) {
      window.location.href = '/'
    } else {
      setDeleteStep('confirm')
    }
  }

  return (
    <div data-surface="settings">
      <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h1 className="m-sentence" style={{ margin: 0 }}>Appearance</h1>
        <p className="m-meta">MEANT is designed for cream paper. Dark mode is an optional fallback.</p>
        <div className="m-chip-row" style={{ marginTop: 6 }}>
          <button
            type="button"
            className="m-chip"
            data-selected={theme === 'cream' ? 'true' : undefined}
            onClick={() => switchTheme('cream')}
          >
            Cream (default)
          </button>
          <button
            type="button"
            className="m-chip"
            data-selected={theme === 'dark' ? 'true' : undefined}
            onClick={() => switchTheme('dark')}
          >
            Dark
          </button>
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 className="m-sentence" style={{ margin: 0 }}>Features</h2>
        <p className="m-meta">Turn any of these off. The change applies the next time it would run.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {FEATURES.map(({ key, label, blurb }) => (
            <FeatureToggle
              key={key}
              featureKey={key}
              label={label}
              blurb={blurb}
              on={features ? features[key] : true}
              onChange={(next) => setFeature(key, next)}
            />
          ))}
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 className="m-sentence" style={{ margin: 0 }}>Configuration</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Link className="m-meta" href="/setup">
            Work &amp; distraction sites &rarr;
          </Link>
          <Link className="m-meta" href="/pair">
            Pair browser extension &rarr;
          </Link>
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 className="m-sentence" style={{ margin: 0 }}>Your data</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p className="m-meta">
            Forget erases what MEANT has worked out about you: what it remembers about sites,
            the sites you marked as not the work, and the judge&rsquo;s verdicts. Your sessions
            and answers stay. This can&rsquo;t be undone.
          </p>
          {forgetStep === 'idle' && (
            <button type="button" className="m-btn" data-variant="quiet" onClick={() => setForgetStep('confirm')}>
              Forget what you know about me
            </button>
          )}
          {forgetStep === 'confirm' && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="m-btn" data-variant="primary" onClick={confirmForget}>
                Yes, forget it
              </button>
              <button type="button" className="m-btn" data-variant="quiet" onClick={() => setForgetStep('idle')}>
                Cancel
              </button>
            </div>
          )}
          {forgetStep === 'done' && <p className="m-meta">Done. MEANT has forgotten it.</p>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p className="m-meta">
            Delete erases your account and everything in it: every session, every answer, and
            everything MEANT learned. This can&rsquo;t be undone.
          </p>
          {deleteStep === 'idle' && (
            <button type="button" className="m-btn" data-variant="quiet" onClick={() => setDeleteStep('confirm')}>
              Delete account
            </button>
          )}
          {(deleteStep === 'confirm' || deleteStep === 'working') && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="m-btn"
                data-variant="primary"
                disabled={deleteStep === 'working'}
                onClick={confirmDelete}
              >
                Delete for good
              </button>
              <button
                type="button"
                className="m-btn"
                data-variant="quiet"
                disabled={deleteStep === 'working'}
                onClick={() => setDeleteStep('idle')}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
