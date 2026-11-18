import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { Banknote, Bell, ClipboardList, Home, LogOut, MapPin, Milk, ShieldCheck, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { BrandMark } from "./BrandMark";
import { LanguageToggle } from "./LanguageToggle";
import { useLanguage } from "@/contexts/LanguageContext";

type WorkspaceKind = "customer" | "gwala";

const navigation = {
  customer: [
    { href: "/account", label: "My plan", icon: ClipboardList },
    { href: "/subscribe", label: "Find milk", icon: MapPin },
    { href: "/signup", label: "Become a gwala", icon: Milk },
  ],
  gwala: [
    { href: "/gwala", label: "My route", icon: ClipboardList },
    { href: "/gwala/stops", label: "Stops", icon: MapPin },
    { href: "/gwala/earnings", label: "Earnings", icon: Banknote },
    { href: "/enroll", label: "Enrollment", icon: UserRound },
    { href: "/", label: "Marketplace", icon: Home },
  ],
};

const urduNavigation: Record<string, string> = {
  "/account": "میرا پلان", "/subscribe": "دودھ تلاش کریں", "/enroll": "گوالا بنیں", "/signup": "گوالا بنیں", "/gwala": "میرا روٹ", "/gwala/earnings": "آمدنی", "/": "مارکیٹ پلیس",
};

export function WorkspaceShell({ kind, title, eyebrow, children }: { kind: WorkspaceKind; title: string; eyebrow: string; children: ReactNode }) {
  const { user, isAuthenticated, logout } = useAuth();
  const { text } = useLanguage();
  const [location] = useLocation();
  const items = navigation[kind];

  return (
    <div className="min-h-screen bg-[#f7f8f5] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-[#f7f8f5]/90 backdrop-blur-xl">
        <div className="container flex h-[72px] items-center justify-between gap-4">
          <BrandMark />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Workspace navigation">
            {items.map(item => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className={`inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors ${location === item.href ? "bg-white text-[#0d4e7b] shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-950"}`}>
                  <Icon className="h-4 w-4" />
                  {text(item.label, urduNavigation[item.href] || item.label)}
                </Link>
              );
            })}
          </nav>
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <LanguageToggle compact />
              <span className="hidden max-w-36 truncate text-sm font-semibold text-slate-600 sm:block">{user?.name || "Your account"}</span>
              <button onClick={logout} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:text-slate-950" aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button onClick={() => startLogin()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0d4e7b] px-4 text-sm font-bold text-white transition hover:bg-[#083d61] active:scale-[0.97]">
              <UserRound className="h-4 w-4" />
              {text("Sign in", "سائن اِن")}
            </button>
          )}
        </div>
      </header>
      <main className="container pb-24 pt-8 md:pb-10 md:pt-12">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[#16846f]">{eyebrow}</p>
            <h1 className="text-3xl font-extrabold tracking-[-0.04em] text-slate-950 md:text-4xl">{title}</h1>
            {kind === "customer" && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{text("Your plan, deliveries and monthly khata in one place. Rate your gwala once a month and pay him directly at month end.", "آپ کا پلان، ڈیلیوریاں اور ماہانہ کھاتہ ایک ہی جگہ۔ مہینے میں ایک بار گوالے کو ریٹنگ دیں اور مہینے کے آخر میں اسے براہِ راست ادائیگی کریں۔")}</p>}
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#e5f3ee] px-3 py-2 text-xs font-bold text-[#116a5a]">
            <ShieldCheck className="h-4 w-4" />
            {text("Verification-first marketplace", "تصدیق پر مبنی مارکیٹ پلیس")}
          </div>
        </div>
        {children}
      </main>
      <nav className={`fixed inset-x-3 bottom-3 z-40 grid ${kind === "gwala" ? "grid-cols-5" : "grid-cols-3"} rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-[0_16px_40px_rgba(15,38,49,0.18)] backdrop-blur md:hidden`} aria-label="Mobile workspace navigation">
        {items.map(item => {
          const Icon = item.icon;
          const active = location === item.href;
          return (
            <Link key={item.href} href={item.href} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold ${active ? "bg-[#e6f3f0] text-[#0d6b5a]" : "text-slate-500"}`}>
              <Icon className="h-4 w-4" />
              {text(item.label, urduNavigation[item.href] || item.label)}
            </Link>
          );
        })}
      </nav>
      <div className="fixed bottom-24 right-5 hidden h-10 w-10 items-center justify-center rounded-full bg-[#0d4e7b] text-white shadow-lg md:flex" aria-hidden="true">
        <Bell className="h-4 w-4" />
      </div>
    </div>
  );
}
