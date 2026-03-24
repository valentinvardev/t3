"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Zap, Loader2 } from "lucide-react";
import { register } from "~/server/actions/register";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await register(email, password, name);

    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }

    // Auto sign-in after registration
    const signInResult = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (signInResult?.error) {
      setError("Account created. Please sign in.");
      router.push("/signin");
    } else {
      router.push("/notes");
      router.refresh();
    }
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500">
          <Zap size={18} className="text-white" strokeWidth={2.5} />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-semibold text-zinc-100">Create an account</h1>
          <p className="mt-1 text-sm text-zinc-500">Start organizing your thoughts</p>
        </div>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl shadow-black/30">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-400">Name</label>
            <input
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-400">Email</label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-400">Password</label>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-lg bg-indigo-500 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-60 active:scale-95"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Create account
          </button>
        </form>
      </div>

      <p className="mt-4 text-center text-sm text-zinc-600">
        Already have an account?{" "}
        <Link href="/signin" className="text-indigo-400 transition hover:text-indigo-300">
          Sign in
        </Link>
      </p>
    </div>
  );
}
