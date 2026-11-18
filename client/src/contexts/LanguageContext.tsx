import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type AppLanguage = "en" | "ur";

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  toggleLanguage: () => void;
  text: (english: string, urdu: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>(() => {
    if (typeof window === "undefined") return "en";
    return window.localStorage.getItem("khalis-doodh-language") === "ur" ? "ur" : "en";
  });

  useEffect(() => {
    window.localStorage.setItem("khalis-doodh-language", language);
    document.documentElement.lang = language === "ur" ? "ur" : "en";
    document.documentElement.dir = language === "ur" ? "rtl" : "ltr";
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    toggleLanguage: () => setLanguage(current => current === "en" ? "ur" : "en"),
    text: (english, urdu) => language === "ur" ? urdu : english,
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used within a LanguageProvider.");
  return value;
}
