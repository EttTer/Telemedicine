'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { VideoOff, PhoneOff, Settings, Upload, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

export default function DoctorVideoRoom({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [patientInRoom, setPatientInRoom] = useState(true)
  const [uploadEnabled, setUploadEnabled] = useState(false)

  const handleEndCall = () => {
    // End the session, update DB
    router.push(`/consultations/${params.id}/summary`)
  }

  const toggleUpload = () => {
    // In reality this calls the API to grant/revoke document upload permission
    setUploadEnabled(!uploadEnabled)
  }

  return (
    <div className="flex-1 flex flex-col -m-4 sm:-m-6 lg:-m-8 h-[calc(100vh-64px)] relative bg-neutral-900">
      {/* 
        Placeholder for the Daily.co frame 
      */}
      <div className="absolute inset-0 flex items-center justify-center">
        {patientInRoom ? (
          <div className="text-center text-neutral-400">
            <VideoOff className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg text-white">Pacient je připojen</p>
          </div>
        ) : (
          <div className="text-center text-neutral-400">
            <div className="animate-pulse flex flex-col items-center">
              <div className="h-12 w-12 rounded-full border-4 border-t-primary-500 border-neutral-700 animate-spin mb-4"></div>
              <p className="text-lg">Čekání na pacienta...</p>
            </div>
          </div>
        )}
      </div>

      {/* Top bar controls */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-neutral-900/80 to-transparent flex justify-between items-center z-10">
        <div className="flex items-center space-x-3">
          <Badge variant="primary" className="bg-primary-500/20 text-primary-300 border-primary-500/50">
            Probíhá konzultace
          </Badge>
          <span className="text-sm font-medium text-white">00:15:32</span>
        </div>
        
        <div className="flex items-center space-x-2 bg-neutral-800/80 backdrop-blur rounded-lg p-1 border border-neutral-700">
          <Button 
            variant={uploadEnabled ? "success" : "ghost"} 
            size="sm" 
            onClick={toggleUpload}
            className={uploadEnabled ? "bg-success-500/20 text-success-400 hover:bg-success-500/30" : "text-neutral-300 hover:text-white"}
          >
            {uploadEnabled ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
            {uploadEnabled ? "Nahrávání souborů povoleno" : "Povolit nahrání souborů"}
          </Button>
          <Button variant="ghost" size="sm" className="text-neutral-300 hover:text-white">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-neutral-800/80 backdrop-blur-sm p-3 rounded-2xl border border-neutral-700 z-10">
        <Button variant="secondary" size="md" className="rounded-full w-12 h-12 p-0 bg-neutral-700 hover:bg-neutral-600 border-0 text-white">
          <VideoOff className="w-5 h-5" />
        </Button>
        <Button 
          variant="danger" 
          size="lg" 
          className="rounded-full px-8 h-12"
          onClick={handleEndCall}
        >
          <PhoneOff className="w-5 h-5 mr-2" />
          Ukončit konzultaci
        </Button>
      </div>
    </div>
  )
}
