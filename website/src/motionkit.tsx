import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/** ── app-motion: the shared clock and frame every deterministic island runs on ───────────────
 *
 *  These islands are the HeroPhone method applied to the v2 app (canon §27/§28): the real
 *  component's look, rebuilt in code, walked by ONE rAF clock through a beat script that is
 *  editable line by line — never a baked recording. The scripts and their fidelity stills live in
 *  `public/assets/app-motion/BEATS.md`; when an island and a still disagree, the still is right.
 *
 *  THE ISLAND IS NOT A VIDEO AND IS NOT A GIF, so it obeys the three things a video cannot:
 *    · `prefers-reduced-motion: reduce` holds the settled frame and starts no timer at all
 *    · an island below the fold runs no clock (IntersectionObserver), and neither does a
 *      background tab (visibilitychange) — the same gating HeroPhone has carried since it shipped
 *    · every visible string is the app's own, verbatim (BEATS.md's one rule)
 */

/** the ONLY easing the v2 app declares on a river row, and therefore the curve every island
 *  transition takes: `cubic-bezier(0.2, 0.8, 0.4, 1)` (BEATS.md, Measured constants). */
export const APP_EASE = 'cubic-bezier(0.2, 0.8, 0.4, 1)'

export const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v)
/** 0 before `a`, 1 after `b`, linear between — the segment helper the hero phone uses. */
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a))

/** the app curve sampled in JS, for the handful of values that are interpolated per-frame rather
 *  than handed to a CSS transition (Newton on the x-polynomial; 4 steps is exact to <0.1%). */
export function appEase(t: number): number {
  const x = clamp(t)
  const cx = (u: number) => 3 * u * (1 - u) * (1 - u) * 0.2 + 3 * u * u * (1 - u) * 0.4 + u * u * u
  const cy = (u: number) => 3 * u * (1 - u) * (1 - u) * 0.8 + 3 * u * u * (1 - u) * 1 + u * u * u
  let u = x
  for (let i = 0; i < 4; i++) {
    const d = (cx(Math.min(1, u + 1e-3)) - cx(Math.max(0, u - 1e-3))) / 2e-3
    if (Math.abs(d) < 1e-6) break
    u = clamp(u - (cx(u) - x) / d)
  }
  return cy(u)
}

/** «Typed at N ms apart»: how many characters of `s` have landed by `t`. */
export const typed = (s: string, t: number, from: number, per: number) =>
  s.slice(0, clamp((t - from) / per, 0, s.length) | 0)

/**
 * ONE rAF CLOCK, AND THE COMPONENT ONLY RE-RENDERS WHEN ITS STATE ACTUALLY CHANGES.
 *
 * `derive(t)` turns the loop's millisecond into the island's whole visible state. The clock runs
 * at the display's rate but `setState` fires only when that state differs, so a nine-second loop
 * costs a couple of dozen renders rather than five hundred — and every smooth movement in these
 * islands is a CSS transition on the app's own curve, which the compositor runs whether React
 * re-rendered this frame or not.
 *
 * `restMs` is the frame the island HOLDS when it must not move: reduced motion, a static preview
 * card, and first paint before the observer says the island is on screen. It is a settled beat by
 * construction — never a mid-typing frame, which would read as a broken screen.
 */
export function useBeat<S>(
  loopMs: number,
  restMs: number,
  staticFrame: boolean,
  derive: (t: number, loop: number) => S,
): readonly [S, React.RefObject<HTMLDivElement>] {
  const root = useRef<HTMLDivElement>(null)
  const fn = useRef(derive)
  fn.current = derive
  const [state, setState] = useState<S>(() => derive(restMs, 0))

  useEffect(() => {
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (staticFrame || reduce) { setState(fn.current(restMs, 0)); return }
    // The loop ENTERS at the rest beat, not at t=0: the first frame a reader sees is the settled,
    // meaningful state (the line landed, «16,40» typed), and the cycle reads as a replay from
    // there. Starting at 0 opened the composer on its empty ghost — a picture contradicting the
    // sentence beside it (W13's catch, 2026-08-29).
    let raf = 0, start = 0, paused = true, at = restMs % loopMs, loop = 0, key = ''
    const frame = (ts: number) => {
      if (!start) start = ts - at
      const now = (ts - start) % loopMs
      if (now < at) loop++          // the clock wrapped: the run is a product further on
      at = now
      const next = fn.current(at, loop)
      const k = JSON.stringify(next)
      if (k !== key) { key = k; setState(next) }
      raf = requestAnimationFrame(frame)
    }
    const play = () => { if (paused) { paused = false; start = 0; raf = requestAnimationFrame(frame) } }
    const stop = () => { if (!paused) { paused = true; cancelAnimationFrame(raf) } }
    const onVis = () => (document.hidden ? stop() : play())
    document.addEventListener('visibilitychange', onVis)
    let io: IntersectionObserver | null = null
    const el = root.current
    if (el && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(([e]) => { e.isIntersecting && !document.hidden ? play() : stop() }, { threshold: 0.15 })
      io.observe(el)
    } else play()
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVis); io?.disconnect() }
  }, [loopMs, restMs, staticFrame])

  return [state, root] as const
}

/**
 * THE ISLAND IS DRAWN AT THE COMPONENT'S OWN PIXELS AND THEN FITTED, NEVER RE-LAID-OUT.
 *
 * Every capture in BEATS.md is DPR-2, so half its stored pixels is the size the surface was
 * composed at — 480×324 for the price sheet, 672×570 for the river, 719 for the composer pane.
 * The island is built at exactly that size and scaled to whatever column it lands in, which is the
 * same rule `.ayp-shot` already applies to the still beside it (`width:min(100%,var(--nw))`): it
 * shrinks when the column is narrow and is NEVER blown up past its own resolution.
 *
 * Scaling rather than reflowing is what keeps the island honest — a component that re-flows at
 * 390px is a second design of the screen, and the one thing these islands exist to avoid is
 * showing a screen the product does not have.
 */
/** RULE 15 · THE BUILD-IN, for anything that fits — «a static paste is not a shot» (Peter,
 *  2026-08-29). The islands already HOLD their settled frame until they are on screen and only
 *  then start looping, so they never played a half-state at a reader; what they did do is arrive
 *  whole, which reads as a paste. This gives every fitted island one entrance: it rises and comes
 *  up on the app's curve, once, and never plays backwards.
 *
 *  FAILS SAFE. The rest state is invisible, so a missing observer would mean a blank frame — the
 *  exact bug that has shipped blank sections on this site before. No IntersectionObserver at all →
 *  settle immediately; and reduced motion cancels the rest state in CSS, not here, so a reader who
 *  cannot see motion never depends on this hook running. */
export function useEnter(el: React.RefObject<HTMLElement>): boolean {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const node = el.current
    if (!node || typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const io = new IntersectionObserver(
      (es) => { if (es.some((e) => e.isIntersecting)) { setInView(true); io.disconnect() } },
      { threshold: 0.15 },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [el])
  return inView
}

export function Fit({
  nw, nh, className = '', children,
}: { nw: number; nh: number; className?: string; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const shown = useEnter(box)
  const [s, setS] = useState(1)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => setS(Math.min(1, (el.clientWidth || nw) / nw))
    fit()
    if (typeof ResizeObserver === 'undefined') { addEventListener('resize', fit); return () => removeEventListener('resize', fit) }
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [nw])
  return (
    <div ref={box} className={'am-fit ' + className + (shown ? ' is-in' : '')}
         style={{ ['--nw' as string]: nw + 'px', height: Math.round(nh * s) + 'px' }}>
      {/* the stage carries the fit's own `scale()` inline, so the BUILD-IN lives on the box around
          it — a second transform here would be overwritten by that inline one every resize */}
      <div className="am-stage" style={{ width: nw, height: nh, transform: `scale(${s})` }}>{children}</div>
    </div>
  )
}

/** The island mounts OVER the still that is already in the markup: `frame_plate()` prints the
 *  capture as the no-JS floor and this hides it the moment React is running, so a visitor with
 *  no JS (or a slow bundle) sees the real screen rather than a hole. */
export function useTakeOver(root: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const fig = root.current?.closest('.ayp')
    if (!fig) return
    fig.classList.add('am-on')
    return () => fig.classList.remove('am-on')
  }, [root])
}
