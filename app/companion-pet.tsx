'use client'

import React, { useState } from 'react'

interface CompanionPetProps {
  intention?: string | null
  onClick?: () => void
}

/**
 * The Tomato Companion Pet (Codex Pet Style).
 * Sits anchored in the bottom-right of the workspace.
 * Features:
 * - Authentic warm cream silhouette sprite
 * - Clockwise sequential clay ripple on hover (Band Wake)
 * - Emil Kowalski physics: buoyant lift with cubic-bezier(0.23, 1, 0.32, 1) and shadow softening
 * - Restrained intention speech bubble (strictly neutral user intent, zero motivational copy)
 */
export function CompanionPet({ intention, onClick }: CompanionPetProps) {
  const [showDrawer, setShowDrawer] = useState(false)
  const displayIntention = intention?.trim() || 'finish the current work'

  const handleClick = () => {
    if (onClick) {
      onClick()
    } else {
      setShowDrawer(prev => !prev)
    }
  }

  return (
    <>
      <div
        className="m-web-companion-actor"
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label="MEANT Companion — click to open reflection drawer"
        title={displayIntention}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick()
          }
        }}
      >
        <div className="m-companion-body-wrap">
          <img
            className="m-companion-img"
            src="/assets/the-tomato-transparent.png"
            alt="MEANT Tomato Companion"
            width={64}
            height={64}
          />
          <svg className="m-band-overlay-svg" viewBox="0 0 200 200" aria-hidden="true">
            <path className="m-ripple-seg m-ripple-seg-1" d="M 32 118 A 74 20 0 0 0 54 125" fill="none" stroke="#FFA380" strokeWidth="10" strokeLinecap="round" />
            <path className="m-ripple-seg m-ripple-seg-2" d="M 58 126 A 74 20 0 0 0 84 133" fill="none" stroke="#FFA380" strokeWidth="10" strokeLinecap="round" />
            <path className="m-ripple-seg m-ripple-seg-3" d="M 88 134 A 74 20 0 0 0 114 136" fill="none" stroke="#FFA380" strokeWidth="10" strokeLinecap="round" />
            <path className="m-ripple-seg m-ripple-seg-4" d="M 118 136 A 74 20 0 0 0 144 134" fill="none" stroke="#FFA380" strokeWidth="10" strokeLinecap="round" />
          </svg>
        </div>

        <div className="m-intention-speech-bubble" aria-hidden="true">
          {displayIntention}
        </div>
      </div>

      {showDrawer && (
        <div className="m-coach-drawer-overlay" onClick={() => setShowDrawer(false)}>
          <aside className="m-coach-drawer" onClick={e => e.stopPropagation()}>
            <div className="m-coach-drawer-head">
              <div className="m-coach-head-left">
                <span className="m-mark" data-state="ended" aria-hidden="true" />
                <h3 className="m-coach-title">MEANT Coach</h3>
              </div>
              <button
                className="m-coach-close"
                onClick={() => setShowDrawer(false)}
                aria-label="Close reflection drawer"
              >
                &times;
              </button>
            </div>
            <div className="m-coach-drawer-body">
              <p className="m-coach-intro">
                The companion sits with you while you work. When you are ready to reflect, the coach reasons from your logged sessions and attention patterns.
              </p>
              <div className="m-coach-status-box">
                <p className="m-coach-label">CURRENT INTENTION</p>
                <p className="m-coach-intent-val">{displayIntention}</p>
              </div>
              <div className="m-coach-actions">
                <a className="m-coach-btn" href="/settings">
                  Companion Settings
                </a>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
