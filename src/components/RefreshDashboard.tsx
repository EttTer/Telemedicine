'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export function RefreshDashboard() {
 const router = useRouter()
 useEffect(() => {
  const timer = setInterval(() => { if (document.visibilityState === 'visible') router.refresh() }, 5000)
  const refresh = () => router.refresh()
  window.addEventListener('focus', refresh)
  return () => { clearInterval(timer); window.removeEventListener('focus', refresh) }
 }, [router])
 return <p className="text-sm text-neutral-500">Přehled se automaticky aktualizuje každých 5 sekund.</p>
}
