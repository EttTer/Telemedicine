import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Stethoscope, CalendarPlus, LogOut, LayoutDashboard, Settings, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/Button'

export default async function PracticeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user role and practice info from our users table
  const { data: userData } = await supabase
    .from('users')
    .select('role, first_name, last_name, practices(name)')
    .eq('id', user.id)
    .single()

  const practiceName = userData?.practices?.[0]?.name || 'Ordinace'
  const userName = userData ? `${userData.first_name} ${userData.last_name}` : user.email

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Top Navigation */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-primary-600">
              <Stethoscope className="h-6 w-6" />
              <span className="font-bold text-lg hidden sm:block">{practiceName}</span>
            </div>
            
            <nav className="hidden md:flex ml-8 space-x-1">
              <Link href="/dashboard" className="px-3 py-2 text-sm font-medium rounded-md text-primary-600 bg-primary-50 flex items-center">
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Přehled
              </Link>
              {userData?.role === 'admin' && (
                <>
                  <Link href="/admin/users" className="px-3 py-2 text-sm font-medium rounded-md text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 flex items-center">
                    <Users className="h-4 w-4 mr-2" />
                    Uživatelé
                  </Link>
                  <Link href="/admin/settings" className="px-3 py-2 text-sm font-medium rounded-md text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 flex items-center">
                    <Settings className="h-4 w-4 mr-2" />
                    Nastavení
                  </Link>
                </>
              )}
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            <Link href="/consultations/new">
              <Button variant="primary" size="sm" className="hidden sm:flex">
                <CalendarPlus className="h-4 w-4 mr-2" />
                Nová konzultace
              </Button>
            </Link>
            
            <div className="flex items-center space-x-3 border-l border-neutral-200 pl-4 ml-2">
              <div className="text-sm text-right hidden sm:block">
                <p className="font-medium text-neutral-900 leading-none mb-1">{userName}</p>
                <p className="text-xs text-neutral-500 capitalize">{userData?.role}</p>
              </div>
              <form action="/auth/signout" method="post">
                <Button variant="ghost" size="sm" type="submit" className="text-neutral-500 p-2">
                  <LogOut className="h-5 w-5" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
