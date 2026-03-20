// Supabase Edge Function (Deno)
declare const Deno: any;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type LanguagePreference = "english" | "hindi" | "hinglish";
type TicketType = "help" | "complaint" | "feedback";

type TicketDraft = {
  supportTypeOptionId: string;
  ticketType: TicketType;
  subject: string;
  description: string;
  bookingId: string;
  serviceId: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const trimText = (value: unknown, max = 1200) => String(value || "").trim().slice(0, max);

const extractUuid = (text: string) => {
  const match = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  return match ? match[0] : "";
};

const getDraftMeta = (intent: string): { supportTypeOptionId: string; ticketType: TicketType; subject: string } => {
  if (intent === "payment") {
    return {
      supportTypeOptionId: "payment_help",
      ticketType: "help",
      subject: "Need help with payment",
    };
  }

  if (intent === "safety_or_behavior") {
    return {
      supportTypeOptionId: "safety_complaint",
      ticketType: "complaint",
      subject: "Safety complaint",
    };
  }

  if (intent === "booking_status" || intent === "booking_changes") {
    return {
      supportTypeOptionId: "booking_help",
      ticketType: "help",
      subject: "Need help with booking",
    };
  }

  return {
    supportTypeOptionId: "service_issue",
    ticketType: "complaint",
    subject: "Service issue complaint",
  };
};

const buildTicketDraft = (intent: string, userMessage: string): TicketDraft => {
  const meta = getDraftMeta(intent);
  const extractedId = extractUuid(userMessage);

  return {
    supportTypeOptionId: meta.supportTypeOptionId,
    ticketType: meta.ticketType,
    subject: meta.subject,
    description: userMessage,
    bookingId: extractedId,
    serviceId: "",
  };
};

const getLanguageInstruction = (language: LanguagePreference) => {
  if (language === "hindi") {
    return "Reply only in simple Hindi using Devanagari script. Even if user writes in Hinglish/Roman, still reply in Hindi script.";
  }
  if (language === "hinglish") {
    return "Reply only in simple Hinglish (Roman Hindi + easy English). Do not use Devanagari script.";
  }
  return "Reply only in simple English.";
};

const inferIntent = (text: string) => {
  const t = text.toLowerCase();

  if (/refund|payment|paid|upi|cash|money|charge/.test(t)) return "payment";
  if (/late|arrive|on the way|status|track|tracking|delay/.test(t)) return "booking_status";
  if (/cancel|reschedule/.test(t)) return "booking_changes";
  if (/bad|rude|misbehave|unsafe|safety|abuse|threat/.test(t)) return "safety_or_behavior";
  if (/login|password|account|profile/.test(t)) return "account";
  if (/complaint|support|help|issue|problem/.test(t)) return "general_support";
  return "other";
};

const suggestLinks = (intent: string, role: string) => {
  const links: Array<{ label: string; url: string }> = [];

  if (role === "provider") {
    links.push({ label: "Open Provider Dashboard", url: "/dashboard/provider" });
  } else if (role === "admin") {
    links.push({ label: "Open Admin Dashboard", url: "/dashboard/admin" });
  } else {
    links.push({ label: "Open Seeker Dashboard", url: "/dashboard/seeker" });
  }

  if (intent === "payment") {
    links.push({ label: "Open Support Center", url: "/support" });
  } else if (intent === "safety_or_behavior") {
    links.push({ label: "Raise Safety Complaint", url: "/support" });
  } else if (intent === "booking_status" || intent === "booking_changes") {
    links.push({ label: "View Recent Orders", url: role === "provider" ? "/dashboard/provider" : "/dashboard/seeker" });
    links.push({ label: "Support Center", url: "/support" });
  } else {
    links.push({ label: "Support Center", url: "/support" });
  }

  const unique = new Map<string, { label: string; url: string }>();
  for (const item of links) {
    if (!unique.has(item.url)) unique.set(item.url, item);
  }

  return Array.from(unique.values()).slice(0, 3);
};

Deno.serve(async (req: any) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const userMessage = trimText(body?.message, 1500);
    const languagePreference: LanguagePreference =
      body?.languagePreference === "hindi" || body?.languagePreference === "hinglish"
        ? body.languagePreference
        : "english";

    const role = trimText(body?.role, 30) || "seeker";
    const incomingMessages = Array.isArray(body?.recentMessages) ? (body.recentMessages as ChatMessage[]) : [];

    if (!userMessage) {
      const draft = buildTicketDraft("general_support", "");
      return new Response(
        JSON.stringify({
          reply: "Please write your support question.",
          languageUsed: languagePreference,
          intent: "general_support",
          suggestCreateTicket: false,
          links: suggestLinks("general_support", role),
          ticketDraft: draft,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const intent = inferIntent(userMessage);

    const safeHistory = incomingMessages
      .slice(-8)
      .map((msg) => ({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: trimText(msg.content, 700),
      }))
      .filter((msg) => msg.content.length > 0);

    const systemPrompt = [
      "You are SuperService Support AI.",
      "Scope: complaint and support related help only.",
      "Goal: resolve common issues quickly so admin workload is reduced.",
      "Rules:",
      "1) Keep responses short, practical, and step-by-step.",
      "2) Ask at most one clarifying question if needed.",
      "3) If user issue needs human action, say clearly to create/support ticket and mention Booking ID and Service ID.",
      "4) Never provide legal, medical, financial, or unrelated advice.",
      "5) If user asks unrelated question, politely redirect to support topics.",
      "6) Keep tone calm and respectful.",
      `7) ${getLanguageInstruction(languagePreference)}`,
    ].join("\n");

    const userInstruction = [
      `User role: ${role}`,
      `Detected support intent: ${intent}`,
      "Respond with practical guidance for this platform using plain words.",
      "If useful, include one short section titled 'Next step'.",
      `User message: ${userMessage}`,
    ].join("\n");

    const messages = [
      { role: "system", content: systemPrompt },
      ...safeHistory,
      { role: "user", content: userInstruction },
    ];

    const llmRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages,
        temperature: 0.25,
        max_tokens: 500,
      }),
    });

    if (!llmRes.ok) {
      const text = await llmRes.text();
      return new Response(JSON.stringify({ error: `AI provider error: ${text}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const llmData = await llmRes.json();
    const reply = trimText(llmData?.choices?.[0]?.message?.content || "", 3000);
    const links = suggestLinks(intent, role);
    const ticketDraft = buildTicketDraft(intent, userMessage);
    const suggestCreateTicket =
      intent === "safety_or_behavior" || intent === "payment" || /ticket|support center|complaint/i.test(reply);

    return new Response(
      JSON.stringify({
        reply: reply || "Please open Support Center and share your Booking ID and Service ID for faster help.",
        languageUsed: languagePreference,
        intent,
        suggestCreateTicket,
        links,
        ticketDraft,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
