'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function Settings() {
  const [theme, setTheme] = useState<'cream' | 'dark'>('cream')

  useEffect(() => {
    const isDark = document.documentElement.dataset.theme === 'dark'
    setTheme(isDark ? 'dark' : 'cream')
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
    </div>
  )
}
