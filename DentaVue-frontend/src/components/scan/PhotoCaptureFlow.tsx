'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { cn } from '@/lib/cn'
import { BackButton } from '@/components/ui/BackButton'
import { ROUTES } from '@/constants/routes'
import { photoCaptureSteps } from '@/features/dashboard/mockDashboard'
import {
  assessImageQuality,
  assessLiveVideoFrame,
  type ImageQuality,
  type LiveFrameFeedback,
} from '@/lib/imageQuality'
import { useUploadScanMutation } from '@/features/scan/scansApi'
import { scanDraftCaptured, scanDraftUploaded } from '@/features/scan/scanDraftSlice'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { selectIsAuthenticated } from '@/features/auth/authSlice'
import { QualityCheckReview } from '@/components/scan/QualityCheckReview'
import CameraShutterIcon from '@/icons/camera-mobile.svg'
import GalleryIcon from '@/icons/image.png'

const MAX_DIMENSION = 1280
const ZOOM_PRESETS = [1, 1.5, 2, 2.5, 3] as const

interface StepGuidance {
  icon: string
  headline: string
  subtext: string
  voicePrompt: string
  distanceTip: string
  recommendedZoom: number
}

const STEP_GUIDANCE: Record<string, StepGuidance> = {
  'front-teeth': {
    icon: '😁',
    headline: 'Smile wide & bite gently together',
    subtext: '2x Macro Zoom active — center your upper & lower front teeth in the arch',
    voicePrompt:
      'Step 1, Front teeth. Smile wide, bite gently together, and fit your front teeth inside the zoomed guide frame.',
    distanceTip: '2x Macro Zoom · Hold phone 15–20 cm away',
    recommendedZoom: 2,
  },
  'upper-gums': {
    icon: '⬆️',
    headline: 'Tilt chin UP & lift top lip with clean fingers',
    subtext: 'Expose your upper gumline where top teeth meet the gums',
    voicePrompt:
      'Step 2, Upper gums. Tilt your chin slightly upward and lift your upper lip so your top gums fill the frame.',
    distanceTip: '2.2x Macro Zoom · Tilt chin upward ~20°',
    recommendedZoom: 2.2,
  },
  tongue: {
    icon: '👅',
    headline: 'Open mouth wide & stick your tongue out flat',
    subtext: 'Center the top surface of your tongue inside the oval guide',
    voicePrompt:
      'Step 3, Tongue. Open your mouth wide and stick your tongue out flat inside the oval guide.',
    distanceTip: '2x Macro Zoom · Relax tongue forward',
    recommendedZoom: 2,
  },
  'lower-gums': {
    icon: '⬇️',
    headline: 'Tilt chin DOWN & pull bottom lip down gently',
    subtext: 'Expose your lower gumline and lower front tooth necks',
    voicePrompt:
      'Step 4, Lower gums. Tilt your chin slightly downward and pull your bottom lip down to show your lower gums.',
    distanceTip: '2.2x Macro Zoom · Tilt chin downward ~20°',
    recommendedZoom: 2.2,
  },
}

/** Plays a soft beep for the 3-second hands-free countdown timer using Web Audio API. */
function playCountdownBeep(finalSnap = false) {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = finalSnap ? 880 : 520
    gain.gain.value = 0.08
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + (finalSnap ? 0.16 : 0.09))
  } catch {
    // Ignore audio context restrictions if not permitted
  }
}

/** Renders the angle-specific SVG dental alignment overlay inside the live camera viewfinder. */
function AngleGuideOverlay({ stepId, color }: { stepId: string; color: string }) {
  return (
    <svg
      viewBox="0 0 320 180"
      aria-hidden="true"
      className="pointer-events-none h-48 w-80 max-w-[92%] drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)] transition-colors duration-300"
    >
      {/* Corner alignment brackets */}
      <path
        d="M14,44 L14,14 L46,14 M274,14 L306,14 L306,44 M14,136 L14,166 L46,166 M274,166 L306,166 L306,136"
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
      />

      {stepId === 'front-teeth' && (
        <>
          <path
            d="M32,92 Q160,18 288,92 Q160,164 32,92 Z"
            fill={`${color}18`}
            stroke={color}
            strokeWidth="2.5"
            strokeDasharray="7 4"
          />
          <line x1="50" y1="92" x2="270" y2="92" stroke={color} strokeWidth="1.8" strokeDasharray="4 4" />
          <line x1="160" y1="48" x2="160" y2="136" stroke={color} strokeWidth="1.8" strokeDasharray="4 4" />
          <rect x="130" y="61" width="28" height="29" rx="5" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.8" />
          <rect x="162" y="61" width="28" height="29" rx="5" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.8" />
          <rect x="102" y="65" width="25" height="25" rx="4" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
          <rect x="193" y="65" width="25" height="25" rx="4" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
          <rect x="133" y="94" width="25" height="24" rx="4" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="1.6" />
          <rect x="162" y="94" width="25" height="24" rx="4" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="1.6" />
          <text x="160" y="12" textAnchor="middle" fill={color} fontSize="11" fontWeight="700">
            FILL FRAME WITH FRONT TEETH &amp; GUMS
          </text>
        </>
      )}

      {stepId === 'upper-gums' && (
        <>
          <path
            d="M44,86 Q160,20 276,86 Q160,54 44,86 Z"
            fill="rgba(244,114,182,0.25)"
            stroke="#f472b6"
            strokeWidth="2.4"
            strokeDasharray="5 3"
          />
          <path
            d="M40,122 Q160,30 280,122"
            fill="none"
            stroke={color}
            strokeWidth="2.6"
            strokeDasharray="7 4"
          />
          <path
            d="M160,150 L160,106 M146,118 L160,103 L174,118"
            fill="none"
            stroke={color}
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text x="160" y="12" textAnchor="middle" fill="#f472b6" fontSize="11" fontWeight="700">
            UPPER GUMLINE MACRO ZONE
          </text>
          <text x="160" y="172" textAnchor="middle" fill={color} fontSize="11" fontWeight="600">
            TILT CHIN UP ↑ &amp; LIFT TOP LIP
          </text>
        </>
      )}

      {stepId === 'tongue' && (
        <>
          <ellipse
            cx="160"
            cy="88"
            rx="98"
            ry="60"
            fill="none"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="1.6"
            strokeDasharray="4 4"
          />
          <path
            d="M104,52 Q160,40 216,52 L216,114 Q216,158 160,158 Q104,158 104,114 Z"
            fill={`${color}18`}
            stroke={color}
            strokeWidth="2.6"
            strokeDasharray="7 4"
          />
          <line x1="160" y1="58" x2="160" y2="140" stroke={color} strokeWidth="1.8" strokeDasharray="4 4" />
          <text x="160" y="12" textAnchor="middle" fill={color} fontSize="11" fontWeight="700">
            STICK TONGUE OUT TO FILL OVAL
          </text>
        </>
      )}

      {stepId === 'lower-gums' && (
        <>
          <path
            d="M40,60 Q160,152 280,60"
            fill="none"
            stroke={color}
            strokeWidth="2.6"
            strokeDasharray="7 4"
          />
          <path
            d="M44,96 Q160,158 276,96 Q160,126 44,96 Z"
            fill="rgba(244,114,182,0.25)"
            stroke="#f472b6"
            strokeWidth="2.4"
            strokeDasharray="5 3"
          />
          <path
            d="M160,30 L160,74 M146,62 L160,77 L174,62"
            fill="none"
            stroke={color}
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text x="160" y="12" textAnchor="middle" fill={color} fontSize="11" fontWeight="600">
            TILT CHIN DOWN ↓ &amp; PULL LOWER LIP
          </text>
          <text x="160" y="172" textAnchor="middle" fill="#f472b6" fontSize="11" fontWeight="700">
            LOWER GUMLINE MACRO ZONE
          </text>
        </>
      )}
    </svg>
  )
}

export function PhotoCaptureFlow() {
  const router = useRouter()
  const dispatch = useAppDispatch()
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const [uploadScan] = useUploadScanMutation()

  const steps = photoCaptureSteps
  const total = steps.length
  const [step, setStep] = useState(0)
  const current = steps[step]!
  const guidance = STEP_GUIDANCE[current.id] ?? STEP_GUIDANCE['front-teeth']!

  const [phase, setPhase] = useState<'capture' | 'review'>('capture')
  const retakeIndexRef = useRef<number | null>(null)
  const [qualities, setQualities] = useState<(ImageQuality | undefined)[]>(() =>
    steps.map(() => undefined),
  )

  // Non-technical user helper states + Macro Dental Zoom (defaults to 2.0x Macro!)
  const [guidedMode, setGuidedMode] = useState<'v2' | 'v1'>('v2')
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [isMirrored, setIsMirrored] = useState(true)
  const [zoomLevel, setZoomLevel] = useState<number>(2)
  const [hwZoomApplied, setHwZoomApplied] = useState<number>(1)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [screenLightOn, setScreenLightOn] = useState(false)
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [liveFeedback, setLiveFeedback] = useState<LiveFrameFeedback | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pinchStartDistRef = useRef<number | null>(null)
  const pinchStartZoomRef = useRef<number>(2)

  const [captures, setCaptures] = useState<string[]>([])
  const [streamReady, setStreamReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Effective digital/sensor crop factor after accounting for any hardware optical zoom
  const effectiveCropZoom = guidedMode === 'v1' ? 1 : Math.max(1, zoomLevel / hwZoomApplied)

  // Request high-resolution 1920x1440 / 1080p stream so 2x-3x macro sensor crop remains crisp
  useEffect(() => {
    let cancelled = false
    setStreamReady(false)

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera access is not available in this browser.')
        return
      }
      streamRef.current?.getTracks().forEach((track) => track.stop())
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1440 },
          },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => undefined)
          setStreamReady(true)
          setError(null)
        }
      } catch {
        setError('Camera permission was denied, or no camera was found. You can pick a photo instead.')
      }
    }

    void start()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [facingMode])

  // Apply hardware camera zoom when the device lens supports it; fallback/combine with sensor crop
  useEffect(() => {
    const track = streamRef.current?.getVideoTracks()?.[0]
    if (!track || !streamReady) {
      setHwZoomApplied(1)
      return
    }
    try {
      const capabilities = track.getCapabilities?.() as
        | { zoom?: { min: number; max: number } }
        | undefined
      if (capabilities?.zoom && capabilities.zoom.max > 1) {
        const targetHwZoom =
          guidedMode === 'v1'
            ? capabilities.zoom.min || 1
            : Math.min(capabilities.zoom.max, Math.max(capabilities.zoom.min || 1, zoomLevel))
        void track
          .applyConstraints({
            advanced: [{ zoom: targetHwZoom } as MediaTrackConstraintSet],
          })
          .then(() => setHwZoomApplied(targetHwZoom))
          .catch(() => setHwZoomApplied(1))
      } else {
        setHwZoomApplied(1)
      }
    } catch {
      setHwZoomApplied(1)
    }
  }, [zoomLevel, guidedMode, streamReady])

  // Hardware torch control
  useEffect(() => {
    const track = streamRef.current?.getVideoTracks()?.[0]
    if (!track) return
    try {
      const capabilities = track.getCapabilities?.() as { torch?: boolean } | undefined
      if (capabilities?.torch) {
        void track.applyConstraints({
          advanced: [{ torch: screenLightOn } as MediaTrackConstraintSet],
        })
      }
    } catch {
      // Screen ring light handles illumination when hardware torch is absent
    }
  }, [screenLightOn, streamReady])

  // Spoken voice instructions when step changes
  useEffect(() => {
    if (
      !voiceEnabled ||
      phase !== 'capture' ||
      typeof window === 'undefined' ||
      !('speechSynthesis' in window)
    ) {
      return
    }
    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(guidance.voicePrompt)
      utterance.rate = 0.96
      window.speechSynthesis.speak(utterance)
    } catch {
      // Ignore if speechSynthesis is unavailable
    }
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [step, voiceEnabled, phase, guidance.voicePrompt])

  // Real-time 350ms live frame analyzer on the EXACT zoomed-in mouth region
  useEffect(() => {
    if (!streamReady || phase !== 'capture' || guidedMode !== 'v2') return
    const id = setInterval(() => {
      if (videoRef.current) {
        const result = assessLiveVideoFrame(videoRef.current, effectiveCropZoom)
        if (result) setLiveFeedback(result)
      }
    }, 350)
    return () => clearInterval(id)
  }, [streamReady, phase, guidedMode, effectiveCropZoom])

  // Two-finger pinch-to-zoom handlers on the camera viewfinder
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0]!.clientX - e.touches[1]!.clientX
      const dy = e.touches[0]!.clientY - e.touches[1]!.clientY
      pinchStartDistRef.current = Math.hypot(dx, dy)
      pinchStartZoomRef.current = zoomLevel
    }
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchStartDistRef.current !== null) {
      const dx = e.touches[0]!.clientX - e.touches[1]!.clientX
      const dy = e.touches[0]!.clientY - e.touches[1]!.clientY
      const dist = Math.hypot(dx, dy)
      const ratio = dist / Math.max(1, pinchStartDistRef.current)
      const nextZoom = Math.round(Math.min(3.5, Math.max(1, pinchStartZoomRef.current * ratio)) * 10) / 10
      setZoomLevel(nextZoom)
    }
  }

  const handleTouchEnd = () => {
    pinchStartDistRef.current = null
  }

  const handleCaptured = useCallback(
    async (dataUrl: string) => {
      const capturedStep = step
      setCaptures((prev) => {
        const next = [...prev]
        next[capturedStep] = dataUrl
        return next
      })

      const quality = await assessImageQuality(dataUrl)
      setQualities((prev) => {
        const next = [...prev]
        next[capturedStep] = quality
        return next
      })

      if (retakeIndexRef.current !== null) {
        retakeIndexRef.current = null
        setPhase('review')
        return
      }
      if (capturedStep < total - 1) {
        setStep((s) => s + 1)
        return
      }
      setPhase('review')
    },
    [step, total],
  )

  const handleRetake = (index: number) => {
    retakeIndexRef.current = index
    setStep(index)
    setPhase('capture')
  }

  const handleAnalyse = () => {
    const images = captures.filter(Boolean)
    dispatch(scanDraftCaptured(images))
    if (images.length && isAuthenticated) {
      void uploadScan({ images, capturedAt: new Date().toISOString() })
        .unwrap()
        .then((scan) => dispatch(scanDraftUploaded(scan.id)))
        .catch(() => undefined)
    }
    router.replace(ROUTES.patient.analysing)
  }

  const reviewItems = steps.map((s, i) => {
    const quality = qualities[i]
    return {
      key: s.id,
      label: s.label,
      image: captures[i] ?? '',
      status: quality?.status ?? 'sharp',
      flag: quality?.status === 'retake' ? quality.flag : undefined,
    }
  })

  /**
   * Captures the exact zoomed-in Macro ROI from the raw camera sensor stream!
   * Instead of saving the wide-angle room/face, this crops directly to the
   * center `1 / effectiveCropZoom` mouth window and outputs up to 1280px of
   * pure dental/gingival/tongue detail at 0.92 JPEG quality.
   */
  const captureImmediate = useCallback(() => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return

    const z = Math.max(1, Math.min(3.5, effectiveCropZoom))
    const srcW = video.videoWidth / z
    const srcH = video.videoHeight / z
    const srcX = (video.videoWidth - srcW) / 2
    const srcY = (video.videoHeight - srcH) / 2

    const scale = Math.min(1, MAX_DIMENSION / Math.max(srcW, srcH))
    const width = Math.max(1, Math.round(srcW * scale))
    const height = Math.max(1, Math.round(srcH * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, width, height)
    void handleCaptured(canvas.toDataURL('image/jpeg', 0.92))
  }, [handleCaptured, effectiveCropZoom])

  const triggerShutter = () => {
    if (!streamReady) return
    if (!timerEnabled || guidedMode === 'v1') {
      captureImmediate()
      return
    }
    if (countdown !== null) return

    let remaining = 3
    setCountdown(remaining)
    playCountdownBeep(false)

    countdownTimerRef.current = setInterval(() => {
      remaining -= 1
      if (remaining > 0) {
        setCountdown(remaining)
        playCountdownBeep(false)
      } else {
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
        countdownTimerRef.current = null
        setCountdown(null)
        playCountdownBeep(true)
        captureImmediate()
      }
    }, 850)
  }

  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
    }
  }, [])

  const flipCamera = () => {
    setFacingMode((prev) => {
      const next = prev === 'user' ? 'environment' : 'user'
      setIsMirrored(next === 'user')
      return next
    })
  }

  const pickFromGallery = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') void handleCaptured(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const guideColor =
    !liveFeedback || guidedMode === 'v1'
      ? '#2dd4bf'
      : liveFeedback.state === 'ready'
        ? '#34d399'
        : liveFeedback.state === 'adjust'
          ? '#fbbf24'
          : '#f87171'

  return (
    <>
      <main className={cn('flex min-h-dvh flex-col bg-background', phase === 'review' && 'hidden')}>
        <div className="mx-auto flex w-full app-column flex-1 flex-col gap-md px-lg pt-2xl pb-2xl">
          <header className="relative flex h-9 items-center justify-center">
            <div className="absolute left-0">
              <BackButton fallbackHref={ROUTES.patient.guidedScan} />
            </div>
            <h1 className="text-h1 font-semibold text-foreground">Guided Scan</h1>
            <button
              type="button"
              onClick={() => setGuidedMode((m) => (m === 'v2' ? 'v1' : 'v2'))}
              className={cn(
                'absolute right-0 rounded-full px-sm py-2xs text-nav font-semibold transition-colors',
                guidedMode === 'v2'
                  ? 'bg-primary text-surface'
                  : 'border border-border bg-surface text-foreground-secondary',
              )}
              title="Switch between v2 Smart Guided Overlay and v1 Classic Camera"
            >
              {guidedMode === 'v2' ? '✨ v2 Guide' : 'v1 Classic'}
            </button>
          </header>

          {/* Progress bar */}
          <div
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={step + 1}
            aria-valuetext={`Step ${step + 1} of ${total}: ${current.label}`}
            aria-label="Scan progress"
            className="flex gap-xs"
          >
            {steps.map((s, i) => (
              <span
                key={s.id}
                className={cn(
                  'h-2 flex-1 rounded-full',
                  i === step ? 'bg-primary' : i < step ? 'bg-secondary' : 'bg-border',
                )}
              />
            ))}
          </div>

          {/* Step chip + helper bar */}
          <div aria-live="polite" className="flex flex-wrap items-center justify-between gap-xs">
            <span className="inline-flex items-center gap-xs rounded-full bg-surface px-md py-xs text-h2 font-medium shadow-drop">
              <span className="text-primary">
                Step {step + 1}/{total}
              </span>
              <span className="text-foreground">· {current.label}</span>
            </span>

            {guidedMode === 'v2' && (
              <div className="flex items-center gap-2xs">
                <button
                  type="button"
                  onClick={() => setVoiceEnabled((v) => !v)}
                  className={cn(
                    'rounded-full px-sm py-2xs text-nav font-medium transition-colors',
                    voiceEnabled
                      ? 'bg-primary text-surface'
                      : 'border border-border bg-surface text-foreground-secondary',
                  )}
                  title="Read instructions out loud"
                >
                  {voiceEnabled ? '🔊 Voice On' : '🔇 Voice'}
                </button>
                <button
                  type="button"
                  onClick={() => setScreenLightOn((l) => !l)}
                  className={cn(
                    'rounded-full px-sm py-2xs text-nav font-medium transition-colors',
                    screenLightOn
                      ? 'bg-success-bg text-surface'
                      : 'border border-border bg-surface text-foreground-secondary',
                  )}
                  title="Illuminate mouth with screen flash / torch"
                >
                  💡 Light
                </button>
                <button
                  type="button"
                  onClick={() => setTimerEnabled((t) => !t)}
                  className={cn(
                    'rounded-full px-sm py-2xs text-nav font-medium transition-colors',
                    timerEnabled
                      ? 'bg-primary text-surface'
                      : 'border border-border bg-surface text-foreground-secondary',
                  )}
                  title="3-second hands-free countdown timer"
                >
                  {timerEnabled ? '⏱️ 3s On' : '⏱️ 3s'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsMirrored((m) => !m)}
                  className="rounded-full border border-border bg-surface px-sm py-2xs text-nav font-medium text-foreground-secondary"
                  title="Toggle horizontal mirror"
                >
                  🪞
                </button>
              </div>
            )}
          </div>

          {/* Live Camera Viewfinder with Macro Zoom + SVG Dental Alignment Guide */}
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className={cn(
              'relative aspect-[3/4] w-full overflow-hidden rounded-4 bg-foreground transition-all duration-300 md:aspect-[4/3]',
              guidedMode === 'v2' && liveFeedback?.state === 'ready' && 'ring-4 ring-[#34d399]',
              guidedMode === 'v2' && liveFeedback?.state === 'adjust' && 'ring-3 ring-[#fbbf24]',
              guidedMode === 'v2' && liveFeedback?.state === 'invalid' && 'ring-3 ring-[#f87171]',
            )}
            style={
              screenLightOn
                ? {
                    boxShadow:
                      'inset 0 0 0 14px rgba(255, 255, 255, 0.96), 0 0 32px rgba(255, 255, 255, 0.8)',
                  }
                : undefined
            }
          >
            <video
              ref={videoRef}
              playsInline
              muted
              aria-label={`Camera preview — ${current.label}`}
              className="h-full w-full object-cover transition-transform duration-200 ease-out"
              style={{
                transform: `${isMirrored ? 'scaleX(-1) ' : ''}scale(${effectiveCropZoom})`,
                transformOrigin: 'center center',
              }}
            />

            {(!streamReady || error) && (
              <Image
                src="/images/default-teeth-scan.png"
                alt="Example of a well-framed scan"
                fill
                sizes="(max-width: 440px) 100vw, 440px"
                className="object-cover"
                priority
              />
            )}

            {/* v2 Visual Overlay Layer */}
            {guidedMode === 'v2' && streamReady && !error && (
              <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-sm">
                {/* Top live alignment traffic-light status pill */}
                <div className="flex justify-center pt-xs">
                  <span
                    className={cn(
                      'rounded-full px-md py-2xs text-nav font-semibold shadow-md backdrop-blur-md transition-colors',
                      liveFeedback?.state === 'ready'
                        ? 'border border-[#34d399] bg-[#065f46]/90 text-[#a7f3d0]'
                        : liveFeedback?.state === 'adjust'
                          ? 'border border-[#fbbf24] bg-[#78350f]/90 text-[#fde68a]'
                          : 'border border-[#f87171] bg-[#7f1d1d]/90 text-[#fecaca]',
                    )}
                  >
                    {liveFeedback?.message ?? guidance.distanceTip}
                  </span>
                </div>

                {/* Center angle-specific SVG mouth & teeth framing guide */}
                <div className="relative flex flex-1 items-center justify-center">
                  <AngleGuideOverlay stepId={current.id} color={guideColor} />
                  {countdown !== null && (
                    <div className="absolute inset-0 flex items-center justify-center bg-foreground/40 backdrop-blur-[2px]">
                      <span className="text-[64px] font-bold text-surface drop-shadow-lg">
                        {countdown}
                      </span>
                    </div>
                  )}
                </div>

                {/* Interactive Macro Zoom Selector Bar + Bottom Instruction Card */}
                <div className="flex flex-col gap-xs">
                  {/* Macro Zoom Pill Selector (Pointer events enabled!) */}
                  <div className="pointer-events-auto mx-auto flex items-center gap-2xs rounded-full border border-surface/20 bg-foreground/75 px-xs py-2xs backdrop-blur-md">
                    <span className="px-xs text-nav font-medium text-surface/80">🔍 Zoom:</span>
                    {ZOOM_PRESETS.map((preset) => {
                      const active = Math.abs(zoomLevel - preset) < 0.2
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setZoomLevel(preset)}
                          className={cn(
                            'rounded-full px-sm py-2xs text-nav font-semibold transition-all',
                            active
                              ? 'bg-[#2dd4bf] text-[#042f2e] shadow-sm'
                              : 'text-surface hover:bg-surface/15',
                          )}
                        >
                          {preset}x{preset === 2 ? ' ★' : ''}
                        </button>
                      )
                    })}
                  </div>

                  {/* Plain-English positioning card */}
                  <div className="rounded-3 border border-surface/15 bg-foreground/80 px-md py-sm text-surface backdrop-blur-md">
                    <div className="flex items-center gap-sm">
                      <span className="text-h1" aria-hidden="true">
                        {guidance.icon}
                      </span>
                      <div className="flex flex-1 flex-col">
                        <span className="text-body font-semibold text-surface">
                          {guidance.headline}
                        </span>
                        <span className="text-nav text-surface/80">{guidance.subtext}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="text-body text-foreground-secondary">
              {error}
            </p>
          )}

          {/* Controls — gallery (left) + shutter (centre) + flip camera (right) */}
          <div className="relative mt-auto flex items-center justify-center pt-sm">
            <button
              type="button"
              aria-label="Choose a photo from your library"
              onClick={() => fileInputRef.current?.click()}
              className="absolute left-0 grid size-11 place-items-center rounded-2 border border-border bg-surface focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2"
              title="Upload photo from gallery"
            >
              <Image src={GalleryIcon} alt="" width={24} height={24} className="size-6" />
            </button>

            <button
              type="button"
              aria-label={`Take photo — ${current.label}`}
              onClick={triggerShutter}
              disabled={!streamReady || countdown !== null}
              className={cn(
                'relative rounded-full transition-transform active:scale-95 focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40',
                guidedMode === 'v2' &&
                  liveFeedback?.state === 'ready' &&
                  'ring-4 ring-[#34d399] ring-offset-2',
              )}
            >
              <CameraShutterIcon aria-hidden="true" className="size-14 text-foreground-secondary" />
            </button>

            <button
              type="button"
              aria-label="Switch between front and back camera"
              onClick={flipCamera}
              className="absolute right-0 flex h-11 items-center gap-2xs rounded-2 border border-border bg-surface px-sm text-nav font-medium text-foreground focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2"
              title="Switch Front / Back Camera"
            >
              🔄 {facingMode === 'user' ? 'Front' : 'Back'}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={pickFromGallery}
              className="hidden"
            />
          </div>
        </div>
      </main>

      {phase === 'review' && (
        <QualityCheckReview
          items={reviewItems}
          total={total}
          onRetake={handleRetake}
          onAnalyse={handleAnalyse}
        />
      )}
    </>
  )
}
