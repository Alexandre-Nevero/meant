import type { Metadata } from 'next'
import { Fraunces, Public_Sans, Sometype_Mono } from 'next/font/google'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-fraunces',
})
const publicSans = Public_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-public-sans',
})
const sometypeMono = Sometype_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-sometype-mono',
})

// The description is the landing page's own lede (app/page.tsx:82), verbatim — it is the
// strongest writing in the product and #49 is explicit that nothing new is invented here.
// Deliberately NOT the "It reads the page" section: ADR-0061 made that claim false.
const DESCRIPTION = 'Say what you mean. It knows if you did.'

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000')

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'meant',
  description: DESCRIPTION,
  openGraph: {
    title: 'meant',
    description: DESCRIPTION,
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${publicSans.variable} ${sometypeMono.variable}`}>
      <body className="m-app">{children}</body>
    </html>
  )
}
