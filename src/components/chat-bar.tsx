"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Users, ArrowLeft, Send, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { api, type RouterOutputs } from "~/trpc/react";

type Message = RouterOutputs["messages"]["getRecent"][number];
type User = RouterOutputs["users"]["getAll"][number];

const ONLINE_THRESHOLD_MS = 60_000;

function isOnline(user: User) {
  if (!user.lastSeen) return false;
  return Date.now() - new Date(user.lastSeen).getTime() < ONLINE_THRESHOLD_MS;
}

function avatar(name: string | null | undefined) {
  return (name ?? "?")[0]?.toUpperCase() ?? "?";
}

const AVATAR_COLORS = [
  "bg-violet-500", "bg-indigo-500", "bg-blue-500", "bg-cyan-500",
  "bg-teal-500", "bg-emerald-500", "bg-rose-500", "bg-orange-500",
];

function avatarColor(id: string) {
  const code = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  return AVATAR_COLORS[code % AVATAR_COLORS.length]!;
}

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// ── Users Panel ─────────────────────────────────────────────────────────────

function UsersPanel({ onBack }: { onBack: () => void }) {
  const { data: users = [], isLoading } = api.users.getAll.useQuery(undefined, {
    refetchInterval: 15_000,
  });
  const online = users.filter(isOnline);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
        <button
          onClick={onBack}
          className="rounded-md p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
        >
          <ArrowLeft size={16} />
        </button>
        <span className="flex-1 text-sm font-semibold text-zinc-100">Users</span>
        <span className="text-xs text-zinc-500">
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />
          {online.length} online
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin text-zinc-600" />
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {users.map((u) => {
              const online = isOnline(u);
              return (
                <div key={u.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
                  <div className="relative">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(u.id)}`}
                    >
                      {avatar(u.name)}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-zinc-900 ${
                        online ? "bg-emerald-500" : "bg-zinc-600"
                      }`}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-200">{u.name ?? "Unknown"}</p>
                    <p className="truncate text-xs text-zinc-600">{u.email}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Chat Panel ───────────────────────────────────────────────────────────────

function ChatPanel({ onClose }: { onClose: () => void }) {
  const { data: session } = useSession();
  const utils = api.useUtils();
  const [view, setView] = useState<"chat" | "users">("chat");
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = api.messages.getRecent.useQuery(undefined, {
    refetchInterval: 3_000,
  });

  const { data: users = [] } = api.users.getAll.useQuery(undefined, {
    refetchInterval: 15_000,
  });

  const onlineCount = users.filter(isOnline).length;

  const send = api.messages.send.useMutation({
    onSuccess: () => utils.messages.getRecent.invalidate(),
  });

  // Scroll to bottom when messages load or change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const content = input.trim();
    if (!content || send.isPending) return;
    send.mutate({ content });
    setInput("");
  }

  if (view === "users") return <UsersPanel onBack={() => setView("chat")} />;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
        <span className="flex-1 text-sm font-semibold text-zinc-100">Global Chat</span>
        <button
          onClick={() => setView("users")}
          className="relative flex items-center gap-1.5 rounded-md px-2 py-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
        >
          <Users size={15} />
          <span className="text-xs font-medium">{onlineCount}</span>
        </button>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin text-zinc-600" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageCircle size={32} className="mb-2 text-zinc-700" />
            <p className="text-sm text-zinc-600">No messages yet</p>
            <p className="text-xs text-zinc-700">Be the first to say something</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((msg) => {
              const isMe = msg.user.id === session?.user?.id;
              return (
                <div key={msg.id} className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}>
                  {!isMe && (
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(msg.user.id)}`}
                    >
                      {avatar(msg.user.name)}
                    </div>
                  )}
                  <div className={`flex max-w-[75%] flex-col gap-0.5 ${isMe ? "items-end" : ""}`}>
                    {!isMe && (
                      <span className="text-xs font-medium text-zinc-500">
                        {msg.user.name ?? "Unknown"}
                      </span>
                    )}
                    <div
                      className={`rounded-2xl px-3 py-2 text-sm leading-snug ${
                        isMe
                          ? "rounded-tr-sm bg-indigo-500 text-white"
                          : "rounded-tl-sm bg-zinc-800 text-zinc-200"
                      }`}
                    >
                      {msg.content}
                    </div>
                    <span className="text-[10px] text-zinc-700">{formatTime(msg.createdAt)}</span>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-zinc-800 p-3">
        <div className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/30">
          <input
            type="text"
            placeholder="Message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            className="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-600 outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || send.isPending}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-white transition hover:bg-indigo-400 disabled:opacity-40"
          >
            {send.isPending ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Send size={13} strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Chat Bar (toggle button + panel) ─────────────────────────────────────────

export default function ChatBar() {
  const [open, setOpen] = useState(false);

  const { data: users = [] } = api.users.getAll.useQuery(undefined, {
    refetchInterval: 15_000,
  });
  const onlineCount = users.filter(isOnline).length;

  return (
    <>
      {/* Backdrop on mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed bottom-0 right-0 top-0 z-50 flex w-full flex-col bg-zinc-900 shadow-2xl shadow-black/50 transition-transform duration-200 ease-in-out sm:w-80 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {open && <ChatPanel onClose={() => setOpen(false)} />}
      </div>

      {/* Toggle button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 shadow-lg shadow-black/40 transition hover:bg-zinc-700 active:scale-95"
        >
          <MessageCircle size={20} className="text-zinc-300" />
          {onlineCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">
              {onlineCount > 9 ? "9+" : onlineCount}
            </span>
          )}
        </button>
      )}
    </>
  );
}
