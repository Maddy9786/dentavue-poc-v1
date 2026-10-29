'use client'

import { useState } from 'react'
import { SectionHeader } from './SectionHeader'
import { DentistCard } from './DentistCard'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { recommendedDentists } from '@/features/dashboard/mockDashboard'

/**
 * "Recommended Dentists" — a vertical list of dentist cards (single column even
 * on wide screens: each card is a wide horizontal row).
 *
 * The list is placeholder data today and is meant to be replaced by an
 * area-wise search / AI recommendation API — the cards read entirely from the
 * data shape, so swapping `recommendedDentists` for a fetched result is the only
 * change needed.
 *
 * Booking isn't built, so every card's Book Now opens one shared "coming soon"
 * dialog owned here rather than a dialog per card.
 */
export function RecommendedDentists() {
  const [bookingOpen, setBookingOpen] = useState(false)

  return (
    <section className="flex flex-col gap-md">
      <SectionHeader title="Recommended Dentists" meta="4 actions" />

      <ul className="flex flex-col gap-md">
        {recommendedDentists.map((dentist) => (
          <li key={dentist.id}>
            <DentistCard dentist={dentist} onBook={() => setBookingOpen(true)} />
          </li>
        ))}
      </ul>

      <Modal open={bookingOpen} onClose={() => setBookingOpen(false)} title="Book appointment">
        <div className="flex flex-col gap-lg">
          <p className="text-h2 text-foreground-secondary">
            Booking is coming soon — you&apos;ll be able to choose a time and confirm your
            appointment here.
          </p>
          {/* Primary blue + white per the client's combination (below AA on the
              fill; kept per client instruction, pending confirmation). */}
          <Button variant="primary" className="text-surface" onClick={() => setBookingOpen(false)}>
            Got it
          </Button>
        </div>
      </Modal>
    </section>
  )
}
