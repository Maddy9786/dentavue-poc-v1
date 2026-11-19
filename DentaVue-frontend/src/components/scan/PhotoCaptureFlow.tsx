'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { cn } from '@/lib/cn'
import { BackButton } from '@/components/ui/BackButton'
import { ROUTES } from '@/constants/routes'
import { photoCaptureSteps } from '@/features/dashboard/mockDashboard'
import { assessImageQuality, type ImageQuality } from '@/lib/imageQuality'
import { useUploadScanMutation } from '@/features/scan/scansApi'
import { scanDraftCaptured, scanDraftUploaded } from '@/features/scan/scanDraftSlice'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { selectIsAuthenticated } from '@/features/auth/authSlice'
import { QualityCheckReview } from '@/components/scan/QualityCheckReview'
import CameraShutterIcon from '@/icons/camera-mobile.svg'
import GalleryIcon from '@/icons/image.png'

const MAX_DIMENSION = 1280
const ZOOM_OPTIONS = [1, 1.5, 2] as const

const STEP_CONFIRM_FREEZE_MS = 650
const SHUTTER_COOLDOWN_AFTER_STEP_MS = 550

interface PoseInstruction {
  title: string
  imageSrc: string
  step1: string
  step2: string
}

const POSE_INSTRUCTIONS: Record<string, PoseInstruction> = {
  'front-teeth': {
    title: 'Sample Pose · Front Teeth',
    imageSrc: '/images/mouth-previous.png',
    step1: '1. Bite your back teeth gently together.',
    step2: '2. Smile wide ("EEEE") so both upper & lower front teeth show.',
  },
  'upper-gums': {
    title: 'Sample Pose · Upper Gums',
    imageSrc: '/images/guide-upper-gums.png',
    step1: '1. Use two clean fingers to lift your TOP lip up.',
    step2: '2. Tilt chin slightly UP so the pink gums above top teeth show.',
  },
  tongue: {
    title: 'Sample Pose · Tongue',
    imageSrc: '/images/guide-tongue.png',
    step1: '1. Open your mouth wide ("AAAH").',
    step2: '2. Stick your tongue out flat and relaxed toward the camera.',
  },
  'lower-gums': {
    title: 'Sample Pose · Lower Gums',
    imageSrc: '/images/guide-lower-gums.png',
    step1: '1. Use two clean fingers to pull your BOTTOM lip down.',
    step2: '2. Tilt chin slightly DOWN so the pink gums below bottom teeth show.',
  },
}

/** Real Photographic Sample Pose Card showing an actual photo example for each step. */
function PosePhotoCard({ stepId }: { stepId: string }) {
  const info = POSE_INSTRUCTIONS[stepId] ?? POSE_INSTRUCTIONS['front-teeth']!

  return (
    <div className="flex items-center gap-md rounded-3 border border-border bg-surface p-sm shadow-drop">
      <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-2 border border-border bg-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={info.imageSrc}
          alt={info.title}
          className="h-full w-full object-cover"
        />
        <span className="absolute bottom-0 left-0 right-0 bg-foreground/70 py-0.5 text-center text-[10px] font-semibold text-surface">
          Match Pose
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2xs">
        <span className="text-body font-semibold text-foreground">{info.title}</span>
        <span className="text-nav text-foreground-secondary">{info.step1}</span>
        <span className="text-nav text-foreground-secondary">{info.step2}</span>
      </div>
    </div>
  )
}

/** Clean, minimal SVG framing guide inside the live camera preview. */
function FramingGuide({ stepId }: { stepId: string }) {
  const isTongue = stepId === 'tongue'
  return (
    <svg
      viewBox="0 0 300 170"
      aria-hidden="true"
      className="pointer-events-none h-40 w-64 max-w-[82%] drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]"
    >
      <path
        d="M16,40 L16,16 L42,16 M258,16 L284,16 L284,40 M16,130 L16,154 L42,154 M258,154 L284,154 L284,130"
        fill="none"
        stroke="#5eead4"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {isTongue ? (
        <path
          d="M100,42 Q150,32 200,42 L200,105 Q200,145 150,145 Q100,145 100,105 Z"
          fill="none"
          stroke="rgba(255,255,255,0.8)"
          strokeWidth="2"
          strokeDasharray="6 4"
        />
      ) : (
        <>
          <path
            d="M36,85 Q150,22 264,85 Q150,148 36,85 Z"
            fill="none"
            stroke="rgba(255,255,255,0.8)"
            strokeWidth="2"
            strokeDasharray="6 4"
          />
          {stepId === 'front-teeth' && (
            <line
              x1="56"
              y1="85"
              x2="244"
              y2="85"
              stroke="rgba(94,234,212,0.75)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
          )}
          {stepId === 'upper-gums' && (
            <path
              d="M55,75 Q150,32 245,75"
              fill="none"
              stroke="#fb7185"
              strokeWidth="2.5"
              strokeDasharray="4 3"
            />
          )}
          {stepId === 'lower-gums' && (
            <path
              d="M55,95 Q150,138 245,95"
              fill="none"
              stroke="#fb7185"
              strokeWidth="2.5"
              strokeDasharray="4 3"
            />
          )}
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

  const [phase, setPhase] = useState<'capture' | 'review'>('capture')
  const retakeIndexRef = useRef<number | null>(null)
  const [qualities, setQualities] = useState<(ImageQuality | undefined)[]>(() =>
    steps.map(() => undefined),
  )

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [zoom, setZoom] = useState<number>(1.5)
  const isMirrored = facingMode === 'user'

  const shutterLockedRef = useRef(false)
  const [shutterLocked, setShutterLocked] = useState(false)
  const [frozenPreview, setFrozenPreview] = useState<{ image: string; label: string } | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [captures, setCaptures] = useState<string[]>([])
  const [streamReady, setStreamReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reliable camera startup: uses standard facingMode constraint (without rigid
  // width/height that can fail on mobile/laptop sensors) and falls back to { video: true }.
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
        let stream: MediaStream
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode },
            audio: false,
          })
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          })
        }

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

  const handleCaptured = async (dataUrl: string, capturedStep: number) => {
    const stepLabel = steps[capturedStep]?.label ?? `Step ${capturedStep + 1}`

    setFrozenPreview({ image: dataUrl, label: stepLabel })

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

    await new Promise((resolve) => setTimeout(resolve, STEP_CONFIRM_FREEZE_MS))
    setFrozenPreview(null)

    if (retakeIndexRef.current !== null) {
      retakeIndexRef.current = null
      shutterLockedRef.current = false
      setShutterLocked(false)
      setPhase('review')
      return
    }

    if (capturedStep < total - 1) {
      setStep(capturedStep + 1)
      setTimeout(() => {
        shutterLockedRef.current = false
        setShutterLocked(false)
      }, SHUTTER_COOLDOWN_AFTER_STEP_MS)
      return
    }

    shutterLockedRef.current = false
    setShutterLocked(false)
    setPhase('review')
  }

  const handleRetake = (index: number) => {
    retakeIndexRef.current = index
    shutterLockedRef.current = false
    setShutterLocked(false)
    setFrozenPreview(null)
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

  const capture = () => {
    if (shutterLockedRef.current) return
    const video = videoRef.current
    if (!video || !video.videoWidth) return

    shutterLockedRef.current = true
    setShutterLocked(true)
    const targetStep = step

    const z = Math.max(1, zoom)
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
    if (!ctx) {
      shutterLockedRef.current = false
      setShutterLocked(false)
      return
    }
    ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, width, height)
    void handleCaptured(canvas.toDataURL('image/jpeg', 0.9), targetStep)
  }

  const pickFromGallery = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (shutterLockedRef.current) return
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    shutterLockedRef.current = true
    setShutterLocked(true)
    const targetStep = step
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        void handleCaptured(reader.result, targetStep)
      } else {
        shutterLockedRef.current = false
        setShutterLocked(false)
      }
    }
    reader.onerror = () => {
      shutterLockedRef.current = false
      setShutterLocked(false)
    }
    reader.readAsDataURL(file)
  }

  return (
    <>
      <main className={cn('flex min-h-dvh flex-col bg-background', phase === 'review' && 'hidden')}>
        <div className="mx-auto flex w-full app-column flex-1 flex-col gap-md px-lg pt-2xl pb-2xl">
          <header className="relative flex h-9 items-center justify-center">
            <div className="absolute left-0">
              <BackButton fallbackHref={ROUTES.patient.guidedScan} />
            </div>
            <h1 className="text-h1 font-semibold text-foreground">Guided Scan</h1>
          </header>

          {/* 4-Slot Interactive Step Strip */}
          <div className="grid grid-cols-4 gap-xs">
            {steps.map((s, i) => {
              const img = captures[i]
              const isCurrent = i === step
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={shutterLocked}
                  onClick={() => setStep(i)}
                  className={cn(
                    'flex flex-col items-center gap-2xs rounded-2 border p-2xs text-center transition-all',
                    isCurrent
                      ? 'border-primary bg-surface shadow-drop'
                      : img
                        ? 'border-secondary/60 bg-surface/60'
                        : 'border-border bg-surface/40 opacity-70',
                  )}
                >
                  <div className="relative h-8 w-full overflow-hidden rounded-1 bg-border">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={s.label} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-nav font-semibold text-foreground-secondary">
                        {i + 1}
                      </span>
                    )}
                  </div>
                  <span
                    className={cn(
                      'truncate w-full text-nav',
                      isCurrent ? 'font-semibold text-primary' : 'text-foreground-secondary',
                    )}
                  >
                    {s.label}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Step chip + Zoom selector */}
          <div aria-live="polite" className="flex items-center justify-between">
            <span className="inline-flex items-center gap-xs rounded-full bg-surface px-md py-xs text-h2 font-medium shadow-drop">
              <span className="text-primary">Step {step + 1}</span>
              <span className="text-foreground">· {current.label}</span>
            </span>

            <div className="inline-flex items-center gap-2xs rounded-full bg-surface p-2xs shadow-drop">
              {ZOOM_OPTIONS.map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setZoom(z)}
                  className={cn(
                    'rounded-full px-sm py-2xs text-nav font-semibold transition-colors',
                    zoom === z ? 'bg-primary text-surface' : 'text-foreground-secondary',
                  )}
                >
                  {z}x
                </button>
              ))}
            </div>
          </div>

          {/* Real Photographic Sample Pose Card */}
          <PosePhotoCard stepId={current.id} />

          {/* Clean Camera Preview */}
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-4 bg-foreground md:aspect-[3/2]">
            <video
              ref={videoRef}
              playsInline
              muted
              aria-label={`Camera preview — ${current.label}`}
              className="h-full w-full object-cover transition-transform duration-150"
              style={{
                transform: `${isMirrored ? 'scaleX(-1) ' : ''}scale(${zoom})`,
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

            {streamReady && !error && !frozenPreview && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <FramingGuide stepId={current.id} />
              </div>
            )}

            {/* Brief Frozen Confirmation Overlay when a photo is snapped */}
            {frozenPreview && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-foreground/40 backdrop-blur-[1px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={frozenPreview.image}
                  alt={frozenPreview.label}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <span className="relative z-10 rounded-full bg-secondary px-lg py-sm text-h2 font-semibold text-surface shadow-drop">
                  ✓ {frozenPreview.label} Captured!
                </span>
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
              disabled={shutterLocked}
              onClick={() => fileInputRef.current?.click()}
              className="absolute left-0 grid size-11 place-items-center rounded-2 focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40"
            >
              <Image src={GalleryIcon} alt="" width={24} height={24} className="size-6" />
            </button>

            <button
              type="button"
              aria-label={`Take photo — ${current.label}`}
              onClick={capture}
              disabled={!streamReady || shutterLocked}
              className="rounded-full transition-transform active:scale-95 focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40"
            >
              <CameraShutterIcon aria-hidden="true" className="size-14 text-foreground-secondary" />
            </button>

            <button
              type="button"
              aria-label="Switch between front and back camera"
              disabled={shutterLocked}
              onClick={() => setFacingMode((f) => (f === 'user' ? 'environment' : 'user'))}
              className="absolute right-0 rounded-full bg-surface px-md py-sm text-nav font-medium text-foreground shadow-drop disabled:opacity-40"
            >
              🔄 {facingMode === 'user' ? 'Flip' : 'Selfie'}
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
