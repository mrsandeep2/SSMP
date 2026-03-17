//
// Supabase Edge Function (Deno). Declare Deno for local TS builds.
declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Deno.serve function with typing
Deno.serve(async (req: any) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    if (!query || query.trim().length === 0) {
      return new Response(JSON.stringify({ translated: query }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already English (basic heuristic: all ASCII)
    const isEnglish = /^[\x00-\x7F\s]+$/.test(query);
    if (isEnglish) {
      return new Response(JSON.stringify({ translated: query }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content:
              "You are a translator. Translate the user's query to English for a service marketplace search. Only output the English translation, nothing else. If it mentions household services like cooking, cleaning, etc., translate appropriately. Examples: 'khana banane wali chahiye' -> 'cook needed', 'room safai' -> 'room cleaning'.",
          },
          { role: "user", content: query },
        ],
        max_tokens: 100,
        temperature: 0.1,
      }),
    });

    const data = await res.json();
    const translated = data.choices?.[0]?.message?.content?.trim() || query;

    return new Response(JSON.stringify({ translated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message, translated: "" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
