// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type BookingRecord = {
  id: string;
  provider_id: string;
  seeker_id: string;
  status?: string | null;
  payment_status?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  amount?: number | null;
};

type PushEventPayload = {
  event_type: "booking_created" | "booking_status_updated" | "booking_payment_requested";
  booking: BookingRecord;
  old_booking?: BookingRecord | null;
  from_status?: string | null;
  to_status?: string | null;
  trigger_actor_id?: string | null;
};

type PushTarget = {
  userId: string;
  title: string;
  body: string;
  tag: string;
  url: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

const sanitizeStatus = (status: string | null | undefined) => {
  if (!status) return "pending";
  if (status === "confirmed") return "accepted";
  if (status === "in_progress") return "started";
  return status;
};

const statusLabel = (status: string | null | undefined) => sanitizeStatus(status).replace(/_/g, " ");

const buildTarget = (payload: PushEventPayload): PushTarget | null => {
  const booking = payload.booking;
  const status = sanitizeStatus(booking.status);

  if (payload.event_type === "booking_created") {
    return {
      userId: booking.provider_id,
      title: "New service hit",
      body: "A new booking request is waiting in your Provider Hub.",
      tag: `provider-booking-${booking.id}`,
      url: "/dashboard/provider",
    };
  }

  if (
    payload.event_type === "booking_status_updated" &&
    payload.trigger_actor_id === booking.provider_id &&
    payload.old_booking?.status !== booking.status
  ) {
    const fromStatus = statusLabel(payload.from_status ?? payload.old_booking?.status);
    const toStatus = statusLabel(payload.to_status ?? booking.status);
    const title =
      status === "accepted"
        ? "Booking accepted"
        : `Booking status updated: ${toStatus}`;

    return {
      userId: booking.seeker_id,
      title,
      body: `Provider changed booking status from ${fromStatus} to ${toStatus}. Open dashboard for details.`,
      tag: `seeker-booking-status-${booking.id}-${status}`,
      url: "/dashboard/seeker",
    };
  }

  const oldPayment = payload.old_booking?.payment_status ?? "unpaid";
  const newPayment = booking.payment_status ?? oldPayment;
  if (
    payload.event_type === "booking_payment_requested" &&
    oldPayment !== newPayment &&
    newPayment === "requested"
  ) {
    return {
      userId: booking.seeker_id,
      title: "Payment requested",
      body: "Payment action is required for your booking.",
      tag: `seeker-payment-request-${booking.id}`,
      url: "/dashboard/seeker",
    };
  }

  return null;
};

Deno.serve(async (req) => {
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
    const webhookSecret = Deno.env.get("PUSH_WEBHOOK_SECRET");
    const inboundSecret = req.headers.get("x-webhook-secret");

    if (!webhookSecret || inboundSecret !== webhookSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vapidSubject = Deno.env.get("WEB_PUSH_SUBJECT");
    const vapidPublicKey = Deno.env.get("WEB_PUSH_VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY");

    if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
      return new Response(JSON.stringify({ error: "Missing VAPID settings" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as PushEventPayload;
    const target = buildTarget(payload);
    if (!target) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: subscriptions, error: fetchError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", target.userId)
      .eq("is_active", true);

    if (fetchError) throw fetchError;

    const rows = subscriptions ?? [];
    if (rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no_subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message = JSON.stringify({
      title: target.title,
      body: target.body,
      tag: target.tag,
      url: target.url,
      requireInteraction: true,
      renotify: true,
      vibrate: [250, 120, 250],
    });

    const invalidIds: string[] = [];

    await Promise.all(
      rows.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            message,
            { TTL: 120 }
          );
        } catch (err: any) {
          const statusCode = err?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            invalidIds.push(sub.id);
            return;
          }
          console.error("push_send_failed", err?.message ?? err);
        }
      })
    );

    if (invalidIds.length > 0) {
      await supabaseAdmin
        .from("push_subscriptions")
        .update({ is_active: false })
        .in("id", invalidIds);
    }

    return new Response(
      JSON.stringify({ ok: true, sent: rows.length - invalidIds.length, invalidated: invalidIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("send-web-push error", error?.message ?? error);
    return new Response(JSON.stringify({ error: error?.message ?? "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
