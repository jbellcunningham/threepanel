import type { Metadata, Viewport } from 'next'
import PwaInit from '@/components/PwaInit'

export const metadata: Metadata = {
  title: 'ThreePanel',
  description: 'Schema-driven container, reporting, and statistics platform.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <PwaInit />
        {children}
      </body>
    </html>
  )
}
