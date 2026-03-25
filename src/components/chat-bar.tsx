"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  MessageCircle, X, Users, ArrowLeft, Send, Loader2, FileText, Coins,
  Crown, Zap,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { api, type RouterOutputs } from "~/trpc/react";

type Message = RouterOutputs["messages"]["getRecent"][number];
type User = RouterOutputs["users"]["getAll"][number];
type CoinflipGame = NonNullable<Message["coinflipGame"]>;
type CoinSide = "HEADS" | "TAILS";

const ONLINE_THRESHOLD_MS = 60_000;
const BET_PRESETS = [50, 100, 250, 500, 1000];
/**
 * How long (ms) the flip animation window stays open.
 * Must be > polling interval (3 000 ms) so the creator's next poll still
 * sees the window open and triggers the animation.
 */
const FLIP_WINDOW_MS = 5_500;

// ── Coin side config ─────────────────────────────────────────────────────────

const SIDES = {
  HEADS: {
    label: "Heads",
    letter: "H",
    Icon: Crown,
    bg: "linear-gradient(145deg, #78350f 0%, #92400e 50%, #451a03 100%)",
    border: "#f59e0b",
    glow: "rgba(245,158,11,0.7)",
    iconClass: "text-amber-300",
    pillClass: "bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25",
    activePillClass: "bg-amber-500/30 text-amber-300 border-amber-400",
  },
  TAILS: {
    label: "Tails",
    letter: "T",
    Icon: Zap,
    bg: "linear-gradient(145deg, #312e81 0%, #3730a3 50%, #1e1b4b 100%)",
    border: "#6366f1",
    glow: "rgba(99,102,241,0.7)",
    iconClass: "text-indigo-300",
    pillClass: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/25",
    activePillClass: "bg-indigo-500/30 text-indigo-300 border-indigo-400",
  },
} as const;

// ── Coin visuals ─────────────────────────────────────────────────────────────

function CoinFaceStatic({ side, size = 44 }: { side: CoinSide; size?: number }) {
  const s = SIDES[side];
  const Icon = s.Icon;
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: s.bg,
        border: `${size >= 44 ? 3 : 2}px solid ${s.border}`,
        boxShadow: `0 2px 12px ${s.glow.replace("0.7", "0.3")}`,
      }}
    >
      <Icon size={Math.round(size * 0.38)} className={s.iconClass} strokeWidth={2.5} />
    </div>
  );
}

/** Two-faced spinning coin: HEADS and TAILS alternate each half-rotation. */
function CoinSpinning({ size = 56 }: { size?: number }) {
  const hs = SIDES.HEADS;
  const ts = SIDES.TAILS;
  const iconSize = Math.round(size * 0.38);
  const border = `3px solid`;
  return (
    <div className="coin-spinning relative shrink-0" style={{ width: size, height: size }}>
      {/* HEADS face */}
      <div
        className="coin-face-front absolute inset-0 flex items-center justify-center rounded-full"
        style={{ background: hs.bg, border: `${border} ${hs.border}`, boxShadow: `0 0 22px ${hs.glow}` }}
      >
        <Crown size={iconSize} className={hs.iconClass} strokeWidth={2.5} />
      </div>
      {/* TAILS face */}
      <div
        className="coin-face-back absolute inset-0 flex items-center justify-center rounded-full"
        style={{ background: ts.bg, border: `${border} ${ts.border}`, boxShadow: `0 0 22px ${ts.glow}` }}
      >
        <Zap size={iconSize} className={ts.iconClass} strokeWidth={2.5} />
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
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

function CoinflipCard({ game, currentUserId, isFlipping, onJoin, onCancel, joinPending, cancelPending }: CoinflipCardProps) {
  const isCreator = game.creatorId === currentUserId;
  const isJoiner = game.joinerId === currentUserId;
  const isParticipant = isCreator || isJoiner;
  const iWon = isParticipant && game.winnerId === currentUserId;
  const iLost = isParticipant && !!game.winnerId && !iWon;
  const joinerSide: CoinSide = game.creatorSide === "HEADS" ? "TAILS" : "HEADS";
  const winner = game.winnerId === game.creatorId ? game.creator : game.joiner;

  // ── FLIPPING (shown to all users while resolvedAt is within FLIP_WINDOW_MS) ──
  if (isFlipping) {
    return (
      <div className="overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <Coins size={11} className="text-zinc-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Coinflip · Deciding…
            </span>
          </div>
          <span className="text-[10px] font-bold text-amber-400">{game.bet * 2} pts</span>
        </div>
        <div className="flex items-center justify-between px-4 py-4">
          {/* Creator */}
          <div className="flex flex-col items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(game.creatorId)}`}>
              {avatar(game.creator.name)}
            </div>
            <CoinFaceStatic side={game.creatorSide} size={36} />
            <span className="max-w-[60px] truncate text-[10px] font-medium text-zinc-400">
              {game.creator.name ?? "Unknown"}
            </span>
          </div>

          {/* Spinning coin (center) */}
          <div className="flex flex-col items-center gap-1.5">
            <CoinSpinning size={52} />
            <span className="text-xs font-semibold text-zinc-500">vs</span>
          </div>

          {/* Joiner */}
          <div className="flex flex-col items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${game.joinerId ? avatarColor(game.joinerId) : "bg-zinc-700"}`}>
              {avatar(game.joiner?.name)}
            </div>
            <CoinFaceStatic side={joinerSide} size={36} />
            <span className="max-w-[60px] truncate text-[10px] font-medium text-zinc-400">
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
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <Coins size={11} className="text-amber-500/70" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Coinflip · Open
            </span>
          </div>
          <span className="text-[10px] font-bold text-amber-400">{game.bet} pts each</span>
        </div>
        <div className="flex items-center gap-3 px-3 py-3">
          {/* Creator's chosen side */}
          <CoinFaceStatic side={game.creatorSide} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-100">
              {game.creator.name ?? "Unknown"}
            </p>
            <p className="text-xs text-zinc-500">
              picked{" "}
              <span className={SIDES[game.creatorSide].iconClass + " font-semibold"}>
                {SIDES[game.creatorSide].label}
              </span>
              <span className="mx-1 text-zinc-700">·</span>
              prize{" "}
              <span className="font-semibold text-zinc-300">{game.bet * 2} pts</span>
            </p>
          </div>
          <div className="shrink-0">
            {!isCreator ? (
              <button
                onClick={() => onJoin(game.id)}
                disabled={joinPending}
                className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50"
              >
                {joinPending ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                Join
              </button>
            ) : (
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
    const resultSide = game.result as CoinSide | null;
    return (
      <div className={`overflow-hidden rounded-2xl border bg-zinc-900 ${
        iWon ? "animate-win-glow border-emerald-500/40"
        : iLost ? "animate-lose-shake border-red-500/20"
        : "border-zinc-800"
      }`}>
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-800/40 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <Coins size={11} className="text-zinc-600" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
              Coinflip · Finished
            </span>
          </div>
          {resultSide && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-zinc-600">Landed on</span>
              <CoinFaceStatic side={resultSide} size={18} />
              <span className={`text-[10px] font-bold ${SIDES[resultSide].iconClass}`}>
                {SIDES[resultSide].label}
              </span>
            </div>
          )}
        </div>
        <div className="px-3 py-3">
          {/* Players row */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(game.creatorId)}`}>
                {avatar(game.creator.name)}
              </div>
              <CoinFaceStatic side={game.creatorSide} size={28} />
              <span className={`max-w-[64px] truncate text-[10px] font-semibold ${
                game.winnerId === game.creatorId ? SIDES[game.creatorSide].iconClass : "text-zinc-600 line-through"
              }`}>
                {game.creator.name ?? "Unknown"}
              </span>
            </div>

            <div className="text-center">
              <p className="mb-0.5 text-[10px] font-bold text-zinc-600">vs</p>
              <p className="text-xs font-bold text-zinc-300">{game.bet * 2} pts</p>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${game.joinerId ? avatarColor(game.joinerId) : "bg-zinc-700"}`}>
                {avatar(game.joiner?.name)}
              </div>
              <CoinFaceStatic side={joinerSide} size={28} />
              <span className={`max-w-[64px] truncate text-[10px] font-semibold ${
                game.winnerId === game.joinerId ? SIDES[joinerSide].iconClass : "text-zinc-600 line-through"
              }`}>
                {game.joiner?.name ?? "Unknown"}
              </span>
            </div>
          </div>

          {/* Result banner */}
          <div className={`rounded-lg px-3 py-2 text-center text-xs font-bold ${
            iWon ? "bg-emerald-500/10 text-emerald-400"
            : iLost ? "bg-red-500/10 text-red-400"
            : "bg-zinc-800 text-zinc-400"
          }`}>
            {iWon
              ? `You won +${game.bet * 2} pts`
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
    <div className="overflow-hidden rounded-2xl border border-zinc-800/50 bg-zinc-900/60">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <CoinFaceStatic side={game.creatorSide} size={24} />
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
        <button onClick={onBack} className="rounded-md p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100">
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
          <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-zinc-600" /></div>
        ) : (
          <div className="flex flex-col gap-1">
            {users.map((u) => {
              const on = isOnline(u);
              return (
                <div key={u.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
                  <div className="relative">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(u.id)}`}>
                      {avatar(u.name)}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-zinc-900 ${on ? "bg-emerald-500" : "bg-zinc-600"}`} />
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
  // Bet selector state: null = hidden, "side" = picking side, "bet" = picking amount
  const [betStep, setBetStep] = useState<null | "side" | "bet">(null);
  const [pickedSide, setPickedSide] = useState<CoinSide>("HEADS");

  /**
   * Set of gameIds currently showing the flip animation.
   * We add a gameId when resolvedAt is detected within FLIP_WINDOW_MS.
   * We use a ref to prevent double-triggering on re-renders.
   */
  const [flippingGames, setFlippingGames] = useState<Set<string>>(new Set());
  const triggeredRef = useRef<Set<string>>(new Set());

  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = api.messages.getRecent.useQuery(undefined, {
    refetchInterval: 3_000,
  });
  const { data: users = [] } = api.users.getAll.useQuery(undefined, { refetchInterval: 15_000 });
  const { data: me } = api.users.me.useQuery(undefined, { refetchInterval: 10_000 });

  const onlineCount = users.filter(isOnline).length;

  const addFlipping = useCallback((gameId: string) => {
    if (triggeredRef.current.has(gameId)) return;
    triggeredRef.current.add(gameId);
    setFlippingGames((prev) => new Set(prev).add(gameId));
    setTimeout(() => {
      setFlippingGames((prev) => {
        const next = new Set(prev);
        next.delete(gameId);
        return next;
      });
    }, FLIP_WINDOW_MS);
  }, []);

  /**
   * For every poll: if a game's resolvedAt is within FLIP_WINDOW_MS,
   * trigger the animation. This fires for the creator and any spectators
   * the same way it fires for the joiner (via addFlipping in onSuccess).
   */
  useEffect(() => {
    const now = Date.now();
    messages.forEach((msg) => {
      const game = msg.coinflipGame;
      if (!game?.resolvedAt) return;
      const elapsed = now - new Date(game.resolvedAt).getTime();
      if (elapsed < FLIP_WINDOW_MS) {
        addFlipping(game.id);
      }
    });
  }, [messages, addFlipping]);

  const send = api.messages.send.useMutation({
    onSuccess: () => utils.messages.getRecent.invalidate(),
  });

  const createGame = api.coinflip.create.useMutation({
    onSuccess: () => {
      utils.messages.getRecent.invalidate();
      utils.users.me.invalidate();
      setBetStep(null);
    },
  });

  const joinGame = api.coinflip.join.useMutation({
    onSuccess: (game) => {
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
        <button onClick={onClose} className="rounded-md p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200">
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-zinc-600" /></div>
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
              const isCoinflip = !!msg.coinflipGame;
              const isNote = !!msg.sharedNoteTitle;

              if (isCoinflip) {
                return (
                  <div key={msg.id} className="flex flex-col gap-1">
                    <span className="text-xs text-zinc-600">
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
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(msg.user.id)}`}>
                      {avatar(msg.user.name)}
                    </div>
                  )}
                  <div className={`flex max-w-[80%] flex-col gap-0.5 ${isMe ? "items-end" : ""}`}>
                    {!isMe && (
                      <span className="text-xs font-medium text-zinc-500">{msg.user.name ?? "Unknown"}</span>
                    )}
                    {isNote ? (
                      <div className={`w-full overflow-hidden rounded-2xl border bg-zinc-800/60 ${isMe ? "rounded-tr-sm border-indigo-500/40" : "rounded-tl-sm border-zinc-700"}`}>
                        <div className={`flex items-center gap-1.5 border-b px-3 py-2 ${isMe ? "border-indigo-500/20 bg-indigo-500/10" : "border-zinc-700 bg-zinc-800"}`}>
                          <FileText size={11} className={isMe ? "text-indigo-300" : "text-zinc-400"} />
                          <span className={`text-[10px] font-semibold uppercase tracking-wider ${isMe ? "text-indigo-300" : "text-zinc-400"}`}>
                            Shared note
                          </span>
                        </div>
                        <div className="px-3 py-2.5">
                          <p className="mb-1 line-clamp-1 text-sm font-semibold text-zinc-100">{msg.sharedNoteTitle}</p>
                          {msg.sharedNoteContent ? (
                            <p className="line-clamp-3 text-xs leading-relaxed text-zinc-400">{msg.sharedNoteContent}</p>
                          ) : (
                            <p className="text-xs italic text-zinc-600">Empty note</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className={`rounded-2xl px-3 py-2 text-sm leading-snug ${isMe ? "rounded-tr-sm bg-indigo-500 text-white" : "rounded-tl-sm bg-zinc-800 text-zinc-200"}`}>
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

      {/* Bet selector — step 1: pick side */}
      {betStep === "side" && (
        <div className="border-t border-zinc-800 px-3 py-3">
          <p className="mb-2.5 text-xs font-semibold text-zinc-400">Pick your side</p>
          <div className="mb-3 flex gap-2">
            {(["HEADS", "TAILS"] as CoinSide[]).map((side) => {
              const s = SIDES[side];
              const Icon = s.Icon;
              const active = pickedSide === side;
              return (
                <button
                  key={side}
                  onClick={() => { setPickedSide(side); setBetStep("bet"); }}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-sm font-bold transition ${active ? s.activePillClass : s.pillClass}`}
                >
                  <CoinFaceStatic side={side} size={28} />
                  {s.label}
                </button>
              );
            })}
          </div>
          <button onClick={() => setBetStep(null)} className="text-xs text-zinc-600 hover:text-zinc-400">Cancel</button>
        </div>
      )}

      {/* Bet selector — step 2: pick amount */}
      {betStep === "bet" && (
        <div className="border-t border-zinc-800 px-3 py-3">
          <div className="mb-2 flex items-center gap-2">
            <button onClick={() => setBetStep("side")} className="text-zinc-600 hover:text-zinc-400">
              <ArrowLeft size={14} />
            </button>
            <p className="text-xs font-semibold text-zinc-400">
              Bet amount{" "}
              <span className="inline-flex items-center gap-1">
                — <CoinFaceStatic side={pickedSide} size={14} />
                <span className={`font-bold ${SIDES[pickedSide].iconClass}`}>{SIDES[pickedSide].label}</span>
              </span>
            </p>
            {me && (
              <span className="ml-auto flex items-center gap-1 text-[10px] text-zinc-600">
                <Coins size={9} className="text-amber-500/60" />
                {me.points}
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
                  onClick={() => createGame.mutate({ bet: amount, creatorSide: pickedSide })}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    canAfford
                      ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 active:scale-95"
                      : "cursor-not-allowed bg-zinc-800/40 text-zinc-700"
                  }`}
                >
                  {createGame.isPending ? <Loader2 size={11} className="animate-spin" /> : <Coins size={11} />}
                  {amount}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Input bar */}
      {!betStep && (
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
              onClick={() => setBetStep("side")}
              title="Start a coinflip"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-zinc-700 hover:text-amber-400"
            >
              <Coins size={15} />
            </button>
            <button
              onClick={handleSend}
              disabled={!input.trim() || send.isPending}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-white transition hover:bg-indigo-400 disabled:opacity-40"
            >
              {send.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} strokeWidth={2.5} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Chat Bar (toggle + panel) ─────────────────────────────────────────────────

export default function ChatBar() {
  const [open, setOpen] = useState(false);
  const { data: users = [] } = api.users.getAll.useQuery(undefined, { refetchInterval: 15_000 });
  const onlineCount = users.filter(isOnline).length;

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}
      <div className={`fixed bottom-0 right-0 top-0 z-50 flex w-full flex-col bg-zinc-900 shadow-2xl shadow-black/50 transition-transform duration-200 ease-in-out sm:w-80 ${open ? "translate-x-0" : "translate-x-full"}`}>
        {open && <ChatPanel onClose={() => setOpen(false)} />}
      </div>
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
