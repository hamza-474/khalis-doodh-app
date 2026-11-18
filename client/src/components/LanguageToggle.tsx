import { Languages } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { language, toggleLanguage } = useLanguage();
  return <button type="button" onClick={toggleLanguage} className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white font-extrabold text-slate-700 transition hover:border-[#16846f] hover:text-[#116a5a] active:scale-[0.97] ${compact ? "h-10 px-3 text-xs" : "h-11 px-3 text-sm"}`} aria-label="Switch language"><Languages className="h-4 w-4" />{language === "en" ? "اردو" : "EN"}</button>;
}
