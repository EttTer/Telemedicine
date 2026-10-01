import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Stethoscope,
  CalendarPlus,
  LogOut,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";
import { getStaffContext } from "@/lib/staff";
import { Button } from "@/components/ui/Button";

export default async function PracticeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getStaffContext();
  if (!context.staff) {
    if (context.status === 401) redirect("/login");
    return (
      <main className="p-8">
        Účet nemá přiřazenou ordinaci. Kontaktujte správce.
      </main>
    );
  }
  const userData = context.staff;
  const { data: practice } = await context.admin
    .from("practices")
    .select("name")
    .eq("id", userData.practice_id)
    .single();
  const practiceName = practice?.name || "Ordinace";
  const userName = `${userData.first_name} ${userData.last_name}`;

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Top Navigation */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-16 py-3 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-primary-600">
              <Stethoscope className="h-6 w-6" />
              <span className="font-bold text-lg hidden lg:block">
                {practiceName}
              </span>
            </div>

            <nav className="flex flex-wrap space-x-1">
              <Link
                href="/dashboard"
                className="px-3 py-2 text-sm font-medium rounded-md text-primary-600 bg-primary-50 flex items-center"
              >
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Přehled
              </Link>
              <Link
                href="/consultations/history"
                className="px-3 py-2 text-sm font-medium rounded-md text-neutral-600 hover:bg-neutral-100"
              >
                Historie
              </Link>
              {userData?.role === "admin" && (
                <>
                  <Link
                    href="/admin/users"
                    className="px-3 py-2 text-sm font-medium rounded-md text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 flex items-center"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Uživatelé
                  </Link>
                  <Link
                    href="/admin/settings"
                    className="px-3 py-2 text-sm font-medium rounded-md text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 flex items-center"
                  >
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
              <div className="text-sm text-right hidden lg:block">
                <p className="font-medium text-neutral-900 leading-none mb-1">
                  {userName}
                </p>
                <p className="text-xs text-neutral-500 capitalize">
                  {userData?.role}
                </p>
              </div>
              <form action="/auth/signout" method="post">
                <Button
                  variant="ghost"
                  size="sm"
                  type="submit"
                  className="text-neutral-500 p-2"
                >
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
  );
}
