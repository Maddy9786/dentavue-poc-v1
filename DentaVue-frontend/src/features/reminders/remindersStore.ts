'use client'

export interface ScanReminder {
  id: string
  title: string
  note: string
  dueAt: string
  createdAt: string
  done: boolean
}

const STORAGE_KEY = 'dentavue.reminders.v1'
const EMPTY: ScanReminder[] = []

let cachedRaw: string | null = null
let cachedList: ScanReminder[] = EMPTY
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function subscribeReminders(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getRemindersSnapshot(): ScanReminder[] {
  if (typeof window === 'undefined') return EMPTY
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === cachedRaw) return cachedList
    cachedRaw = raw
    cachedList = raw ? (JSON.parse(raw) as ScanReminder[]) : EMPTY
    return cachedList
  } catch {
    return EMPTY
  }
}

export function getRemindersServerSnapshot(): ScanReminder[] {
  return EMPTY
}

function writeReminders(next: ScanReminder[]): void {
  if (typeof window === 'undefined') return
  try {
    const raw = JSON.stringify(next)
    cachedRaw = raw
    cachedList = next
    window.localStorage.setItem(STORAGE_KEY, raw)
    emit()
  } catch {
    // Ignore storage quota errors
  }
}

export function addReminder(input: {
  title: string
  note: string
  dueAt: string
}): ScanReminder {
  const current = getRemindersSnapshot()
  const item: ScanReminder = {
    id: `rem-${Date.now()}`,
    title: input.title,
    note: input.note,
    dueAt: input.dueAt,
    createdAt: new Date().toISOString(),
    done: false,
  }
  writeReminders([item, ...current])
  return item
}

export function toggleReminderDone(id: string): void {
  const next = getRemindersSnapshot().map((item) =>
    item.id === id ? { ...item, done: !item.done } : item,
  )
  writeReminders(next)
}

export function deleteReminder(id: string): void {
  const next = getRemindersSnapshot().filter((item) => item.id !== id)
  writeReminders(next)
}

export function formatReminderDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Generates and downloads an iCalendar (.ics) file so the user can add their
 * DentaVue check-in reminder to Apple Calendar, Google Calendar, or Outlook.
 */
export function downloadCalendarIcs(reminder: { title: string; note: string; dueAt: string }): void {
  const start = new Date(reminder.dueAt)
  if (Number.isNaN(start.getTime())) return
  const end = new Date(start.getTime() + 15 * 60 * 1000)

  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DentaVue//Oral Health Check-in//EN',
    'BEGIN:VEVENT',
    `UID:dentavue-${Date.now()}@dentavue.co.uk`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${reminder.title}`,
    `DESCRIPTION:${reminder.note || 'Time for your quick 4-photo DentaVue mouth check!'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'dentavue-checkin-reminder.ics'
  a.click()
  URL.revokeObjectURL(url)
}
