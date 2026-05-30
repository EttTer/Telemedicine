'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Upload, Camera, Mic, Info, CheckCircle2 } from 'lucide-react'

// This would normally be fetched via realtime subscription
const MOCK_WAITING_ROOM_STATE = {
  status: 'waiting', // waiting, admitted
  uploadEnabled: false,
}

export default function WaitingRoomPage({ params }: { params: { token: string } }) {
  const [uploadEnabled, setUploadEnabled] = useState(MOCK_WAITING_ROOM_STATE.uploadEnabled)
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)

  // In a real app, we would set up a Supabase Realtime subscription here
  // to listen for changes to the `document_upload_requests` and `waiting_room_sessions`
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setUploadSuccess(false)
    }
  }

  const handleUpload = async () => {
    if (!file) return
    setIsUploading(true)
    
    try {
      // Simulate upload to Supabase Storage
      await new Promise(resolve => setTimeout(resolve, 1500))
      setUploadSuccess(true)
      setFile(null)
    } catch (error) {
      console.error(error)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="flex-1 max-w-2xl w-full mx-auto py-8">
      <div className="mb-8 flex items-center space-x-2 text-sm text-neutral-400">
        <span className="text-neutral-400">1. Údaje</span>
        <ArrowRightIcon className="w-3 h-3" />
        <span className="text-neutral-400">2. Poučení</span>
        <ArrowRightIcon className="w-3 h-3" />
        <span className="font-medium text-primary-600">3. Čekárna</span>
      </div>

      <div className="space-y-6">
        <Card className="border-t-4 border-t-primary-500 shadow-md">
          <CardContent className="p-8 text-center">
            <div className="relative inline-flex mb-6">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-200 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-16 w-16 bg-primary-100 items-center justify-center">
                  <div className="h-6 w-6 rounded-full bg-primary-500 animate-pulse"></div>
                </span>
              </span>
            </div>
            <h2 className="text-3xl font-bold text-neutral-900 mb-2">Čekáte na přijetí lékařem</h2>
            <p className="text-lg text-neutral-600">
              Lékař o vás ví. Prosím, vyčkejte, brzy se vám bude věnovat.
            </p>
          </CardContent>
        </Card>

        <div className="grid sm:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center">
                <Upload className="w-5 h-5 mr-2 text-primary-500" />
                Nahrání dokumentů
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!uploadEnabled ? (
                <div className="text-sm text-neutral-600 bg-neutral-50 p-4 rounded-md border border-neutral-100 flex items-start">
                  <Info className="w-4 h-4 mr-2 shrink-0 mt-0.5" />
                  <p>Nahrání dokumentů je v tuto chvíli vypnuto. Lze jej využít pouze na přímý pokyn ordinace.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-neutral-600 bg-primary-50 p-3 rounded-md border border-primary-100">
                    Lékař vás požádal o nahrání dokumentu.
                  </div>
                  
                  {uploadSuccess && (
                    <div className="text-sm text-success-700 bg-success-50 p-3 rounded-md border border-success-100 flex items-center">
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Dokument byl úspěšně nahrán.
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="block">
                      <span className="sr-only">Vybrat soubor</span>
                      <input 
                        type="file" 
                        className="block w-full text-sm text-neutral-500
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-md file:border-0
                          file:text-sm file:font-semibold
                          file:bg-primary-50 file:text-primary-700
                          hover:file:bg-primary-100
                          cursor-pointer"
                        accept=".pdf,.jpg,.jpeg,.png,.docx"
                        onChange={handleFileChange}
                      />
                    </label>
                    <p className="text-xs text-neutral-500">Max 10 MB. Formáty: PDF, JPG, PNG, DOCX</p>
                  </div>
                  
                  <Button 
                    variant="secondary" 
                    className="w-full" 
                    disabled={!file}
                    isLoading={isUploading}
                    onClick={handleUpload}
                  >
                    Odeslat lékaři
                  </Button>
                </div>
              )}
              
              {/* Dev mode toggle just for demonstration of the MVP without realtime */}
              <div className="mt-8 pt-4 border-t border-neutral-100 text-center">
                 <p className="text-xs text-neutral-400 mb-2">Dev Tools (Simulate Doctor Action)</p>
                 <button 
                   onClick={() => setUploadEnabled(!uploadEnabled)}
                   className="text-xs bg-neutral-200 px-2 py-1 rounded"
                 >
                   {uploadEnabled ? 'Simulate Doctor Revoking Upload' : 'Simulate Doctor Requesting Upload'}
                 </button>
              </div>

            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center">
                <Camera className="w-5 h-5 mr-2 text-neutral-500" />
                Zkouška spojení
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-600 mb-4">
                Zatímco čekáte, můžete si povolit a vyzkoušet kameru a mikrofon, abyste byli připraveni.
              </p>
              <div className="bg-neutral-900 aspect-video rounded-md flex items-center justify-center overflow-hidden relative">
                {/* We would place a self-view video element here using getUserMedia */}
                <div className="text-center text-neutral-400">
                  <Camera className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <span className="text-sm">Náhled kamery</span>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="secondary" size="sm" className="flex-1">Test kamery</Button>
                <Button variant="secondary" size="sm" className="flex-1"><Mic className="w-4 h-4 mr-2" />Test mikrofonu</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ArrowRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14"/>
      <path d="m12 5 7 7-7 7"/>
    </svg>
  )
}
