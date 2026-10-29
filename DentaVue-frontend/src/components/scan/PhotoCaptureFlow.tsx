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

/** Cap the capture's longest side so the upload stays small — same as the old
 *  single-shot camera. A full-sensor still is multiple MB. */
const MAX_DIMENSION = 1280

/**
 * The guided photo-capture flow: four framed shots taken in sequence, each with
 * the live camera, advancing on every shot.
 *
 * Until the camera is ready (and if it is unavailable/denied) the preview shows
 * `default-teeth-scan.png` — the framing guide. The shutter grabs the current
 * video frame; the gallery button is the accessible alternative when there is no
 * camera. After the fourth shot the flow moves to the Quality check review.
 *
 * TWO PHASES, ONE ROUTE — 'capture' (the four shots) and 'review' (QualityCheck).
 * The capture markup stays mounted (hidden) during review, so the one live camera
 * stream stays attached and a "Retake" can return to it instantly without
 * re-acquiring the camera.
 *
 * SAVING — the four angles together make one scan, uploaded in one request (POST
 * /scans) from the review's "Analyse" action. The backend stores all four and
 * keeps the front-teeth shot as the cover, which is what Compare / AI-insight
 * render today (fetched from the DB); using the other angles is a later
 * multi-image flow. The user then lands on /compare. A signed-out capture isn't
 * saved (no session); they still see the demo scans.
 */
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
  // When retaking a single flagged shot, this holds that index; capturing it
  // returns to review instead of advancing. null = the initial full sequence.
  const retakeIndexRef = useRef<number | null>(null)
  // The real, per-shot quality verdict (darkness + blur, computed on the canvas
  // in assessImageQuality). Index-aligned to the captures; a retake overwrites
  // its slot with the new shot's fresh verdict.
  const [qualities, setQualities] = useState<(ImageQuality | undefined)[]>(() =>
    steps.map(() => undefined),
  )

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // The four angles, in capture order, uploaded together at the end and shown on
  // the review. State, not a ref: re-rendering keeps the same <video> element, so
  // the live stream stays attached — only streamReady/step already re-render.
  const [captures, setCaptures] = useState<string[]>([])
  const [streamReady, setStreamReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // One live stream for the whole flow — it stays on between shots and is stopped
  // only when the screen unmounts, so the camera light never lingers.
  useEffect(() => {
    let cancelled = false

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera access is not available in this browser.')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
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
  }, [])

  // Store the shot for this step, then move on: a single retake returns to the
  // review; the initial sequence advances, and reaching the end opens the review.
  // The quality verdict is computed off the captured pixels before we advance, so
  // the review shows a real "sharp / retake" per shot rather than a fixed guess.
  const handleCaptured = async (dataUrl: string) => {
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
  }

  // From the review: jump straight to a flagged shot to retake it.
  const handleRetake = (index: number) => {
    retakeIndexRef.current = index
    setStep(index)
    setPhase('capture')
  }

  // From the review: save the whole session (front teeth first) and move to the
  // analysing screen. The backend stores all four and renders the cover on Compare
  // / AI-insight; a signed-out capture isn't saved (no session) — they keep seeing
  // the demo scans. The upload runs in the background while the analysing screen
  // plays (its optimistic cache update means the scan already shows on Compare).
  //
  // `replace`, not push: the capture screen is done with, so Back from the
  // analysing/results screens returns to the prep screen, not the live camera.
  const handleAnalyse = () => {
    const images = captures.filter(Boolean)
    // Hold this session's shots so the results screen shows them even signed out /
    // before the upload lands (see scanDraftSlice / AnnotatedScanCarousel).
    dispatch(scanDraftCaptured(images))
    if (images.length && isAuthenticated) {
      // Record the id the backend assigns so the analysing screen can poll the
      // real AI result instead of running a timer. Deliberately not awaited —
      // navigation happens immediately and the analysing screen handles the
      // wait; a failed upload simply leaves scanId null and it falls back to a
      // simulated run rather than trapping the user on a dead screen.
      void uploadScan({ images, capturedAt: new Date().toISOString() })
        .unwrap()
        .then((scan) => dispatch(scanDraftUploaded(scan.id)))
        .catch(() => undefined)
    }
    router.replace(ROUTES.patient.analysing)
  }

  // The review's four cards: each captured angle with its REAL clarity verdict.
  // A shot still being assessed (verdict not in yet) shows as sharp so the review
  // never blocks on the check; it settles to the real value a beat later.
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
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const scale = Math.min(1, MAX_DIMENSION / Math.max(video.videoWidth, video.videoHeight))
    const width = Math.round(video.videoWidth * scale)
    const height = Math.round(video.videoHeight * scale)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, width, height)
    void handleCaptured(canvas.toDataURL('image/jpeg', 0.85))
  }

  const pickFromGallery = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') void handleCaptured(reader.result)
    }
    reader.readAsDataURL(file)
  }

  return (
    <>
      {/* Capture stays mounted (hidden) during review so the camera stream keeps
          running and a retake returns to it instantly. */}
      <main className={cn('flex min-h-dvh flex-col bg-background', phase === 'review' && 'hidden')}>
      <div className="mx-auto flex w-full app-column flex-1 flex-col gap-lg px-lg pt-2xl pb-2xl">
        <header className="relative flex h-9 items-center justify-center">
          <div className="absolute left-0">
            <BackButton fallbackHref={ROUTES.patient.guidedScan} />
          </div>
          <h1 className="text-h1 font-semibold text-foreground">Guided Scan</h1>
        </header>

        {/* Progress — the current step's segment is highlighted (per design), the
            rest are muted. A single progressbar role carries the position to
            assistive tech; the segments themselves are decorative. */}
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
              className={cn('h-2 flex-1 rounded-full', i === step ? 'bg-primary' : 'bg-border')}
            />
          ))}
        </div>

        {/* Step chip — announced on change. "Step N" in primary, the angle in
            foreground, on a white pill. */}
        <div aria-live="polite" className="flex">
          <span className="inline-flex items-center gap-xs rounded-full bg-surface px-md py-sm text-h2 font-medium shadow-drop">
            <span className="text-primary">Step {step + 1}</span>
            <span className="text-foreground">· {current.label}</span>
          </span>
        </div>

        {/* Preview — live camera once ready; the default framing guide until then
            (and if the camera is unavailable). */}
        {/* Portrait on a phone (fills the screen for a selfie); a shorter 3:2 on
            web, where the wide column would otherwise make a 3:4 preview huge. */}
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-4 bg-foreground md:aspect-[3/2]">
          <video
            ref={videoRef}
            playsInline
            muted
            aria-label={`Camera preview — ${current.label}`}
            className="h-full w-full object-cover"
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
        </div>

        {error && (
          <p role="alert" className="text-body text-foreground-secondary">
            {error}
          </p>
        )}

        {/* Controls — gallery (left) + shutter (centre), pinned to the bottom. */}
        <div className="relative mt-auto flex items-center justify-center pt-lg">
          <button
            type="button"
            aria-label="Choose a photo from your library"
            onClick={() => fileInputRef.current?.click()}
            className="absolute left-0 grid size-11 place-items-center rounded-2 focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <Image src={GalleryIcon} alt="" width={24} height={24} className="size-6" />
          </button>

          <button
            type="button"
            aria-label={`Take photo — ${current.label}`}
            onClick={capture}
            disabled={!streamReady}
            className="rounded-full focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40"
          >
            <CameraShutterIcon aria-hidden="true" className="size-14 text-foreground-secondary" />
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
