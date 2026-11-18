import { AIChatBox, type Message } from "@/components/AIChatBox";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { MessageCircle, Sparkles, X } from "lucide-react";
import { useState } from "react";

/**
 * Stage C — public AI support chat. A floating button (Punjab blue) opens a
 * panel with the shared AIChatBox, wired to the `ai.chat` tRPC endpoint.
 * No login required. Replies come back in the visitor's own language.
 */
export function SupportChat() {
  const { text } = useLanguage();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const chat = trpc.ai.chat.useMutation({
    onSuccess: data => {
      setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
    },
    onError: () => {
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content:
            "Muazrat, abhi jawab nahi mil pa raha. Thodi dair baad dobara try karein, ya Help Center se support ticket bhej dein. / Sorry, something went wrong — please try again shortly.",
        },
      ]);
    },
  });

  const handleSend = (content: string) => {
    const next: Message[] = [...messages, { role: "user", content }];
    setMessages(next);
    chat.mutate({
      messages: next
        .filter(message => message.role === "user" || message.role === "assistant")
        .slice(-10)
        .map(message => ({ role: message.role as "user" | "assistant", content: message.content })),
    });
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 z-50 flex h-[min(580px,calc(100dvh-8rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_25px_60px_rgba(13,78,123,0.28)]">
          <div className="flex items-center gap-3 bg-[#0d4e7b] px-4 py-3 text-white">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#16846f]">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold">Khalis Assistant</p>
              <p className="truncate text-xs text-[#c8e6f6]">
                {text("AI support — replies in your language", "AI سپورٹ — آپ کی زبان میں جواب")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={text("Close chat", "چیٹ بند کریں")}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full transition hover:bg-white/15 active:scale-[0.97]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <AIChatBox
              messages={messages}
              onSendMessage={handleSend}
              isLoading={chat.isPending}
              height="100%"
              className="rounded-none border-0 shadow-none"
              placeholder={text("Type your question…", "اپنا سوال لکھیں…")}
              emptyStateMessage={text(
                "Ask about subscriptions, khata, becoming a gwala, or ratings.",
                "سبسکرپشن، کھاتے، گوالا بننے یا ریٹنگ کے بارے میں پوچھیں۔",
              )}
              suggestedPrompts={[
                "Subscription kaise kaam karti hai?",
                "Khata kya hai? Payment kab aur kisko hoti hai?",
                "Gwala kaise ban sakta hun?",
                "Rating dobara kab de sakta hun?",
                "Doodh kharab ho to shikayat kaise hogi?",
              ]}
            />
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-label={text("Open help chat", "مدد چیٹ کھولیں")}
        className="fixed bottom-5 right-5 z-50 inline-flex h-14 items-center gap-2 rounded-full bg-[#0d4e7b] px-5 text-sm font-extrabold text-white shadow-[0_15px_32px_rgba(13,78,123,0.35)] transition hover:bg-[#083d61] active:scale-[0.97]"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        {text("Help chat", "مدد چیٹ")}
      </button>
    </>
  );
}
