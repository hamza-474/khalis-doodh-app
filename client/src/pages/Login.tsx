import { ArrowRight, LogIn } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { BrandMark } from "@/components/BrandMark";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";

const inputClass =
  "h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#0d4e7b] focus:ring-2 focus:ring-[#0d4e7b]/20";
const labelClass = "mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-500";

export default function Login() {
  const { text } = useLanguage();
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const login = trpc.auth.login.useMutation({
    onSuccess: result => {
      navigate(result.user.accountType === "gwala" ? "/gwala" : "/account");
    },
    onError: err => setError(err.message),
  });

  if (!loading && user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8f5] px-4">
        <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <BrandMark />
          <p className="mt-6 text-base font-bold text-slate-700">
            {text("You are already signed in.", "آپ پہلے سے سائن ان ہیں۔")}
          </p>
          <Link
            href={user.accountType === "gwala" ? "/gwala" : user.role === "admin" ? "/admin" : "/account"}
            className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0d4e7b] px-6 text-sm font-extrabold text-white transition hover:bg-[#083d61]"
          >
            {text("Go to my dashboard", "میرے ڈیش بورڈ پر جائیں")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8f5] text-slate-950">
      <header>
        <div className="container flex h-[78px] items-center justify-between gap-4">
          <BrandMark />
          <LanguageToggle compact />
        </div>
      </header>
      <main className="container flex justify-center pb-20 pt-6">
        <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#ecf7f3] px-3 py-1.5 text-xs font-extrabold text-[#116a5a]">
            <LogIn className="h-3.5 w-3.5" /> {text("Welcome back", "خوش آمدید")}
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">{text("Sign in", "سائن ان")}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {text("Sign in with your email and password to manage your milk plan or gwala route.", "اپنے ای میل اور پاس ورڈ سے سائن ان کریں۔")}
          </p>
          <form
            className="mt-6 space-y-4"
            onSubmit={event => {
              event.preventDefault();
              setError(null);
              login.mutate({ email, password });
            }}
          >
            <div>
              <label className={labelClass} htmlFor="login-email">{text("Email", "ای میل")}</label>
              <input id="login-email" type="email" required value={email} onChange={event => setEmail(event.target.value)} className={inputClass} placeholder="you@example.com" autoComplete="email" />
            </div>
            <div>
              <label className={labelClass} htmlFor="login-password">{text("Password", "پاس ورڈ")}</label>
              <input id="login-password" type="password" required value={password} onChange={event => setPassword(event.target.value)} className={inputClass} placeholder="••••••••" autoComplete="current-password" />
            </div>
            {error ? <p className="rounded-xl bg-[#fdecec] px-4 py-3 text-sm font-bold text-[#b42318]">{error}</p> : null}
            <button type="submit" disabled={login.isPending} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0d4e7b] text-sm font-extrabold text-white transition hover:bg-[#083d61] disabled:opacity-60">
              {login.isPending ? text("Signing in…", "سائن ان ہو رہا ہے…") : text("Sign in", "سائن ان")} <ArrowRight className="h-4 w-4" />
            </button>
          </form>
          <p className="mt-6 text-center text-sm font-semibold text-slate-600">
            {text("New to Khalis Doodh?", "خالص دودھ پر نئے ہیں؟")}{" "}
            <Link href="/signup" className="font-extrabold text-[#0d4e7b] hover:underline">
              {text("Create an account", "اکاؤنٹ بنائیں")}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
