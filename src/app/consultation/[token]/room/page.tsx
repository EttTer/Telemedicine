'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { VideoOff, PhoneOff, ShieldCheck, FileUp } from 'lucide-react'

export default function PatientVideoRoom({ params }: { params: { token: string } }) {
  const router = useRouter()
  const [uploadEnabled, setUploadEnabled] = useState(false) // Driven by real-time status in reality

  const handleEndCall = () => {
    // In reality, this leaves the Daily.co room and updates DB
    router.push(`/consultation/${params.token}/ended`)
  }

  return (
    <div className="flex-1 flex flex-col -m-4 sm:-m-6 lg:-m-8">
      {/* 
        This is a placeholder for the Daily.co embedded frame.
        In production, we would use @daily-co/daily-js to embed the video call here.
      */}
      <div className="flex-1 bg-neutral-900 flex items-center justify-center relative">
        <div className="text-center text-neutral-400">
          <VideoOff className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg">Zabezpečený videohovor (MVP)</p>
          <div className="flex items-center justify-center mt-2 text-sm text-neutral-500">
            <ShieldCheck className="w-4 h-4 mr-1 text-success-500" />
            End-to-end šifrováno, nenahrává se
          </div>
        </div>

        {/* Doctor controls overlay / mock for uploading documents during call */}
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          {uploadEnabled && (
            <Button variant="accent" size="sm" className="shadow-lg">
              <FileUp className="w-4 h-4 mr-2" />
              Nahrát dokument
            </Button>
          )}
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-neutral-800/80 backdrop-blur-sm p-3 rounded-2xl border border-neutral-700">
          <Button variant="secondary" size="md" className="rounded-full w-12 h-12 p-0 bg-neutral-700 hover:bg-neutral-600 border-0 text-white">
            <VideoOff className="w-5 h-5" />
          </Button>
          <Button 
            variant="danger" 
            size="lg" 
            className="rounded-full w-16 h-12"
            onClick={handleEndCall}
          >
            <PhoneOff className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
