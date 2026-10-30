import { MobileTabBar, DesktopSidebar, MobileTopHeader } from "@/components/Navigation";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <DesktopSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <MobileTopHeader />

        {/* Content Container */}
        <main className="flex-1 w-full max-w-4xl mx-auto p-4 sm:p-6 md:p-8 pb-28 md:pb-8">
          {children}
        </main>

        {/* Mobile Bottom Tab Bar */}
        <MobileTabBar />
      </div>
    </div>
  );
}

