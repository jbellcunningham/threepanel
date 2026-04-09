import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'ThreePanel',
  description: 'Schema-driven container, reporting, and statistics platform.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/window.svg',
    shortcut: '/window.svg',
    apple: '/window.svg',
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
      <body>{children}</body>
    </html>
  )
}
