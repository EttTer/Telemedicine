'use client'
export function WherebyRoom({ url }: { url: string }) {
  const room = new URL(url)
  if (room.protocol !== 'https:' || !room.hostname.endsWith('.whereby.com')) return <p>Neplatná adresa hovoru.</p>
  room.searchParams.set('minimal', '')
  room.searchParams.set('lang', 'cs')
  room.searchParams.set('leaveButton', 'on')
  room.searchParams.set('chat', 'off')
  return <iframe title="Videohovor Whereby" src={room.toString()} className="w-full rounded-xl border bg-neutral-900" style={{ height: '70vh', minHeight: 420 }} allow="camera; microphone; fullscreen; display-capture; autoplay" referrerPolicy="no-referrer" allowFullScreen />
}
