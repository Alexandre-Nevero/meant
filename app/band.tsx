import type { Segment } from '@/lib/band'

export function Band({ segments, state = 'ended' }: { segments: Segment[]; state?: 'ended' | 'running' }) {
  return (
    <p className="m-mark" data-state={state}>
      {segments.map((s, i) => (
        <span key={i} className="m-row-bar" data-kind={s.kind} style={{ flex: s.flex }} />
      ))}
    </p>
  )
}
