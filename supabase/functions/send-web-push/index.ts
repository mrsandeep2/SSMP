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
  event_type: "booking_created" | "booking_status_updated" | "booking_payment_requested" | "booking_payment_updated";
  booking: BookingRecord;
  old_booking?: BookingRecord | null;
  from_status?: string | null;
  to_status?: string | null;
  from_payment_status?: string | null;
  to_payment_status?: string | null;
  trigger_actor_id?: string | null;
};

type PushTarget = {
  userId: string;
  title: string;
  body: string;
  tag: string;
  url: string;
};

type StoredSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  subscription?: {
    provider?: string;
    oneSignalId?: string;
    externalId?: string;
    subscription?: {
      id?: string;
      token?: string;
      optedIn?: boolean;
    };
  } | null;
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
const paymentLabel = (payment: string | null | undefined) => (payment || "unpaid").replace(/_/g, " ");

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

  if (payload.event_type === "booking_payment_updated" && oldPayment !== newPayment) {
    const fromPayment = paymentLabel(payload.from_payment_status ?? oldPayment);
    const toPayment = paymentLabel(payload.to_payment_status ?? newPayment);

    if (newPayment === "paid") {
      return {
        userId: booking.seeker_id,
        title: "Payment received successfully",
        body: "Your provider confirmed payment. Booking can now be completed.",
        tag: `seeker-payment-paid-${booking.id}`,
        url: "/dashboard/seeker",
      };
    }

    return {
      userId: booking.seeker_id,
      title: "Payment status updated",
      body: `Payment changed from ${fromPayment} to ${toPayment}.`,
      tag: `seeker-payment-status-${booking.id}-${newPayment}`,
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
      .select("id, endpoint, p256dh, auth, subscription")
      .eq("user_id", target.userId)
      .eq("is_active", true);

    if (fetchError) throw fetchError;

    const rows = (subscriptions ?? []) as StoredSubscription[];
    const webPushRows = rows.filter((s) => String(s.endpoint || "").startsWith("https://"));
    const nativeRows = rows.filter((s) => String(s.endpoint || "").startsWith("onesignal:"));

    if (webPushRows.length === 0 && nativeRows.length === 0) {
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
    let webSent = 0;
    let nativeSent = 0;

    if (webPushRows.length > 0) {
      await Promise.all(
        webPushRows.map(async (sub) => {
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
            webSent += 1;
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
    }

    if (nativeRows.length > 0) {
      const oneSignalAppId = Deno.env.get("ONESIGNAL_APP_ID");
      const oneSignalApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
      const oneSignalAndroidChannelId = Deno.env.get("ONESIGNAL_ANDROID_CHANNEL_ID");

      if (!oneSignalAppId || !oneSignalApiKey) {
        console.warn("onesignal_credentials_missing");
      } else {
        const includeSubscriptionIds = nativeRows
          .map((s) => {
            const byEndpoint = s.endpoint.startsWith("onesignal:") ? s.endpoint.slice("onesignal:".length) : "";
            const byPayload = s.subscription?.subscription?.id || "";
            return (byPayload || byEndpoint).trim();
          })
          .filter(Boolean);

        if (includeSubscriptionIds.length > 0) {
          const oneSignalRes = await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Basic ${oneSignalApiKey}`,
            },
            body: JSON.stringify({
              app_id: oneSignalAppId,
              include_subscription_ids: includeSubscriptionIds,
              headings: { en: target.title },
              contents: { en: target.body },
              priority: 10,
              ttl: 180,
              android_priority: "high",
              android_visibility: 1,
              delayed_option: "timezone",
              ios_interruption_level: "time-sensitive",
              data: {
                url: target.url,
                tag: target.tag,
              },
              android_channel_id: oneSignalAndroidChannelId || null,
            }),
          });

          if (!oneSignalRes.ok) {
            const errorText = await oneSignalRes.text();
            console.error("onesignal_send_failed", errorText);
          } else {
            nativeSent = includeSubscriptionIds.length;
          }
        }
      }
    }

    if (invalidIds.length > 0) {
      await supabaseAdmin
        .from("push_subscriptions")
        .update({ is_active: false })
        .in("id", invalidIds);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        sent: webSent + nativeSent,
        web_sent: webSent,
        native_sent: nativeSent,
        invalidated: invalidIds.length,
      }),
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
