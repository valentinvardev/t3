"use client";

import { useState, useEffect } from "react";
import { Menu, Zap } from "lucide-react";
import Sidebar from "~/components/sidebar";
import ChatBar from "~/components/chat-bar";
import { api } from "~/trpc/react";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const heartbeat = api.users.heartbeat.useMutation();

  useEffect(() => {
    heartbeat.mutate();
    const id = setInterval(() => heartbeat.mutate(), 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar — overlay on mobile, static on desktop */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar onClose={() => setOpen(false)} />
      </div>

      {/* Content column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-950 px-4 py-3 lg:hidden">
          <button
            onClick={() => setOpen(true)}
            className="rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500">
              <Zap size={12} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-semibold text-zinc-100">Noted</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-zinc-950">{children}</main>
      </div>

      <ChatBar />
    </div>
  );
}
