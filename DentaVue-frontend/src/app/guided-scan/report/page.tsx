import type { Metadata } from 'next'
import { PrintableReport } from '@/components/scan/PrintableReport'

export const metadata: Metadata = {
  title: 'Oral Wellness Report',
}

export default function ScanReportPage() {
  return <PrintableReport />
}
