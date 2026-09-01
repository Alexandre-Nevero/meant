import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'meant',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="m-app">{children}</body>
    </html>
  )
}
