import { useMemo, useState } from "react";
import { Bot, Languages, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type LanguagePreference = "english" | "hindi" | "hinglish";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
};

type LinkItem = {
  label: string;
  url: string;
};

type TicketDraft = {
  supportTypeOptionId: string;
  ticketType: "help" | "complaint" | "feedback";
  subject: string;
  description: string;
  bookingId: string;
  serviceId: string;
};

type ResolutionChoice = "yes" | "no" | "exit";
type ExpectedQA = { q: string; a: string };

const languageLabel: Record<LanguagePreference, string> = {
  english: "English",
  hindi: "Hindi",
  hinglish: "Hinglish",
};

const initialMessageByLanguage: Record<LanguagePreference, string> = {
  english:
    "Hello! I am Support AI. I can help with complaints, support, refunds, booking status, and what to do next.",
  hindi:
    "नमस्ते! मैं सपोर्ट AI हूँ। मैं शिकायत, सपोर्ट, रिफंड, बुकिंग स्टेटस और अगले कदम में आपकी मदद कर सकता हूँ।",
  hinglish:
    "Namaste! Main Support AI hoon. Main complaint, support, refund, booking status aur next step mein help kar sakta hoon.",
};

const placeholderByLanguage: Record<LanguagePreference, string> = {
  english: "Type your support issue...",
  hindi: "अपनी समस्या लिखें...",
  hinglish: "Apni problem yahan likho...",
};

const expectedQaByLanguage: Record<LanguagePreference, ExpectedQA[]> = {
  english: [
    { q: "Provider came late. What can I do?", a: "1) Check order status. 2) Wait 10-15 min. 3) If still late, raise complaint with Booking ID." },
    { q: "My payment is stuck.", a: "1) Open booking. 2) Check payment status. 3) Raise payment help ticket with Booking ID + Service ID." },
    { q: "How to raise complaint with Booking ID?", a: "Open Support, choose issue type, add short problem, then paste Booking ID and submit." },
    { q: "Provider did not arrive.", a: "Please check status once. If provider did not arrive, create complaint and mention no-show." },
    { q: "Provider asked extra money.", a: "Do not pay extra outside app. Raise complaint and mention amount asked." },
    { q: "How to get refund?", a: "Create payment/refund ticket with Booking ID. Support team will verify and update you." },
    { q: "I want to cancel booking.", a: "Open your order and cancel before work starts. If stuck, raise booking help ticket." },
    { q: "How to reschedule service?", a: "Open Support and ask for reschedule with preferred date/time." },
    { q: "Service quality was bad.", a: "Raise service issue complaint. Add what went wrong in 1-2 lines." },
    { q: "Wrong service delivered.", a: "Create complaint and mention expected vs delivered service." },
    { q: "How to track my booking?", a: "Go to dashboard Recent Orders. You can see live status there." },
    { q: "I forgot my account password.", a: "Use Forgot Password on login page. If not working, create account help ticket." },
    { q: "App is not sending notifications.", a: "Enable notification permission in phone/browser settings and refresh app." },
    { q: "Provider behavior was unsafe.", a: "Please raise Safety Complaint immediately with Booking ID." },
    { q: "How long support reply takes?", a: "Usually support replies soon. Urgent safety/payment issues are prioritized." },
  ],
  hindi: [
    { q: "प्रोवाइडर देर से आया। मुझे क्या करना चाहिए?", a: "1) ऑर्डर स्टेटस देखें। 2) 10-15 मिनट इंतज़ार करें। 3) फिर भी देर हो तो Booking ID के साथ शिकायत करें।" },
    { q: "मेरा पेमेंट अटका हुआ है।", a: "1) बुकिंग खोलें। 2) पेमेंट स्टेटस देखें। 3) Booking ID + Service ID के साथ पेमेंट टिकट बनाएं।" },
    { q: "Booking ID के साथ शिकायत कैसे करें?", a: "Support खोलें, Issue Type चुनें, समस्या लिखें, Booking ID डालें और सबमिट करें।" },
    { q: "प्रोवाइडर आया ही नहीं।", a: "एक बार स्टेटस चेक करें। अगर नहीं आया तो no-show लिखकर शिकायत दर्ज करें।" },
    { q: "प्रोवाइडर ने extra पैसे मांगे।", a: "ऐप के बाहर extra पैसे न दें। तुरंत शिकायत करें और रकम लिखें।" },
    { q: "रिफंड कैसे मिलेगा?", a: "Booking ID के साथ payment/refund टिकट बनाएं। सपोर्ट जांचकर अपडेट देगा।" },
    { q: "मुझे बुकिंग कैंसिल करनी है।", a: "काम शुरू होने से पहले ऑर्डर से cancel करें। समस्या हो तो booking help टिकट बनाएं।" },
    { q: "सेवा reschedule कैसे करें?", a: "Support में नई तारीख/समय लिखकर reschedule के लिए अनुरोध करें।" },
    { q: "सेवा की quality खराब थी।", a: "Service issue शिकायत बनाएं और 1-2 लाइन में समस्या लिखें।" },
    { q: "गलत सेवा दी गई।", a: "शिकायत में expected सेवा और मिली हुई सेवा दोनों लिखें।" },
    { q: "बुकिंग ट्रैक कैसे करें?", a: "डैशबोर्ड के Recent Orders में जाकर लाइव स्टेटस देखें।" },
    { q: "मैं पासवर्ड भूल गया/गई।", a: "लॉगिन पेज पर Forgot Password दबाएं। काम न करे तो account help टिकट बनाएं।" },
    { q: "नोटिफिकेशन नहीं आ रहे हैं।", a: "फोन/ब्राउज़र सेटिंग में notifications allow करें और ऐप refresh करें।" },
    { q: "प्रोवाइडर का व्यवहार unsafe था।", a: "तुरंत Safety Complaint दर्ज करें और Booking ID जोड़ें।" },
    { q: "सपोर्ट जवाब में कितना समय लगता है?", a: "आम तौर पर जल्दी जवाब आता है। safety/payment मामलों को पहले देखा जाता है।" },
  ],
  hinglish: [
    { q: "Provider late aaya, kya karun?", a: "1) Order status check karo. 2) 10-15 min wait karo. 3) Fir bhi late ho to Booking ID ke sath complaint karo." },
    { q: "Mera payment stuck hai.", a: "1) Booking kholo. 2) Payment status check karo. 3) Booking ID + Service ID ke sath payment ticket banao." },
    { q: "Booking ID ke saath complaint kaise karun?", a: "Support kholo, Issue Type choose karo, problem likho, Booking ID add karke submit karo." },
    { q: "Provider aaya hi nahi.", a: "Ek baar status check karo. Agar nahi aaya to no-show likh kar complaint karo." },
    { q: "Provider extra paise maang raha hai.", a: "App ke bahar extra payment mat do. Complaint me amount mention karo." },
    { q: "Refund kaise milega?", a: "Booking ID ke sath payment/refund ticket banao. Support verify karke update dega." },
    { q: "Mujhe booking cancel karni hai.", a: "Kaam start hone se pehle order se cancel karo. Issue ho to booking help ticket banao." },
    { q: "Service reschedule kaise kare?", a: "Support me preferred date/time likh kar reschedule request bhejo." },
    { q: "Service quality bahut kharab thi.", a: "Service issue complaint banao aur 1-2 line me problem likho." },
    { q: "Galat service di gayi.", a: "Complaint me expected aur delivered service dono likho." },
    { q: "Booking track kaise karu?", a: "Dashboard ke Recent Orders me live status mil jayega." },
    { q: "Mera password bhool gaya.", a: "Login page par Forgot Password use karo. Na ho to account help ticket banao." },
    { q: "Notification nahi aa rahe.", a: "Phone/browser settings me notifications allow karo aur app refresh karo." },
    { q: "Provider behavior unsafe tha.", a: "Turant Safety Complaint banao aur Booking ID add karo." },
    { q: "Support reply kitne time me aata hai?", a: "Usually jaldi reply aata hai. Safety/payment issues ko priority milti hai." },
  ],
};

const linkTextByLanguage: Record<LanguagePreference, string> = {
  english: "Helpful links",
  hindi: "उपयोगी लिंक",
  hinglish: "Useful links",
};

const expectedQuestionsTitleByLanguage: Record<LanguagePreference, string> = {
  english: "Expected questions you can ask first",
  hindi: "शुरुआत में आप ये सवाल पूछ सकते हैं",
  hinglish: "Shuruat me aap ye sawal pooch sakte ho",
};

const resolutionQuestionByLanguage: Record<LanguagePreference, string> = {
  english: "Did your problem get solved?",
  hindi: "क्या आपकी समस्या हल हो गई?",
  hinglish: "Kya aapki problem solve ho gayi?",
};

const resolutionButtonTextByLanguage: Record<LanguagePreference, { yes: string; no: string; exit: string }> = {
  english: { yes: "Yes", no: "No", exit: "Exit Chat" },
  hindi: { yes: "हाँ", no: "नहीं", exit: "चैट से बाहर जाएं" },
  hinglish: { yes: "Haan", no: "Nahi", exit: "Chat se bahar jaye" },
};

const followUpReplyByLanguage: Record<LanguagePreference, { yes: string; no: string }> = {
  english: {
    yes: "Great. Happy to help. If needed, you can ask another support question.",
    no: "No problem. Please share Booking ID or Service ID and I will guide the next exact step.",
  },
  hindi: {
    yes: "बहुत अच्छा। मदद करके खुशी हुई। जरूरत हो तो आप एक और सपोर्ट सवाल पूछ सकते हैं।",
    no: "कोई बात नहीं। कृपया Booking ID या Service ID दें, मैं अगला सही कदम बताऊंगा।",
  },
  hinglish: {
    yes: "Bahut achha. Help karke khushi hui. Zarurat ho to ek aur support sawal pooch sakte ho.",
    no: "Koi baat nahi. Please Booking ID ya Service ID share karo, main next exact step bataunga.",
  },
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getSimpleSupportReply = (language: LanguagePreference, text: string) => {
  const t = text.toLowerCase();
  const isPayment = /payment|refund|paid|upi|cash|money|पेमेंट|रिफंड/.test(t);
  const isLate = /late|delay|arrive|देर|लेट|arrived/.test(t);
  const isComplaint = /complaint|issue|problem|शिकायत|समस्या/.test(t);

  if (language === "hindi") {
    if (isPayment) {
      return "मैं मदद करता हूँ।\n1) अपनी बुकिंग खोलें।\n2) पेमेंट स्टेटस देखें।\n3) अगर पेमेंट अटका है तो टिकट बनाएं और Booking ID + Service ID जोड़ें।";
    }
    if (isLate) {
      return "समझ गया।\n1) ऑर्डर स्टेटस चेक करें।\n2) 15 मिनट से ज्यादा देरी हो तो Support में शिकायत करें।\n3) टिकट में Booking ID लिखें।";
    }
    if (isComplaint) {
      return "ठीक है।\n1) Support में जाएं।\n2) Issue Type चुनें।\n3) छोटा विवरण लिखें और Booking ID + Service ID जोड़ें।";
    }
    return "मैं आपकी मदद करूंगा। कृपया अपनी समस्या 1-2 लाइन में लिखें और Booking ID/Service ID हो तो भेजें।";
  }

  if (language === "hinglish") {
    if (isPayment) {
      return "Main help karta hoon.\n1) Booking kholo.\n2) Payment status check karo.\n3) Payment stuck ho to ticket banao aur Booking ID + Service ID add karo.";
    }
    if (isLate) {
      return "Samajh gaya.\n1) Order status check karo.\n2) 15 min se zyada delay ho to Support me complaint karo.\n3) Ticket me Booking ID likho.";
    }
    if (isComplaint) {
      return "Theek hai.\n1) Support me jao.\n2) Issue Type choose karo.\n3) Chhota detail likho aur Booking ID + Service ID add karo.";
    }
    return "Main help karunga. Problem 1-2 line me likho, aur Booking ID/Service ID ho to bhejo.";
  }

  if (isPayment) {
    return "I will help.\n1) Open your booking.\n2) Check payment status.\n3) If payment is stuck, create ticket with Booking ID + Service ID.";
  }
  if (isLate) {
    return "Understood.\n1) Check order status.\n2) If delay is more than 15 minutes, raise support complaint.\n3) Add Booking ID in ticket.";
  }
  if (isComplaint) {
    return "Sure.\n1) Open Support.\n2) Select issue type.\n3) Write short details and add Booking ID + Service ID.";
  }
  return "I can help. Please write your issue in 1-2 lines and share Booking ID/Service ID if available.";
};

const SupportAiAssistant = ({
  role,
  onApplyDraft,
  onExitChat,
}: {
  role: string | null | undefined;
  onApplyDraft?: (draft: TicketDraft) => void;
  onExitChat?: () => void;
}) => {
  const { toast } = useToast();
  const [language, setLanguage] = useState<LanguagePreference | "">("");
  const [chatStarted, setChatStarted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [ticketDraft, setTicketDraft] = useState<TicketDraft | null>(null);
  const [showResolutionPrompt, setShowResolutionPrompt] = useState(false);
  const [usedExpectedQuestions, setUsedExpectedQuestions] = useState<string[]>([]);

  const normalizePrompt = (value: string) => value.trim().toLowerCase();

  const addAssistantMessageStreamed = async (fullText: string) => {
    const messageId = `${Date.now()}-assistant`;
    setMessages((prev) => [...prev, { id: messageId, role: "assistant", text: "" }]);

    const words = String(fullText || "").split(/\s+/).filter(Boolean);
    let draft = "";
    for (let i = 0; i < words.length; i += 1) {
      draft = `${draft}${i === 0 ? "" : " "}${words[i]}`;
      setMessages((prev) => prev.map((item) => (item.id === messageId ? { ...item, text: draft } : item)));
      await wait(22);
    }
  };

  const quickPrompts = useMemo(() => {
    if (!language) return [];
    const usedSet = new Set(usedExpectedQuestions.map((item) => normalizePrompt(item)));
    return expectedQaByLanguage[language]
      .map((item) => item.q)
      .filter((q) => !usedSet.has(normalizePrompt(q)));
  }, [language, usedExpectedQuestions]);

  const findExpectedAnswer = (lang: LanguagePreference, question: string) => {
    const normalized = normalizePrompt(question);
    const item = expectedQaByLanguage[lang].find((qa) => normalizePrompt(qa.q) === normalized);
    return item?.a || "";
  };

  const resetChatSession = () => {
    setChatStarted(false);
    setMessages([]);
    setInput("");
    setLoading(false);
    setLinks([]);
    setTicketDraft(null);
    setShowResolutionPrompt(false);
    setUsedExpectedQuestions([]);
  };

  const startChat = () => {
    if (!language) {
      toast({ title: "Select language", description: "Please choose a language first.", variant: "destructive" });
      return;
    }

    setChatStarted(true);
    setLinks([]);
    setTicketDraft(null);
    setShowResolutionPrompt(false);
    setUsedExpectedQuestions([]);
    setMessages([
      {
        id: `${Date.now()}-init`,
        role: "assistant",
        text: initialMessageByLanguage[language],
      },
    ]);
  };

  const sendMessage = async (messageText?: string) => {
    if (!chatStarted || !language || loading) return;

    const text = (messageText ?? input).trim();
    if (!text) return;

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      text,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setShowResolutionPrompt(false);

    const isQuickOptionClick = typeof messageText === "string" && messageText.trim().length > 0;
    const normalizedIncoming = normalizePrompt(text);
    const matchedQuickPrompt = language
      ? expectedQaByLanguage[language].find((qa) => normalizePrompt(qa.q) === normalizedIncoming)
      : null;

    if (matchedQuickPrompt) {
      setUsedExpectedQuestions((prev) => {
        const set = new Set(prev.map((item) => normalizePrompt(item)));
        if (set.has(normalizedIncoming)) return prev;
        return [...prev, matchedQuickPrompt.q];
      });
    }

    if (isQuickOptionClick) {
      const instantReply = findExpectedAnswer(language, text) || getSimpleSupportReply(language, text);
      await addAssistantMessageStreamed(instantReply);
      setLoading(false);
      setShowResolutionPrompt(true);
      return;
    }

    const recentMessages = nextMessages.slice(-10).map((item) => ({
      role: item.role,
      content: item.text,
    }));

    const { data, error } = await supabase.functions.invoke("support-assistant", {
      body: {
        message: text,
        languagePreference: language,
        role: role || "seeker",
        recentMessages,
      },
    });

    setLoading(false);

    if (error || !data?.reply) {
      const fallbackText = getSimpleSupportReply(language, text);

      await addAssistantMessageStreamed(fallbackText);
      setTicketDraft(null);
      setLoading(false);
      setShowResolutionPrompt(true);

      return;
    }

    await addAssistantMessageStreamed(String(data.reply));

    setLinks(Array.isArray(data.links) ? data.links : []);
    setTicketDraft(data.ticketDraft ?? null);
    setLoading(false);
    setShowResolutionPrompt(true);
  };

  const handleResolutionChoice = async (choice: ResolutionChoice) => {
    if (!language || loading) return;

    if (choice === "exit") {
      resetChatSession();
      if (onExitChat) {
        onExitChat();
      }
      return;
    }

    setShowResolutionPrompt(false);

    const followUpText = choice === "yes" ? followUpReplyByLanguage[language].yes : followUpReplyByLanguage[language].no;
    await addAssistantMessageStreamed(followUpText);
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-secondary/20 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Bot className="h-4 w-4 text-accent" /> AI Support Assistant
          </h2>
          <p className="text-xs text-muted-foreground">
            Support and complaint help only. AI can guide you and reduce manual support steps.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-2 py-1 text-[11px] text-muted-foreground">
          <Sparkles className="h-3 w-3" /> Beta
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label className="flex items-center gap-1">
            <Languages className="h-3.5 w-3.5" /> Language
          </Label>
          <Select value={language || undefined} onValueChange={(value) => setLanguage(value as LanguagePreference)}>
            <SelectTrigger>
              <SelectValue placeholder="Choose language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="english">English</SelectItem>
              <SelectItem value="hindi">Hindi (हिंदी)</SelectItem>
              <SelectItem value="hinglish">Hinglish</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button className="w-full" variant="outline" onClick={startChat}>
            {chatStarted ? "Restart Chat" : "Start Chat"}
          </Button>
        </div>
      </div>

      {chatStarted && language && (
        <>
          <div className="mt-3 max-h-[34dvh] space-y-2 overflow-y-auto rounded-xl border border-border/60 bg-background/40 p-2.5 sm:max-h-[260px] sm:p-3">
            {messages.map((item) => (
              <div
                key={item.id}
                className={`rounded-lg px-3 py-2 text-sm ${
                  item.role === "assistant"
                    ? "border border-border/50 bg-background text-foreground"
                    : "ml-6 bg-accent/15 text-foreground"
                }`}
              >
                <p className="whitespace-pre-wrap break-words leading-relaxed">{item.text}</p>
              </div>
            ))}
            {loading && (
              <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm text-muted-foreground">
                {language === "hindi" ? "AI जवाब लिख रहा है..." : language === "hinglish" ? "AI reply likh raha hai..." : "AI is typing..."}
              </div>
            )}
          </div>

          <div className="mt-3 rounded-xl border border-border/60 bg-background/40 p-2.5 sm:p-3">
            <p className="w-full text-xs text-muted-foreground">{expectedQuestionsTitleByLanguage[language]}</p>
            {quickPrompts.length === 0 && (
              <p className="text-xs text-muted-foreground">
                {language === "hindi"
                  ? "इस चैट में सभी सुझाए गए सवाल पूछे जा चुके हैं।"
                  : language === "hinglish"
                    ? "Is chat me saare suggested questions use ho chuke hain."
                    : "All suggested questions are already used in this chat."}
              </p>
            )}
            <div className="mt-2 max-h-32 space-y-2 overflow-y-auto pr-1">
              {quickPrompts.map((prompt) => (
                <Button
                  key={prompt}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto min-h-9 w-full justify-start whitespace-normal text-left"
                  onClick={() => void sendMessage(prompt)}
                >
                  {prompt}
                </Button>
              ))}
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={placeholderByLanguage[language]}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              className="sm:flex-1"
            />
            <Button onClick={() => void sendMessage()} disabled={loading || !input.trim()} className="w-full sm:w-auto">
              <Send className="mr-1 h-4 w-4" /> Send
            </Button>
          </div>

          {links.length > 0 && (
            <div className="mt-3 rounded-xl border border-border/60 bg-background/50 p-3">
              <p className="text-xs font-semibold text-foreground">{linkTextByLanguage[language]}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {links.map((item) => (
                  <a
                    key={`${item.url}-${item.label}`}
                    href={item.url}
                    className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs text-foreground transition-colors hover:bg-secondary/70"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          )}

          {ticketDraft && onApplyDraft && (
            <div className="mt-3 rounded-xl border border-accent/40 bg-accent/10 p-3">
              <p className="text-xs text-foreground">AI prepared a support ticket draft from your chat.</p>
              <Button
                type="button"
                size="sm"
                className="mt-2"
                onClick={() => onApplyDraft(ticketDraft)}
              >
                Apply AI draft to ticket form
              </Button>
            </div>
          )}

          {showResolutionPrompt && (
            <div className="mt-3 rounded-xl border border-border/60 bg-background/60 p-3">
              <p className="text-sm font-medium text-foreground">{resolutionQuestionByLanguage[language]}</p>
              <div className="mt-2 grid gap-2 sm:flex sm:flex-wrap">
                <Button type="button" size="sm" className="w-full sm:min-w-16 sm:w-auto" onClick={() => void handleResolutionChoice("yes")}>{resolutionButtonTextByLanguage[language].yes}</Button>
                <Button type="button" size="sm" variant="outline" className="w-full sm:min-w-16 sm:w-auto" onClick={() => void handleResolutionChoice("no")}>{resolutionButtonTextByLanguage[language].no}</Button>
                <Button type="button" size="sm" variant="ghost" className="w-full sm:min-w-28 sm:w-auto" onClick={() => void handleResolutionChoice("exit")}>{resolutionButtonTextByLanguage[language].exit}</Button>
              </div>
            </div>
          )}

          <p className="mt-2 text-[11px] text-muted-foreground">
            {language === "hindi"
              ? "नोट: गंभीर मामलों में टिकट बनाएं और Booking ID + Service ID जोड़ें।"
              : language === "hinglish"
                ? "Note: Serious issue me ticket banao aur Booking ID + Service ID add karo."
                : "Note: For serious issues, create a ticket with Booking ID + Service ID."}
          </p>
        </>
      )}

      {chatStarted && language && (
        <p className="mt-2 text-[11px] text-muted-foreground">Language selected: {languageLabel[language]}</p>
      )}
    </div>
  );
};

export default SupportAiAssistant;
