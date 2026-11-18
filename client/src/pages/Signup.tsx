import { ArrowRight, Milk, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { BrandMark } from "@/components/BrandMark";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";

const inputClass =
  "h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#0d4e7b] focus:ring-2 focus:ring-[#0d4e7b]/20";
const labelClass = "mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-500";

function AccountForm({ kind }: { kind: "customer" | "gwala" }) {
  const { text } = useLanguage();
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSuccess = () => navigate(kind === "gwala" ? "/enroll" : "/account");
  const onError = (err: { message: string }) => setError(err.message);
  const signupCustomer = trpc.auth.signupCustomer.useMutation({ onSuccess, onError });
  const signupGwala = trpc.auth.signupGwala.useMutation({ onSuccess, onError });
  const mutation = kind === "gwala" ? signupGwala : signupCustomer;

  return (
    <form
      className="mt-5 space-y-4"
      onSubmit={event => {
        event.preventDefault();
        setError(null);
        mutation.mutate({ name, email, phone: phone.trim() ? phone : undefined, password });
      }}
    >
      <div>
        <label className={labelClass}>{text("Full name", "پورا نام")}</label>
        <input required value={name} onChange={event => setName(event.target.value)} className={inputClass} placeholder={text("e.g. Ahmed Raza", "مثلاً احمد رضا")} autoComplete="name" />
      </div>
      <div>
        <label className={labelClass}>{text("Email", "ای میل")}</label>
        <input type="email" required value={email} onChange={event => setEmail(event.target.value)} className={inputClass} placeholder="you@example.com" autoComplete="email" />
      </div>
      <div>
        <label className={labelClass}>{text("Phone (optional)", "فون (اختیاری)")}</label>
        <input value={phone} onChange={event => setPhone(event.target.value)} className={inputClass} placeholder="03XX-XXXXXXX" autoComplete="tel" />
      </div>
      <div>
        <label className={labelClass}>{text("Password (min 8 characters)", "پاس ورڈ (کم از کم 8 حروف)")}</label>
        <input type="password" required minLength={8} value={password} onChange={event => setPassword(event.target.value)} className={inputClass} placeholder="••••••••" autoComplete="new-password" />
      </div>
      {error ? <p className="rounded-xl bg-[#fdecec] px-4 py-3 text-sm font-bold text-[#b42318]">{error}</p> : null}
      <button type="submit" disabled={mutation.isPending} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0d4e7b] text-sm font-extrabold text-white transition hover:bg-[#083d61] disabled:opacity-60">
        {mutation.isPending
          ? text("Creating account…", "اکاؤنٹ بن رہا ہے…")
          : kind === "gwala"
            ? text("Create gwala account", "گوالا اکاؤنٹ بنائیں")
            : text("Create my account", "میرا اکاؤنٹ بنائیں")}{" "}
        <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}

export default function Signup() {
  const { text } = useLanguage();
  return (
    <div className="min-h-screen bg-[#f7f8f5] text-slate-950">
      <header>
        <div className="container flex h-[78px] items-center justify-between gap-4">
          <BrandMark />
          <LanguageToggle compact />
        </div>
      </header>
      <main className="container pb-20 pt-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight">{text("Create your account", "اپنا اکاؤنٹ بنائیں")}</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
            {text(
              "Choose the account that fits you. Customer and gwala accounts are separate — if you later want to sell milk as a gwala, create a new gwala account.",
              "اپنے لیے موزوں اکاؤنٹ منتخب کریں۔ کسٹمر اور گوالا اکاؤنٹ الگ الگ ہوتے ہیں۔"
            )}
          </p>
        </div>
        <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#ecf7f3] px-3 py-1.5 text-xs font-extrabold text-[#116a5a]">
              <UserRound className="h-3.5 w-3.5" /> {text("For households", "گھروں کے لیے")}
            </div>
            <h2 className="mt-4 text-2xl font-extrabold">{text("Sign Up", "سائن اپ")}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {text("Order daily milk from a verified local gwala. Your account is active right away — customers are always free.", "تصدیق شدہ مقامی گوالے سے روزانہ دودھ منگوائیں۔ آپ کا اکاؤنٹ فوراً فعال ہو جاتا ہے۔")}
            </p>
            <AccountForm kind="customer" />
          </section>
          <section className="rounded-[2rem] border-2 border-[#0d4e7b]/25 bg-white p-7 shadow-sm">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#e8f1f8] px-3 py-1.5 text-xs font-extrabold text-[#0d4e7b]">
              <Milk className="h-3.5 w-3.5" /> {text("For milk sellers", "دودھ بیچنے والوں کے لیے")}
            </div>
            <h2 className="mt-4 text-2xl font-extrabold">{text("Sign Up as Gwala", "گوالے کے طور پر سائن اپ")}</h2>
            <p className="mt-2 flex items-start gap-2 text-sm leading-6 text-slate-600">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#16846f]" />
              {text("Next step: enrollment with your CNIC and area proof. Your route goes live only after admin verification.", "اگلا مرحلہ: شناختی کارڈ اور ایریا ثبوت کے ساتھ اندراج۔ آپ کا روٹ ایڈمن تصدیق کے بعد ہی لائیو ہوتا ہے۔")}
            </p>
            <AccountForm kind="gwala" />
          </section>
        </div>
        <p className="mt-8 text-center text-sm font-semibold text-slate-600">
          {text("Already have an account?", "پہلے سے اکاؤنٹ ہے؟")}{" "}
          <Link href="/login" className="font-extrabold text-[#0d4e7b] hover:underline">
            {text("Sign in", "سائن ان")}
          </Link>
        </p>
      </main>
    </div>
  );
}
