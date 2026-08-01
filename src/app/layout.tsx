import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { JetBrains_Mono, Manrope, Space_Grotesk } from 'next/font/google'
import './globals.css'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Batcave — Deep Work',
  description: 'Deep work command center',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body className={manrope.className}>
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  )
}
