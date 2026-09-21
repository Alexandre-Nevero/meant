'use client'

import React, { useState, useEffect, useRef } from 'react'

interface CompanionPetProps {
  intention?: string | null
  onClick?: () => void
}

interface ChatMessage {
  id: string
  role: 'coach' | 'user'
  content: string
  timestamp: string
}

const QUICK_PROMPTS = [
  'Where did my time go?',
  'Which sites broke my attention?',
  'Help me formulate my next intention',
  'Review my Not yet outcomes',
]

/**
 * The Tomato Companion Pet & AI Reflection Coach.
 * Sits anchored in the bottom-right of the workspace.
 * Features:
 * - Authentic warm cream silhouette sprite
 * - Clockwise sequential clay ripple on hover (Band Wake)
 * - Emil Kowalski physics: buoyant lift with cubic-bezier(0.23, 1, 0.32, 1) and shadow softening
 * - Restrained intention speech bubble
 * - Slide-over AI Coach Chat Drawer with real-time focus reflection and contextual insights
 */
export function CompanionPet({ intention, onClick }: CompanionPetProps) {
  const [showDrawer, setShowDrawer] = useState(false)
  const [inputMessage, setInputMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'coach',
      content:
        "Hello. I've been observing your focus sessions silently. When you are ready to pause and reflect on your attention, habits, or next intention, I'm here.",
      timestamp: 'Now',
    },
  ])

  const chatEndRef = useRef<HTMLDivElement>(null)
  const displayIntention = intention?.trim() || 'finish the current work'
  const [isReceiptActive, setIsReceiptActive] = useState(false)
  const receiptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (showDrawer) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, showDrawer, isTyping])

  useEffect(() => {
    return () => {
      if (receiptTimerRef.current) clearTimeout(receiptTimerRef.current)
    }
  }, [])

  const handleClick = () => {
    setIsReceiptActive(true)
    if (receiptTimerRef.current) clearTimeout(receiptTimerRef.current)
    receiptTimerRef.current = setTimeout(() => {
      setIsReceiptActive(false)
    }, 420)

    if (onClick) {
      onClick()
    } else {
      setShowDrawer((prev) => !prev)
    }
  }

  const sendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? inputMessage).trim()
    if (!text || isTyping) return

    const now = new Date()
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: timeStr,
    }

    setMessages((prev) => [...prev, userMsg])
    if (!textToSend) setInputMessage('')
    setIsTyping(true)

    try {
      const res = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role === 'coach' ? 'assistant' : 'user',
            content: m.content,
          })),
          intention: displayIntention,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const coachMsg: ChatMessage = {
          id: `coach-${Date.now()}`,
          role: 'coach',
          content: data.reply || "I've noted your intention. Ready whenever you want to begin another block.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
        setMessages((prev) => [...prev, coachMsg])
      } else {
        throw new Error('API response not ok')
      }
    } catch {
      // Fallback response if offline or cold compile
      const fallbackMsg: ChatMessage = {
        id: `coach-${Date.now()}`,
        role: 'coach',
        content: `I'm tracking your attention for "${displayIntention}". Focus is strongest when you protect the first 40 minutes and keep away-tab drift to zero.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, fallbackMsg])
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <>
      <div
        className="m-web-companion-actor"
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label="MEANT Companion — click to open AI coach chat"
        title={displayIntention}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick()
          }
        }}
      >
        <div className="m-companion-body-wrap" data-returning={isReceiptActive ? 'true' : undefined}>
          <div className="m-companion-ring" aria-hidden="true" />
          <img
            className="m-companion-img"
            src="/assets/the-tomato-transparent.png"
            alt="MEANT Tomato Companion"
            width={77}
            height={77}
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
          <aside className="m-coach-drawer" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="m-coach-drawer-head">
              <div className="m-coach-head-left">
                <img
                  src="/assets/the-tomato-transparent.png"
                  alt=""
                  width={28}
                  height={28}
                  style={{ borderRadius: '50%' }}
                />
                <div>
                  <h3 className="m-coach-title">MEANT Coach</h3>
                  <span className="m-coach-badge">● Session Aware</span>
                </div>
              </div>
              <button
                className="m-coach-close"
                onClick={() => setShowDrawer(false)}
                aria-label="Close reflection drawer"
              >
                &times;
              </button>
            </div>

            {/* Current Session Banner */}
            <div className="m-coach-context-bar">
              <span className="m-coach-context-label">CURRENT INTENTION</span>
              <span className="m-coach-context-val">{displayIntention}</span>
            </div>

            {/* Scrollable Chat Feed */}
            <div className="m-coach-feed">
              {messages.map((m) => (
                <div key={m.id} className={`m-coach-msg-row ${m.role}`}>
                  {m.role === 'coach' && (
                    <img
                      src="/assets/the-tomato-transparent.png"
                      alt="Coach"
                      className="m-coach-avatar-small"
                      width={22}
                      height={22}
                    />
                  )}
                  <div className="m-coach-bubble">
                    <div className="m-coach-text">
                      {m.content.split('\n\n').map((para, idx) => (
                        <p key={idx} style={{ margin: idx === 0 ? 0 : '8px 0 0' }}>
                          {para}
                        </p>
                      ))}
                    </div>
                    <span className="m-coach-time">{m.timestamp}</span>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="m-coach-msg-row coach">
                  <img
                    src="/assets/the-tomato-transparent.png"
                    alt="Coach"
                    className="m-coach-avatar-small"
                    width={22}
                    height={22}
                  />
                  <div className="m-coach-bubble typing">
                    <span className="m-dot-pulse" />
                    <span className="m-dot-pulse" />
                    <span className="m-dot-pulse" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Suggested Quick Prompts */}
            <div className="m-coach-prompts">
              <span className="m-coach-prompts-label">Suggested reflection:</span>
              <div className="m-coach-chip-list">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="m-coach-chip"
                    onClick={() => sendMessage(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Bar */}
            <form
              className="m-coach-input-bar"
              onSubmit={(e) => {
                e.preventDefault()
                sendMessage()
              }}
            >
              <input
                type="text"
                className="m-coach-input"
                placeholder="Ask coach about your focus..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
              />
              <button
                type="submit"
                className="m-coach-send-btn"
                disabled={!inputMessage.trim() || isTyping}
                aria-label="Send message"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>
          </aside>
        </div>
      )}
    </>
  )
}
