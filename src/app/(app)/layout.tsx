import Sidebar from "~/components/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-y-auto bg-zinc-950">
        {children}
      </main>
    </div>
  );
}
