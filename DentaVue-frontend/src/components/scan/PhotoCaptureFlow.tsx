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
const ZOOM_PRESETS = [1, 1.5, 2] as const

interface StepGuidance {
  icon: string
  userStepNumber: number
  userStepTotal: number
  shortPose: string
  headline: string
  subtext: string
  voicePrompt: string
  recommendedZoom: number
}

const STEP_GUIDANCE: Record<string, StepGuidance> = {
  'front-teeth': {
    icon: '😁',
    userStepNumber: 1,
    userStepTotal: 2,
    shortPose: 'Say "EEEE"',
    headline: 'Step 1 of 2: Give a wide smile',
    subtext: 'Upper & lower gums will be auto-extracted in the background!',
    voicePrompt:
      'Step 1 of 2. Look straight at the camera, give a wide smile showing your teeth and gums, and tap the shutter.',
    recommendedZoom: 1.5,
  },
  tongue: {
    icon: '👅',
    userStepNumber: 2,
    userStepTotal: 2,
    shortPose: 'Say "AAAH"',
    headline: 'Step 2 of 2: Open mouth & stick tongue out',
    subtext: 'Place your tongue inside the oval frame and tap the shutter',
    voicePrompt:
      'Step 2 of 2. Open your mouth wide, stick your tongue out comfortably, and tap the shutter.',
    recommendedZoom: 1.5,
  },
  'upper-gums': {
    icon: '⬆️',
    userStepNumber: 2,
    userStepTotal: 4,
    shortPose: 'Upper Gums',
    headline: 'Retake: Show upper gums & top teeth',
    subtext: 'Open mouth slightly and tap the shutter',
    voicePrompt: 'Show your upper gums and top teeth, then tap the shutter.',
    recommendedZoom: 1.5,
  },
  'lower-gums': {
    icon: '⬇️',
    userStepNumber: 4,
    userStepTotal: 4,
    shortPose: 'Lower Gums',
    headline: 'Retake: Show lower gums & bottom teeth',
    subtext: 'Lower your bottom lip slightly and tap the shutter',
    voicePrompt: 'Show your lower gums and bottom teeth, then tap the shutter.',
    recommendedZoom: 1.5,
  },
}

/**
 * Automatically slices a high-resolution Upper Gums (`position 1`) and Lower Gums
 * (`position 3`) macro view from the user's Step 1 Wide Smile photo (`position 0`).
 *
 * This turns a single effortless "Wide Smile" shot into 3 clinical views:
 *   - Slot 0 (`front-teeth`): Full smile arch
 *   - Slot 1 (`upper-gums`):  Top 58% macro crop focusing on maxillary gingiva & upper teeth
 *   - Slot 3 (`lower-gums`):  Bottom 58% macro crop focusing on mandibular gingiva & lower teeth
 */
function autoSliceUpperAndLowerGums(
  smileDataUrl: string,
): Promise<{ upperGumsUrl: string; lowerGumsUrl: string } | null> {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => {
      const cropRegion = (yStartFraction: number, yHeightFraction: number): string | null => {
        const srcX = Math.round(img.width * 0.08)
        const srcW = Math.round(img.width * 0.84)
        const srcY = Math.round(img.height * yStartFraction)
        const srcH = Math.round(img.height * yHeightFraction)

        const scale = Math.min(1, MAX_DIMENSION / Math.max(srcW, srcH))
        const outW = Math.max(1, Math.round(srcW * scale))
        const outH = Math.max(1, Math.round(srcH * scale))

        const canvas = document.createElement('canvas')
        canvas.width = outW
        canvas.height = outH
        const ctx = canvas.getContext('2d')
        if (!ctx) return null
        ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH)
        return canvas.toDataURL('image/jpeg', 0.92)
      }

      const upperGumsUrl = cropRegion(0.05, 0.55)
      const lowerGumsUrl = cropRegion(0.4, 0.55)
      if (!upperGumsUrl || !lowerGumsUrl) {
        resolve(null)
        return
      }
      resolve({ upperGumsUrl, lowerGumsUrl })
    }
    img.onerror = () => resolve(null)
    img.src = smileDataUrl
  })
}

function playAudioCue(type: 'tick' | 'snap' | 'reject') {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type === 'reject' ? 'sawtooth' : 'sine'
    osc.frequency.value = type === 'snap' ? 920 : type === 'reject' ? 240 : 540
    gain.gain.value = type === 'snap' ? 0.12 : type === 'reject' ? 0.08 : 0.07
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + (type === 'snap' ? 0.16 : type === 'reject' ? 0.22 : 0.08))
  } catch {
    // Ignore audio context restrictions
  }
}

function speakEnglish(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  try {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-GB'
    utterance.rate = 1.0
    window.speechSynthesis.speak(utterance)
  } catch {
    // Ignore if speech synthesis is blocked
  }
}

/** Clean, minimal mouth/tongue guide frame that never clutters the user's face. */
function CleanGuideOverlay({ stepId, color }: { stepId: string; color: string }) {
  const isTongue = stepId === 'tongue'
  return (
    <svg
      viewBox="0 0 320 180"
      aria-hidden="true"
      className="pointer-events-none h-44 w-72 max-w-[88%] drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)] transition-colors duration-300"
    >
      {/* Clean corner brackets */}
      <path
        d="M20,44 L20,18 L48,18 M272,18 L300,18 L300,44 M20,136 L20,162 L48,162 M272,162 L300,162 L300,136"
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
      />
      {isTongue ? (
        <>
          <path
            d="M104,48 Q160,36 216,48 L216,112 Q216,154 160,154 Q104,154 104,112 Z"
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeDasharray="8 5"
          />
          <text x="160" y="13" textAnchor="middle" fill={color} fontSize="11" fontWeight="700">
            CENTER TONGUE HERE
          </text>
        </>
      ) : (
        <>
          <path
            d="M36,92 Q160,24 284,92 Q160,160 36,92 Z"
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeDasharray="8 5"
          />
          <line
            x1="56"
            y1="92"
            x2="264"
            y2="92"
            stroke={color}
            strokeWidth="1.5"
            strokeDasharray="5 5"
            opacity="0.75"
          />
          <text x="160" y="13" textAnchor="middle" fill={color} fontSize="11" fontWeight="700">
            CENTER SMILE HERE
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
  // Index into `photoCaptureSteps` (0: front-teeth, 1: upper-gums, 2: tongue, 3: lower-gums)
  // In v2 2-Step Easy Mode, normal capture jumps 0 (Wide Smile) -> 2 (Tongue) -> Review!
  const [step, setStep] = useState(0)
  const current = steps[step]!
  const guidance = STEP_GUIDANCE[current.id] ?? STEP_GUIDANCE['front-teeth']!

  const [phase, setPhase] = useState<'capture' | 'review'>('capture')
  const retakeIndexRef = useRef<number | null>(null)
  const [qualities, setQualities] = useState<(ImageQuality | undefined)[]>(() =>
    steps.map(() => undefined),
  )

  const [guidedMode, setGuidedMode] = useState<'v2' | 'v1'>('v2')
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [isMirrored, setIsMirrored] = useState(true)
  const [zoomLevel, setZoomLevel] = useState<number>(1.5)
  const [hwZoomApplied, setHwZoomApplied] = useState<number>(1)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [screenLightOn, setScreenLightOn] = useState(false)
  const [shutterFlash, setShutterFlash] = useState(false)
  const [liveFeedback, setLiveFeedback] = useState<LiveFrameFeedback | null>(null)
  const [rejectedAttempt, setRejectedAttempt] = useState<{
    stepLabel: string
    reason: string
    image: string
    quality: ImageQuality
  } | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pinchStartDistRef = useRef<number | null>(null)
  const pinchStartZoomRef = useRef<number>(1.5)

  const [captures, setCaptures] = useState<string[]>([])
  const [streamReady, setStreamReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const effectiveCropZoom = guidedMode === 'v1' ? 1 : Math.max(1, zoomLevel / hwZoomApplied)

  useEffect(() => {
    setRejectedAttempt(null)
  }, [step])

  // Start camera stream at high resolution (1920x1440 ideal)
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
        setError(
          'Camera permission was denied, or no camera was found. You can pick a photo instead.',
        )
      }
    }

    void start()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [facingMode])

  // Hardware zoom when supported
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
      // Screen ring light fallback
    }
  }, [screenLightOn, streamReady])

  // Spoken English voice instructions when step changes
  useEffect(() => {
    if (!voiceEnabled || phase !== 'capture' || guidedMode !== 'v2') return
    speakEnglish(guidance.voicePrompt)

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [step, voiceEnabled, phase, guidedMode, guidance.voicePrompt])

  // Real-time 400ms live frame analyzer
  useEffect(() => {
    if (!streamReady || phase !== 'capture' || guidedMode !== 'v2') return
    const id = setInterval(() => {
      if (!videoRef.current) return
      const result = assessLiveVideoFrame(videoRef.current, effectiveCropZoom, current.id)
      if (result) setLiveFeedback(result)
    }, 400)
    return () => clearInterval(id)
  }, [streamReady, phase, guidedMode, effectiveCropZoom, current.id])

  /**
   * Commits a captured photo:
   * - In v2 Smart 2-Step Mode:
   *   * Step 0 (`front-teeth` Wide Smile) ALSO auto-slices `upper-gums` (slot 1)
   *     and `lower-gums` (slot 3) in the background, then jumps straight to
   *     Step 2 (`tongue`)!
   *   * Step 2 (`tongue` Open Mouth) saves slot 2 and opens the Quality Check Review!
   */
  const commitStepCapture = useCallback(
    async (dataUrl: string, quality: ImageQuality) => {
      const capturedStep = step
      setRejectedAttempt(null)

      // Single-slot retake from the Quality Check screen
      if (retakeIndexRef.current !== null) {
        const idx = retakeIndexRef.current
        retakeIndexRef.current = null
        setCaptures((prev) => {
          const next = [...prev]
          next[idx] = dataUrl
          return next
        })
        setQualities((prev) => {
          const next = [...prev]
          next[idx] = quality
          return next
        })
        setPhase('review')
        return
      }

      // v2 Smart 2-Step Auto-Slicer: Photo 1 (Wide Smile) generates Slots 0, 1, and 3 automatically!
      if (guidedMode === 'v2' && capturedStep === 0) {
        const sliced = await autoSliceUpperAndLowerGums(dataUrl)
        const sharpAutoQuality: ImageQuality = {
          status: 'sharp',
          isNonOral: false,
          luminance: quality.luminance,
          sharpness: Math.max(150, quality.sharpness),
          oralRatio: quality.oralRatio,
        }

        setCaptures((prev) => {
          const next = [...prev]
          next[0] = dataUrl
          next[1] = sliced?.upperGumsUrl ?? dataUrl
          next[3] = sliced?.lowerGumsUrl ?? dataUrl
          return next
        })
        setQualities((prev) => {
          const next = [...prev]
          next[0] = quality
          next[1] = sharpAutoQuality
          next[3] = sharpAutoQuality
          return next
        })

        // Jump straight from Step 0 (Wide Smile) to Step 2 (Tongue)!
        setStep(2)
        return
      }

      // v2 Smart 2-Step Mode: Photo 2 (Tongue, index 2) completes all 4 slots!
      if (guidedMode === 'v2' && capturedStep === 2) {
        setCaptures((prev) => {
          const next = [...prev]
          next[2] = dataUrl
          return next
        })
        setQualities((prev) => {
          const next = [...prev]
          next[2] = quality
          return next
        })
        if (voiceEnabled) {
          speakEnglish('Scan complete! Review your 4 dental views below.')
        }
        setPhase('review')
        return
      }

      // v1 Classic 4-step fallback
      setCaptures((prev) => {
        const next = [...prev]
        next[capturedStep] = dataUrl
        return next
      })
      setQualities((prev) => {
        const next = [...prev]
        next[capturedStep] = quality
        return next
      })
      if (capturedStep < total - 1) {
        setStep((s) => s + 1)
        return
      }
      setPhase('review')
    },
    [step, total, guidedMode, voiceEnabled],
  )

  const handleCaptured = useCallback(
    async (dataUrl: string) => {
      const capturedStep = step
      const stepObj = steps[capturedStep]!
      const quality = await assessImageQuality(dataUrl, stepObj.id)

      if (quality.isNonOral) {
        const reason =
          quality.rejectionDetail ??
          `We couldn't clearly see your ${stepObj.label.toLowerCase()}. Retake pointing at your mouth, or tap "Use Photo Anyway".`
        setRejectedAttempt({
          stepLabel: stepObj.label,
          reason,
          image: dataUrl,
          quality,
        })
        playAudioCue('reject')
        return
      }

      await commitStepCapture(dataUrl, quality)
    },
    [step, steps, commitStepCapture],
  )

  const captureImmediate = useCallback(() => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return

    setShutterFlash(true)
    playAudioCue('snap')
    setTimeout(() => setShutterFlash(false), 160)

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

  // Pinch-to-zoom on mobile
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
      const nextZoom =
        Math.round(Math.min(3, Math.max(1, pinchStartZoomRef.current * ratio)) * 10) / 10
      setZoomLevel(nextZoom)
    }
  }

  const handleTouchEnd = () => {
    pinchStartDistRef.current = null
  }

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

  const isTwoStepFlow = guidedMode === 'v2' && retakeIndexRef.current === null
  const displayStepNum = isTwoStepFlow ? (step === 0 ? 1 : 2) : step + 1
  const displayStepTotal = isTwoStepFlow ? 2 : total
  const displayStepTitle = isTwoStepFlow
    ? step === 0
      ? 'Wide Smile (Teeth & Gums)'
      : 'Open Mouth (Tongue)'
    : current.label

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
            >
              {guidedMode === 'v2' ? '✨ 2-Step Easy' : '4-Step Classic'}
            </button>
          </header>

          {/* Clean 2-Step Progress Bar in v2 Mode */}
          <div
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={displayStepTotal}
            aria-valuenow={displayStepNum}
            aria-label="Scan progress"
            className="flex gap-xs"
          >
            {Array.from({ length: displayStepTotal }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-2 flex-1 rounded-full',
                  i + 1 === displayStepNum
                    ? 'bg-primary'
                    : i + 1 < displayStepNum
                      ? 'bg-secondary'
                      : 'bg-border',
                )}
              />
            ))}
          </div>

          {/* Step chip + simple Light & Voice toggles */}
          <div aria-live="polite" className="flex items-center justify-between gap-xs">
            <span className="inline-flex items-center gap-xs rounded-full bg-surface px-md py-xs text-h2 font-medium shadow-drop">
              <span className="text-primary">
                Photo {displayStepNum}/{displayStepTotal}
              </span>
              <span className="text-foreground">· {displayStepTitle}</span>
            </span>

            {guidedMode === 'v2' && (
              <div className="flex items-center gap-2xs">
                <button
                  type="button"
                  onClick={() => setScreenLightOn((l) => !l)}
                  className={cn(
                    'rounded-full px-sm py-2xs text-nav font-medium transition-colors',
                    screenLightOn
                      ? 'bg-success-bg text-surface'
                      : 'border border-border bg-surface text-foreground-secondary',
                  )}
                >
                  💡 Light
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = !voiceEnabled
                    setVoiceEnabled(next)
                    if (next) speakEnglish(guidance.voicePrompt)
                  }}
                  className={cn(
                    'rounded-full px-sm py-2xs text-nav font-medium transition-colors',
                    voiceEnabled
                      ? 'bg-primary text-surface'
                      : 'border border-border bg-surface text-foreground-secondary',
                  )}
                >
                  {voiceEnabled ? '🔊' : '🔇'}
                </button>
              </div>
            )}
          </div>

          {/* Clean, Uncluttered Live Camera Viewfinder */}
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className={cn(
              'relative aspect-[3/4] w-full overflow-hidden rounded-4 bg-foreground transition-all duration-300 md:aspect-[4/3]',
              guidedMode === 'v2' && liveFeedback?.state === 'ready' && 'ring-4 ring-[#34d399]',
              guidedMode === 'v2' && liveFeedback?.state === 'adjust' && 'ring-2 ring-[#fbbf24]',
            )}
            style={
              screenLightOn
                ? {
                    boxShadow:
                      'inset 0 0 0 10px rgba(255, 255, 255, 0.95), 0 0 24px rgba(255, 255, 255, 0.75)',
                  }
                : undefined
            }
          >
            <video
              ref={videoRef}
              playsInline
              muted
              aria-label={`Camera preview — ${displayStepTitle}`}
              className="h-full w-full object-cover transition-transform duration-200 ease-out"
              style={{
                transform: `${isMirrored ? 'scaleX(-1) ' : ''}scale(${effectiveCropZoom})`,
                transformOrigin: 'center center',
              }}
            />

            {shutterFlash && (
              <div className="pointer-events-none absolute inset-0 z-30 bg-surface opacity-90 transition-opacity" />
            )}

            {/* Warning Modal Overlay (with Retake AND Use Photo Anyway) */}
            {rejectedAttempt && (
              <div
                role="alertdialog"
                aria-labelledby="rejected-photo-title"
                className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-foreground/85 p-md text-center backdrop-blur-md"
              >
                <div className="flex max-w-xs flex-col items-center gap-sm rounded-4 border-2 border-[#fbbf24] bg-[#1c1917]/95 p-md text-surface shadow-xl">
                  <div className="flex items-center gap-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={rejectedAttempt.image}
                      alt="Captured preview"
                      className="size-14 rounded-2 border border-[#fbbf24] object-cover"
                    />
                    <div className="text-left">
                      <span className="inline-block rounded bg-[#fbbf24] px-xs py-2xs text-nav font-bold text-[#1c1917]">
                        ⚠️ CHECK PHOTO
                      </span>
                      <h2 id="rejected-photo-title" className="text-h2 font-semibold text-surface">
                        {rejectedAttempt.stepLabel}
                      </h2>
                    </div>
                  </div>
                  <p className="text-nav text-[#fde68a]">{rejectedAttempt.reason}</p>

                  <div className="flex w-full flex-col gap-xs pt-2xs">
                    <button
                      type="button"
                      onClick={() => setRejectedAttempt(null)}
                      className="w-full rounded-3 bg-[#fbbf24] py-xs text-body font-bold text-[#1c1917]"
                    >
                      🔄 Retake Photo
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void commitStepCapture(rejectedAttempt.image, {
                          ...rejectedAttempt.quality,
                          isNonOral: false,
                        })
                      }
                      className="w-full rounded-3 border border-surface/30 bg-surface/15 py-xs text-body font-semibold text-surface"
                    >
                      ✓ Use This Photo &amp; Continue →
                    </button>
                  </div>
                </div>
              </div>
            )}

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

            {/* Clean, Minimal Overlay Layer */}
            {guidedMode === 'v2' && streamReady && !error && (
              <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-sm">
                {/* Top compact status pill + zoom selector */}
                <div className="flex items-center justify-between gap-xs">
                  <span
                    className={cn(
                      'rounded-full px-sm py-2xs text-nav font-semibold shadow-sm backdrop-blur-md',
                      liveFeedback?.state === 'ready'
                        ? 'bg-[#065f46]/85 text-[#a7f3d0]'
                        : 'bg-foreground/70 text-surface',
                    )}
                  >
                    {liveFeedback?.state === 'ready'
                      ? '✓ Aligned — Tap Shutter!'
                      : `${guidance.icon} ${guidance.shortPose}`}
                  </span>

                  <div className="pointer-events-auto flex items-center gap-2xs rounded-full bg-foreground/70 px-xs py-2xs backdrop-blur-md">
                    {ZOOM_PRESETS.map((preset) => {
                      const active = Math.abs(zoomLevel - preset) < 0.2
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setZoomLevel(preset)}
                          className={cn(
                            'rounded-full px-xs py-2xs text-nav font-semibold',
                            active ? 'bg-[#2dd4bf] text-[#042f2e]' : 'text-surface',
                          )}
                        >
                          {preset}x
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Center minimal mouth/tongue guide */}
                <div className="flex flex-1 items-center justify-center">
                  <CleanGuideOverlay stepId={current.id} color={guideColor} />
                </div>

                {/* Single compact instruction bar at bottom */}
                <div className="rounded-3 bg-foreground/75 px-md py-xs text-center text-surface backdrop-blur-md">
                  <p className="text-body font-semibold text-surface">{guidance.headline}</p>
                  <p className="text-nav text-surface/80">{guidance.subtext}</p>
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
              className="absolute left-0 grid size-11 place-items-center rounded-2 border border-border bg-surface"
              title="Upload photo from gallery"
            >
              <Image src={GalleryIcon} alt="" width={24} height={24} className="size-6" />
            </button>

            <button
              type="button"
              aria-label={`Take photo — ${displayStepTitle}`}
              onClick={captureImmediate}
              disabled={!streamReady}
              className={cn(
                'relative rounded-full transition-transform active:scale-95 disabled:opacity-40',
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
              className="absolute right-0 flex h-11 items-center gap-2xs rounded-2 border border-border bg-surface px-sm text-nav font-medium text-foreground"
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
