import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { Sidebar } from "./_components/sidebar";
import { Topbar } from "./_components/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  // If session is missing or expired, redirect to login
  if (!user) {
    redirect("/login");
  }

  // Double check role
  if (user.role === "user") {
    redirect("/login?error=unauthorized_role");
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      {/* Sidebar */}
      <Sidebar userRole={user.role} />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col pl-56">
        <Topbar user={user} />
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

