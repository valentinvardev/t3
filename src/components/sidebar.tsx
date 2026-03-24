"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare, FileText, Zap, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

const navItems = [
  { href: "/notes", label: "Notes", icon: FileText },
  { href: "/checklist", label: "Checklist", icon: CheckSquare },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900 text-zinc-400">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-zinc-800 px-5 py-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500">
          <Zap size={14} className="text-white" strokeWidth={2.5} />
        </div>
        <span className="text-sm font-semibold tracking-tight text-white">
          Noted
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        <p className="px-2 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
          Workspace
        </p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-indigo-500/15 text-indigo-400"
                  : "hover:bg-zinc-800 hover:text-zinc-200"
              }`}
            >
              <Icon size={16} strokeWidth={active ? 2.5 : 2} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-zinc-800 p-3">
        <button
          onClick={() => signOut({ callbackUrl: "/signin" })}
          className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium text-zinc-500 transition hover:bg-zinc-800 hover:text-red-400"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
