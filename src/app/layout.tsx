import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Telemedicína | Čekárna',
  description: 'Zabezpečená telemedicínská platforma pro lékařské praxe.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="cs" className={inter.className}>
      <body className="min-h-screen flex flex-col bg-neutral-50 text-neutral-900">
        {children}
      </body>
    </html>
  )
}
