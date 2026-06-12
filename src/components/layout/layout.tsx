import { Sidebar } from "./sidebar";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] w-full bg-background dark">
      <Sidebar />
      <main className="flex-1 flex flex-col md:pt-0 pt-16 h-[100dvh] overflow-y-auto">
        <div className="flex-1 p-4 sm:p-5 lg:p-6 max-w-[1400px] mx-auto w-full animate-page-enter">
          {children}
        </div>
      </main>
    </div>
  );
}
