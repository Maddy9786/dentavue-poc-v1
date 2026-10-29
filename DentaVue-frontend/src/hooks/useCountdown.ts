'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Counts down to zero, in seconds.
 *
 * Derives from a deadline instead of decrementing a number each tick. Interval
 * callbacks are throttled in background tabs and drift over time, so a naive
 * `n => n - 1` under-counts: leave the tab for a minute and a "5:00" code still
 * claims four minutes left. Reading from a deadline stays correct however often
 * — or unreliably — the tick actually fires.
 *
 * The deadline is a ref set inside an effect, never during render: Date.now() is
 * impure, so calling it while rendering ties the value to how many times React
 * happens to render (react-hooks/purity).
 *
 * The effect only starts the interval; it sets no state. Resetting `remaining`
 * belongs in restart(), an event handler, so a resend does not cost an extra
 * render pass (react-hooks/set-state-in-effect).
 *
 * `cycle` exists so restart() can re-run the effect. Without it the interval —
 * which clears itself on reaching zero — would never start again, and a resent
 * code would sit at a frozen 0:00.
 */
export function useCountdown(seconds: number) {
  const deadlineRef = useRef<number | null>(null)
  const [target, setTarget] = useState(seconds)
  const [cycle, setCycle] = useState(0)
  const [remaining, setRemaining] = useState(seconds)

  const tick = useCallback(() => {
    const deadline = deadlineRef.current
    if (deadline === null) return null
    const left = Math.max(0, Math.round((deadline - Date.now()) / 1000))
    setRemaining(left)
    return left
  }, [])

  useEffect(() => {
    deadlineRef.current = Date.now() + target * 1000

    const id = setInterval(() => {
      if (tick() === 0) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
  }, [target, cycle, tick])

  /** Begins a fresh countdown, restarting the interval even if it had expired. */
  const restart = useCallback((nextSeconds: number) => {
    setTarget(nextSeconds)
    setRemaining(nextSeconds)
    setCycle((c) => c + 1)
  }, [])

  return { remaining, isExpired: remaining === 0, restart }
}

/** Formats seconds as `m:ss` — 299 → "4:59". */
export function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
