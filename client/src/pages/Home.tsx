import { ArrowRight, BadgeCheck, CalendarDays, ChevronRight, CircleCheck, Droplets, MapPinned, Milk, ShieldCheck, Sparkles, UserRoundCheck } from "lucide-react";
import { Link } from "wouter";
import { BrandMark } from "@/components/BrandMark";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SupportChat } from "@/components/SupportChat";
import { useLanguage } from "@/contexts/LanguageContext";

const steps = [
  { number: "01", icon: MapPinned, title: "Choose your area", body: "Tell us your city and neighbourhood to see the verified delivery routes available to you." },
  { number: "02", icon: UserRoundCheck, title: "Pick a gwala", body: "Compare service areas, daily slots and per-litre pricing before you request a plan." },
  { number: "03", icon: CalendarDays, title: "Plan your deliveries", body: "Choose your litres, start date and payment method. Your gwala confirms the request." },
];

export default function Home() {
  const { text } = useLanguage();
  return (
    <div className="min-h-screen overflow-hidden bg-[#f7f8f5] text-slate-950">
      <header className="relative z-20">
        <div className="container flex h-[78px] items-center justify-between gap-4">
          <BrandMark />
          <nav className="hidden items-center gap-7 text-sm font-bold text-slate-600 md:flex" aria-label="Main navigation">
            <a href="#how-it-works" className="transition hover:text-[#0d4e7b]">{text("How it works", "یہ کیسے کام کرتا ہے")}</a>
            <a href="#trust" className="transition hover:text-[#0d4e7b]">{text("Why trust us", "ہم پر اعتماد کیوں")}</a>
            <Link href="/help" className="transition hover:text-[#0d4e7b]">{text("Help center", "مدد مرکز")}</Link>
            <Link href="/account" className="transition hover:text-[#0d4e7b]">{text("My account", "میرا اکاؤنٹ")}</Link>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageToggle compact />
            <Link href="/login" className="hidden h-11 items-center justify-center rounded-xl px-3 text-sm font-extrabold text-slate-700 transition hover:text-[#0d4e7b] sm:inline-flex">
              {text("Sign in", "سائن ان")}
            </Link>
            <Link href="/enroll" className="hidden h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-extrabold text-slate-800 transition hover:border-[#0d4e7b] hover:text-[#0d4e7b] sm:inline-flex">
              Enroll as Gwala
            </Link>
            <Link href="/subscribe" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0d4e7b] px-4 text-sm font-extrabold text-white shadow-[0_10px_22px_rgba(13,78,123,0.22)] transition hover:bg-[#083d61] active:scale-[0.97]">
              Subscribe Now <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="hero-grid relative">
          <div className="container relative grid min-h-[640px] items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
            <div className="max-w-2xl">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#b8dcd2] bg-[#ecf7f3] px-3.5 py-2 text-xs font-extrabold text-[#116a5a]">
                <Sparkles className="h-3.5 w-3.5" />
                {text("Punjab-wide city coverage", "پورے پنجاب کے شہروں میں کوریج")}
              </div>
              <h1 className="max-w-xl text-5xl font-extrabold leading-[0.98] tracking-[-0.065em] text-slate-950 sm:text-6xl lg:text-7xl">
                {text("Pure milk starts with a route you can trust.", "خالص دودھ ایک قابلِ اعتماد روٹ سے شروع ہوتا ہے۔")}
              </h1>
              <p className="mt-7 max-w-lg text-base leading-7 text-slate-600 sm:text-lg">
                {text("Khalis Doodh connects households with local gwalas across Punjab through a verification-first marketplace, clear delivery plans, and simple weekly or monthly subscriptions.", "خالص دودھ پورے پنجاب میں گھروں کو مقامی گوالوں سے تصدیق پر مبنی مارکیٹ پلیس، واضح ڈیلیوری پلانز اور آسان ہفتہ وار یا ماہانہ سبسکرپشن کے ذریعے جوڑتا ہے۔")}
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/subscribe" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#0d4e7b] px-6 text-base font-extrabold text-white shadow-[0_15px_32px_rgba(13,78,123,0.25)] transition hover:bg-[#083d61] active:scale-[0.97]">
                  Subscribe Now <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/enroll" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-6 text-base font-extrabold text-slate-800 transition hover:border-[#0d4e7b] hover:text-[#0d4e7b] active:scale-[0.97]">
                  Enroll as Gwala <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm font-bold text-slate-600">
                <span className="inline-flex items-center gap-2"><CircleCheck className="h-4 w-4 text-[#16846f]" /> {text("COD, transfer & gateway-ready", "کیش، ٹرانسفر اور گیٹ وے ریڈی")}</span>
                <span className="inline-flex items-center gap-2"><CircleCheck className="h-4 w-4 text-[#16846f]" /> {text("Pause or cancel eligible plans", "اہل پلان روکیں یا منسوخ کریں")}</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[500px] lg:mx-0">
              <div className="absolute -left-8 top-8 h-48 w-48 rounded-full bg-[#d7efe8] blur-2xl" />
              <div className="absolute -right-8 bottom-2 h-56 w-56 rounded-full bg-[#d9e9f6] blur-2xl" />
              <div className="relative overflow-hidden rounded-[2.25rem] border border-white/70 bg-[linear-gradient(145deg,#eaf5f1_0%,#fefefe_52%,#d8e8f5_100%)] p-5 shadow-[0_25px_70px_rgba(27,67,87,0.16)] sm:p-7">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-2 text-xs font-extrabold text-[#126b59] shadow-sm"><ShieldCheck className="h-4 w-4" /> Trust-first delivery</div>
                  <span className="text-xs font-bold text-slate-500">khalis.doodh</span>
                </div>
                <div className="relative mt-8 min-h-64 overflow-hidden rounded-[1.75rem] bg-[#0d4e7b] p-6 text-white">
                  <div className="absolute -right-10 -top-16 h-52 w-52 rounded-full border-[20px] border-[#3c9b95]/45" />
                  <div className="absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-[#16846f]/50 blur-md" />
                  <div className="relative z-10 flex h-full flex-col justify-between">
                    <div className="flex items-center justify-between"><span className="rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-extrabold tracking-wide">YOUR DAILY ROUTE</span><Droplets className="h-5 w-5 text-[#b9e9d9]" /></div>
                    <div>
                      <p className="text-sm font-semibold text-[#c8e6f6]">Start with what matters</p>
                      <p className="mt-1 max-w-64 text-3xl font-extrabold leading-tight tracking-[-0.05em]">Clear plans. Better local choices.</p>
                    </div>
                  </div>
                </div>
                <div className="relative z-10 -mt-4 mx-3 grid grid-cols-3 gap-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-lg sm:mx-5 sm:gap-3 sm:p-4">
                  {[
                    [BadgeCheck, "Verified", "reviewed"],
                    [Milk, "Your plan", "your litres"],
                    [CalendarDays, "Your route", "your schedule"],
                  ].map(([Icon, title, subtitle]) => {
                    const Component = Icon as typeof BadgeCheck;
                    return <div key={title as string} className="min-w-0"><Component className="mb-2 h-4 w-4 text-[#16846f]" /><p className="truncate text-[11px] font-extrabold text-slate-800">{title as string}</p><p className="truncate text-[10px] text-slate-500">{subtitle as string}</p></div>;
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-y border-slate-200 bg-white py-18 md:py-24">
          <div className="container">
            <div className="max-w-xl"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#16846f]">Simple by design</p><h2 className="mt-3 text-3xl font-extrabold tracking-[-0.045em] text-slate-950 md:text-4xl">A better way to plan your daily milk.</h2></div>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {steps.map(step => {
                const Icon = step.icon;
                return <article key={step.number} className="group rounded-3xl border border-slate-200 bg-[#fbfcfa] p-7 transition hover:-translate-y-1 hover:border-[#b9d8d1] hover:shadow-[0_18px_35px_rgba(33,78,89,0.08)]">
                  <div className="flex items-start justify-between"><span className="text-xs font-black tracking-[0.14em] text-[#16846f]">{step.number}</span><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#e5f3ee] text-[#116a5a]"><Icon className="h-5 w-5" /></span></div>
                  <h3 className="mt-10 text-xl font-extrabold tracking-[-0.03em]">{step.title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{step.body}</p>
                </article>;
              })}
            </div>
          </div>
        </section>

        <section id="trust" className="bg-[#102f45] py-18 text-white md:py-24">
          <div className="container grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#9bd9ca]">The trust layer</p><h2 className="mt-4 text-3xl font-extrabold tracking-[-0.05em] sm:text-4xl">A marketplace designed to make quality visible.</h2><p className="mt-5 max-w-md leading-7 text-[#c9dce5]">Every gwala begins in review. Customers can see verified status, delivery areas, pricing and availability before choosing a plan.</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[ [ShieldCheck, "Verification review", "CNIC and area proof are submitted for admin review before a verified badge appears."], [BadgeCheck, "Clear quality signals", "Delivery feedback and complaints help surface patterns that need attention."], [CalendarDays, "Delivery visibility", "Customers and gwalas can see the same schedule, status and upcoming plan details."], [Droplets, "Built for local routes", "Simple controls are designed for people managing delivery every day."], ].map(([Icon, title, body]) => { const Component = Icon as typeof ShieldCheck; return <div key={title as string} className="rounded-3xl border border-white/10 bg-white/[0.06] p-6"><Component className="h-5 w-5 text-[#9bd9ca]" /><h3 className="mt-6 text-lg font-extrabold">{title as string}</h3><p className="mt-2 text-sm leading-6 text-[#c9dce5]">{body as string}</p></div>; })}
            </div>
          </div>
        </section>

        <section className="bg-[#edf6f3] py-16 md:py-20"><div className="container flex flex-col items-start justify-between gap-7 lg:flex-row lg:items-center"><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#16846f]">Ready when you are</p><h2 className="mt-3 text-3xl font-extrabold tracking-[-0.05em] text-slate-950">Your next delivery can start here.</h2></div><div className="flex flex-col gap-3 sm:flex-row"><Link href="/subscribe" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-[#0d4e7b] px-6 font-extrabold text-white transition hover:bg-[#083d61]">Subscribe Now <ArrowRight className="h-4 w-4" /></Link><Link href="/enroll" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl border border-[#93beb4] bg-white px-6 font-extrabold text-[#0d4e7b] transition hover:border-[#0d4e7b]">Enroll as Gwala</Link></div></div></section>
      </main>
      <footer className="border-t border-slate-200 bg-white py-8"><div className="container flex flex-col gap-4 text-sm text-slate-500 lg:flex-row lg:items-center lg:justify-between"><BrandMark /><div className="flex flex-wrap gap-x-4 gap-y-2 font-semibold"><Link href="/help">{text("Help", "مدد")}</Link><Link href="/terms">{text("Terms", "شرائط")}</Link><Link href="/privacy">{text("Privacy", "رازداری")}</Link><Link href="/refund-policy">{text("Refunds", "رقم واپسی")}</Link><Link href="/status">{text("Status", "سروس حالت")}</Link></div><p>{text("Fresh local connections, with a clearer path to trust.", "تازہ مقامی روابط، اعتماد کی واضح راہ کے ساتھ۔")}</p></div></footer>
      <SupportChat />
    </div>
  );
}
