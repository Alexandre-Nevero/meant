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

export const metadata: Metadata = {
  title: 'meant',
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
