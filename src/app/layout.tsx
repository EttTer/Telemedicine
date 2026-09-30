import type { Metadata } from 'next'
import './globals.css'


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
    <html lang="cs" className="font-sans">
      <body className="min-h-screen flex flex-col bg-neutral-50 text-neutral-900">
        {children}
      </body>
    </html>
  )
}
