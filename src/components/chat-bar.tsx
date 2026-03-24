"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  MessageCircle, X, Users, ArrowLeft, Send, Loader2, FileText, Coins,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { api, type RouterOutputs } from "~/trpc/react";

type Message = RouterOutputs["messages"]["getRecent"][number];
type User = RouterOutputs["users"]["getAll"][number];
type CoinflipGame = NonNullable<Message["coinflipGame"]>;

const ONLINE_THRESHOLD_MS = 60_000;
const BET_PRESETS = [50, 100, 250, 500, 1000];
// How long the flip animation plays before the result is revealed
const FLIP_DURATION_MS = 2800;

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

// ── Styled Coin ───────────────────────────────────────────────────────────────

function CoinIcon({ size = 56, spinning = false }: { size?: number; spinning?: boolean }) {
  return (
    <div className={spinning ? "animate-coin-spin" : ""}>
      <div
        className="flex shrink-0 items-center justify-center rounded-full"
        style={{
          width: size,
          height: size,
          background: "linear-gradient(145deg, #52525b 0%, #27272a 65%, #18181b 100%)",
          border: `${size >= 48 ? 3 : 2}px solid #f59e0b`,
          boxShadow: spinning
            ? "0 0 32px rgba(245,158,11,0.7), inset 0 1px 4px rgba(255,255,255,0.12)"
            : "0 2px 10px rgba(245,158,11,0.25), inset 0 1px 3px rgba(255,255,255,0.08)",
        }}
      >
        <Coins
          size={Math.round(size * 0.42)}
          className="text-amber-400"
          strokeWidth={2}
        />
      </div>
    </div>
  );
}

// ── Coinflip Card ─────────────────────────────────────────────────────────────

interface CoinflipCardProps {
  game: CoinflipGame;
  currentUserId: string;
  isFlipping: boolean;
  onJoin: (gameId: string) => void;
  onCancel: (gameId: string) => void;
  joinPending: boolean;
  cancelPending: boolean;
}

function CoinflipCard({
  game, currentUserId, isFlipping, onJoin, onCancel, joinPending, cancelPending,
}: CoinflipCardProps) {
  const isCreator = game.creatorId === currentUserId;
  const isJoiner = game.joinerId === currentUserId;
  const isParticipant = isCreator || isJoiner;
  const iWon = isParticipant && game.winnerId === currentUserId;
  const iLost = isParticipant && !!game.winnerId && !iWon;
  const winner = game.winnerId === game.creatorId ? game.creator : game.joiner;

  // ── FLIPPING (both users see this during the animation window) ──
  if (isFlipping) {
    return (
      <div className="overflow-hidden rounded-2xl border border-amber-500/40 bg-zinc-900">
        {/* Header */}
        <div className="flex items-center gap-1.5 border-b border-amber-500/20 bg-amber-500/8 px-3 py-2">
          <Coins size={11} className="text-amber-400" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
            Coinflip · Flipping…
          </span>
        </div>
        {/* Players + coin */}
        <div className="flex items-center justify-between gap-2 px-4 py-4">
          {/* Creator */}
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white ${avatarColor(game.creatorId)}`}
            >
              {avatar(game.creator.name)}
            </div>
            <span className="max-w-[60px] truncate text-xs font-medium text-zinc-300">
              {game.creator.name ?? "Unknown"}
            </span>
          </div>

          {/* Spinning coin */}
          <div className="flex flex-col items-center gap-2">
            <CoinIcon size={52} spinning />
            <span className="text-[10px] font-semibold text-amber-400">
              {game.bet * 2} pts
            </span>
          </div>

          {/* Joiner */}
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white ${game.joinerId ? avatarColor(game.joinerId) : "bg-zinc-700"}`}
            >
              {avatar(game.joiner?.name)}
            </div>
            <span className="max-w-[60px] truncate text-xs font-medium text-zinc-300">
              {game.joiner?.name ?? "Unknown"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── WAITING ──
  if (game.status === "WAITING") {
    return (
      <div className="overflow-hidden rounded-2xl border border-amber-500/30 bg-zinc-900">
        <div className="flex items-center gap-1.5 border-b border-amber-500/20 bg-amber-500/8 px-3 py-2">
          <Coins size={11} className="text-amber-400" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
            Coinflip · Open
          </span>
        </div>
        <div className="flex items-center gap-3 px-3 py-3">
          <CoinIcon size={40} />
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-100">
              {game.creator.name ?? "Unknown"}
            </p>
            <p className="text-xs text-zinc-500">
              Bet: <span className="font-semibold text-amber-400">{game.bet} pts</span>
              <span className="mx-1 text-zinc-700">·</span>
              Prize: <span className="font-semibold text-amber-400">{game.bet * 2} pts</span>
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {!isCreator && (
              <button
                onClick={() => onJoin(game.id)}
                disabled={joinPending}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-zinc-900 transition hover:bg-amber-400 disabled:opacity-50"
              >
                {joinPending ? <Loader2 size={11} className="animate-spin" /> : <Coins size={11} />}
                Join
              </button>
            )}
            {isCreator && (
              <button
                onClick={() => onCancel(game.id)}
                disabled={cancelPending}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-50"
              >
                {cancelPending ? <Loader2 size={11} className="animate-spin" /> : "Cancel"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── FINISHED ──
  if (game.status === "FINISHED") {
    return (
      <div
        className={`overflow-hidden rounded-2xl border bg-zinc-900 ${
          iWon ? "animate-win-glow border-emerald-500/50"
          : iLost ? "animate-lose-shake border-red-500/30"
          : "border-zinc-800"
        }`}
      >
        <div className="flex items-center gap-1.5 border-b border-zinc-800 bg-zinc-800/60 px-3 py-2">
          <Coins size={11} className="text-zinc-500" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Coinflip · Finished
          </span>
        </div>
        <div className="px-3 py-3">
          {/* Versus row */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex flex-col items-center gap-1">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(game.creatorId)}`}>
                {avatar(game.creator.name)}
              </div>
              <span className={`max-w-[64px] truncate text-xs font-medium ${game.winnerId === game.creatorId ? "text-emerald-400" : "text-zinc-600 line-through"}`}>
                {game.creator.name ?? "Unknown"}
              </span>
            </div>

            <div className="flex flex-col items-center gap-0.5">
              <CoinIcon size={32} />
              <span className="text-[10px] font-bold text-amber-400">+{game.bet * 2}</span>
            </div>

            <div className="flex flex-col items-center gap-1">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${game.joinerId ? avatarColor(game.joinerId) : "bg-zinc-700"}`}>
                {avatar(game.joiner?.name)}
              </div>
              <span className={`max-w-[64px] truncate text-xs font-medium ${game.winnerId === game.joinerId ? "text-emerald-400" : "text-zinc-600 line-through"}`}>
                {game.joiner?.name ?? "Unknown"}
              </span>
            </div>
          </div>

          {/* Result row */}
          <div className={`rounded-lg px-3 py-2 text-center text-xs font-semibold ${
            iWon ? "bg-emerald-500/10 text-emerald-400"
            : iLost ? "bg-red-500/10 text-red-400"
            : "bg-zinc-800 text-zinc-400"
          }`}>
            {iWon
              ? `You won ${game.bet * 2} pts`
              : iLost
                ? `You lost ${game.bet} pts`
                : `${winner?.name ?? "Unknown"} won ${game.bet * 2} pts`}
          </div>
        </div>
      </div>
    );
  }

  // ── CANCELLED ──
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-900/50">
      <div className="flex items-center gap-1.5 border-b border-zinc-800/50 px-3 py-2">
        <Coins size={11} className="text-zinc-700" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-700">
          Coinflip · Cancelled
        </span>
      </div>
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <CoinIcon size={28} />
        <p className="text-xs text-zinc-600">
          {game.creator.name ?? "Unknown"} cancelled · {game.bet} pts refunded
        </p>
      </div>
    </div>
  );
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
  const [showBetSelector, setShowBetSelector] = useState(false);
  // Set of gameIds currently in the flip animation window
  const [flippingGames, setFlippingGames] = useState<Set<string>>(new Set());
  // Track previous message states to detect WAITING→FINISHED transitions for all users
  const prevMessagesRef = useRef<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = api.messages.getRecent.useQuery(undefined, {
    refetchInterval: 3_000,
  });

  const { data: users = [] } = api.users.getAll.useQuery(undefined, {
    refetchInterval: 15_000,
  });

  const { data: me } = api.users.me.useQuery(undefined, { refetchInterval: 10_000 });

  const onlineCount = users.filter(isOnline).length;

  // Start flip animation for a game; auto-clears after FLIP_DURATION_MS
  const addFlipping = useCallback((gameId: string) => {
    setFlippingGames((prev) => {
      if (prev.has(gameId)) return prev;
      const next = new Set(prev);
      next.add(gameId);
      return next;
    });
    setTimeout(() => {
      setFlippingGames((prev) => {
        const next = new Set(prev);
        next.delete(gameId);
        return next;
      });
    }, FLIP_DURATION_MS);
  }, []);

  // Detect WAITING→FINISHED transitions via polling so ALL users see the animation
  useEffect(() => {
    const prev = prevMessagesRef.current;
    messages.forEach((msg) => {
      if (!msg.coinflipGame) return;
      const prevMsg = prev.find((m) => m.id === msg.id);
      if (
        prevMsg?.coinflipGame?.status === "WAITING" &&
        msg.coinflipGame.status === "FINISHED"
      ) {
        addFlipping(msg.coinflipGame.id);
      }
    });
    prevMessagesRef.current = messages;
  }, [messages, addFlipping]);

  const send = api.messages.send.useMutation({
    onSuccess: () => utils.messages.getRecent.invalidate(),
  });

  const createGame = api.coinflip.create.useMutation({
    onSuccess: () => {
      utils.messages.getRecent.invalidate();
      utils.users.me.invalidate();
      setShowBetSelector(false);
    },
  });

  const joinGame = api.coinflip.join.useMutation({
    onSuccess: (game) => {
      // Joiner gets immediate animation; other users get it via polling detection above
      addFlipping(game.id);
      utils.messages.getRecent.invalidate();
      utils.users.me.invalidate();
    },
  });

  const cancelGame = api.coinflip.cancel.useMutation({
    onSuccess: () => {
      utils.messages.getRecent.invalidate();
      utils.users.me.invalidate();
    },
  });

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
        {me && (
          <div className="flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1">
            <Coins size={12} className="text-amber-400" />
            <span className="text-xs font-bold text-amber-400">{me.points}</span>
          </div>
        )}
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
              const isNote = !!msg.sharedNoteTitle;
              const isCoinflip = !!msg.coinflipGame;

              if (isCoinflip) {
                return (
                  <div key={msg.id} className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-zinc-600">
                      {isMe ? "You" : (msg.user.name ?? "Unknown")} started a coinflip
                    </span>
                    <CoinflipCard
                      game={msg.coinflipGame!}
                      currentUserId={session?.user?.id ?? ""}
                      isFlipping={flippingGames.has(msg.coinflipGame!.id)}
                      onJoin={(id) => joinGame.mutate({ gameId: id })}
                      onCancel={(id) => cancelGame.mutate({ gameId: id })}
                      joinPending={joinGame.isPending}
                      cancelPending={cancelGame.isPending}
                    />
                    <span className="text-[10px] text-zinc-700">{formatTime(msg.createdAt)}</span>
                  </div>
                );
              }

              return (
                <div key={msg.id} className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}>
                  {!isMe && (
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(msg.user.id)}`}
                    >
                      {avatar(msg.user.name)}
                    </div>
                  )}
                  <div className={`flex max-w-[80%] flex-col gap-0.5 ${isMe ? "items-end" : ""}`}>
                    {!isMe && (
                      <span className="text-xs font-medium text-zinc-500">
                        {msg.user.name ?? "Unknown"}
                      </span>
                    )}

                    {isNote ? (
                      <div className={`w-full overflow-hidden rounded-2xl border bg-zinc-800/60 ${
                        isMe ? "rounded-tr-sm border-indigo-500/40" : "rounded-tl-sm border-zinc-700"
                      }`}>
                        <div className={`flex items-center gap-1.5 border-b px-3 py-2 ${
                          isMe ? "border-indigo-500/20 bg-indigo-500/10" : "border-zinc-700 bg-zinc-800"
                        }`}>
                          <FileText size={11} className={isMe ? "text-indigo-300" : "text-zinc-400"} />
                          <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                            isMe ? "text-indigo-300" : "text-zinc-400"
                          }`}>
                            Shared note
                          </span>
                        </div>
                        <div className="px-3 py-2.5">
                          <p className="mb-1 line-clamp-1 text-sm font-semibold text-zinc-100">
                            {msg.sharedNoteTitle}
                          </p>
                          {msg.sharedNoteContent ? (
                            <p className="line-clamp-3 text-xs leading-relaxed text-zinc-400">
                              {msg.sharedNoteContent}
                            </p>
                          ) : (
                            <p className="text-xs italic text-zinc-600">Empty note</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`rounded-2xl px-3 py-2 text-sm leading-snug ${
                          isMe
                            ? "rounded-tr-sm bg-indigo-500 text-white"
                            : "rounded-tl-sm bg-zinc-800 text-zinc-200"
                        }`}
                      >
                        {msg.content}
                      </div>
                    )}

                    <span className="text-[10px] text-zinc-700">{formatTime(msg.createdAt)}</span>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Bet selector */}
      {showBetSelector && (
        <div className="border-t border-zinc-800 bg-zinc-900/80 px-3 py-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-zinc-400">Choose bet amount</p>
            {me && (
              <span className="flex items-center gap-1 text-[10px] text-zinc-600">
                <Coins size={9} className="text-amber-500/60" />
                {me.points} available
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {BET_PRESETS.map((amount) => {
              const canAfford = (me?.points ?? 0) >= amount;
              return (
                <button
                  key={amount}
                  disabled={!canAfford || createGame.isPending}
                  onClick={() => createGame.mutate({ bet: amount })}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    canAfford
                      ? "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 active:scale-95"
                      : "cursor-not-allowed bg-zinc-800/50 text-zinc-700"
                  }`}
                >
                  {createGame.isPending ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <Coins size={11} />
                  )}
                  {amount}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setShowBetSelector(false)}
            className="mt-2 text-xs text-zinc-600 transition hover:text-zinc-400"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Input */}
      {!showBetSelector && (
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
              onClick={() => setShowBetSelector(true)}
              title="Start a coinflip"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-amber-500/60 transition hover:bg-amber-500/10 hover:text-amber-400"
            >
              <Coins size={15} />
            </button>
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
      )}
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
