"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare, FileText, Zap, LogOut, X, Coins } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { api } from "~/trpc/react";

const navItems = [
  { href: "/notes", label: "Notes", icon: FileText },
  { href: "/checklist", label: "Checklist", icon: CheckSquare },
];

const AVATAR_COLORS = [
  "bg-violet-500", "bg-indigo-500", "bg-blue-500", "bg-cyan-500",
  "bg-teal-500", "bg-emerald-500", "bg-rose-500", "bg-orange-500",
];

function avatarColor(id: string) {
  const code = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  return AVATAR_COLORS[code % AVATAR_COLORS.length]!;
}

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user;
  const { data: me } = api.users.me.useQuery(undefined, { refetchInterval: 30_000 });

  const prevPointsRef = useRef<number | undefined>(undefined);
  const [pointsDelta, setPointsDelta] = useState<{ amount: number; key: number } | null>(null);

  useEffect(() => {
    if (me?.points === undefined) return;
    if (prevPointsRef.current !== undefined && prevPointsRef.current !== me.points) {
      const delta = me.points - prevPointsRef.current;
      setPointsDelta({ amount: delta, key: Date.now() });
      setTimeout(() => setPointsDelta(null), 2_300);
    }
    prevPointsRef.current = me.points;
  }, [me?.points]);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900 text-zinc-400 lg:w-60">
      {/* Logo */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500">
            <Zap size={14} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-semibold tracking-tight text-white">Noted</span>
        </div>
        {/* Close button — mobile only */}
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200 lg:hidden"
          >
            <X size={18} />
          </button>
        )}
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
              onClick={onClose}
              className={`flex items-center gap-3 rounded-md px-2.5 py-2.5 text-sm font-medium transition-colors lg:py-2 ${
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
      <div className="border-t border-zinc-800 p-3 space-y-1">
        {/* Profile */}
        {user && (
          <div className="flex items-center gap-3 rounded-md px-2.5 py-2">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(user.id)}`}
            >
              {(user.name ?? user.email ?? "?")[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-zinc-200">{user.name ?? "User"}</p>
              <p className="truncate text-[10px] text-zinc-600">{user.email}</p>
            </div>
            {me && (
              <div className="relative flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5">
                <Coins size={10} className="text-amber-400" />
                <span className="text-[10px] font-bold text-amber-400">{me.points}</span>
                {pointsDelta && (
                  <span
                    key={pointsDelta.key}
                    className={`animate-float-up pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold ${
                      pointsDelta.amount > 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {pointsDelta.amount > 0 ? `+${pointsDelta.amount}` : `${pointsDelta.amount}`}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/signin" })}
          className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium text-zinc-500 transition hover:bg-zinc-800 hover:text-red-400"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
