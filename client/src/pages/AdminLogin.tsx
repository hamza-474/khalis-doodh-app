import { ArrowRight, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { BrandMark } from "@/components/BrandMark";
import { trpc } from "@/lib/trpc";

const inputClass =
  "h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#0d4e7b] focus:ring-2 focus:ring-[#0d4e7b]/20";
const labelClass = "mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-500";

// Hidden admin sign-in. This page is not linked from anywhere in the app.
export default function AdminLogin() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const adminLogin = trpc.auth.adminLogin.useMutation({
    onSuccess: () => navigate("/admin"),
    onError: err => setError(err.message),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f8f5] px-4 text-slate-950">
      <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <BrandMark />
        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#e8f1f8] px-3 py-1.5 text-xs font-extrabold text-[#0d4e7b]">
          <ShieldCheck className="h-3.5 w-3.5" /> Admin
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Admin sign in</h1>
        <form
          className="mt-6 space-y-4"
          onSubmit={event => {
            event.preventDefault();
            setError(null);
            adminLogin.mutate({ email, password });
          }}
        >
          <div>
            <label className={labelClass} htmlFor="admin-email">Email</label>
            <input id="admin-email" type="email" required value={email} onChange={event => setEmail(event.target.value)} className={inputClass} autoComplete="email" />
          </div>
          <div>
            <label className={labelClass} htmlFor="admin-password">Password</label>
            <input id="admin-password" type="password" required value={password} onChange={event => setPassword(event.target.value)} className={inputClass} autoComplete="current-password" />
          </div>
          {error ? <p className="rounded-xl bg-[#fdecec] px-4 py-3 text-sm font-bold text-[#b42318]">{error}</p> : null}
          <button type="submit" disabled={adminLogin.isPending} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0d4e7b] text-sm font-extrabold text-white transition hover:bg-[#083d61] disabled:opacity-60">
            {adminLogin.isPending ? "Signing in…" : "Sign in"} <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
