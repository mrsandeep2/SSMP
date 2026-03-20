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

type ProfilePushIdentity = {
  onesignal_player_id?: string | null;
};

const uniqueNonEmpty = (values: Array<string | null | undefined>) => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const v = String(value || "").trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
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

  if (payload.event_type === "booking_status_updated") {
    const fromRawStatus = payload.from_status ?? payload.old_booking?.status;
    const toRawStatus = payload.to_status ?? booking.status;
    const fromStatusNormalized = sanitizeStatus(fromRawStatus);
    const toStatusNormalized = sanitizeStatus(toRawStatus);

    if (fromStatusNormalized === toStatusNormalized) {
      return null;
    }

    const fromStatus = statusLabel(fromRawStatus);
    const toStatus = statusLabel(toRawStatus);
    const title =
      status === "accepted"
        ? "Your service request is accepted by provider"
        : `Booking status updated: ${toStatus}`;

    return {
      userId: booking.seeker_id,
      title,
      body:
        status === "accepted"
          ? "Provider accepted your service request. Open dashboard for details."
          : `Provider changed booking status from ${fromStatus} to ${toStatus}. Open dashboard for details.`,
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
    const event = payload.event_type;
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

    const { data: profileIdentity } = await supabaseAdmin
      .from("profiles")
      .select("onesignal_player_id")
      .eq("id", target.userId)
      .maybeSingle();

    const profilePlayerId = String((profileIdentity as ProfilePushIdentity | null)?.onesignal_player_id || "").trim();

    console.log("EVENT:", event);
    console.log("TARGET USER:", target.userId);
    console.log("PLAYER ID:", profilePlayerId || "(none)");

    if (webPushRows.length === 0 && nativeRows.length === 0 && !profilePlayerId) {
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
              { TTL: 86400 }
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
        const includeSubscriptionIds = uniqueNonEmpty(
          nativeRows.map((s) => {
            const byEndpoint = s.endpoint.startsWith("onesignal:") ? s.endpoint.slice("onesignal:".length) : "";
            const byPayload = s.subscription?.subscription?.id || "";
            return byPayload || byEndpoint;
          })
        );

        const includePlayerIds = uniqueNonEmpty([
          profilePlayerId,
          ...nativeRows.map((s) => {
            const byPayload = s.subscription?.subscription?.id || "";
            const byEndpoint = s.endpoint.startsWith("onesignal:") ? s.endpoint.slice("onesignal:".length) : "";
            return byPayload || byEndpoint;
          }),
        ]);

        const includePlayerIdsLegacy = uniqueNonEmpty(
          nativeRows.map((s) => {
            const byPayload = s.subscription?.subscription?.id || "";
            const byEndpoint = s.endpoint.startsWith("onesignal:") ? s.endpoint.slice("onesignal:".length) : "";
            return byPayload || byEndpoint;
          })
        );

        const externalIds = uniqueNonEmpty([
          target.userId,
          ...nativeRows.map((s) => s.subscription?.externalId),
        ]);

        if (includePlayerIds.length === 0 && includeSubscriptionIds.length === 0 && externalIds.length === 0) {
          throw new Error("No player_id for target user");
        }

        if (includeSubscriptionIds.length > 0 || includePlayerIds.length > 0 || externalIds.length > 0) {
          const oneSignalRes = await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Basic ${oneSignalApiKey}`,
            },
            body: JSON.stringify({
              app_id: oneSignalAppId,
              include_subscription_ids: includeSubscriptionIds,
              include_player_ids: includePlayerIds,
              include_external_user_ids: externalIds,
              include_aliases: externalIds.length > 0 ? { external_id: externalIds } : undefined,
              target_channel: "push",
              headings: { en: target.title },
              contents: { en: target.body },
              priority: 10,
              ttl: 86400,
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

          let oneSignalBody: any = null;
          try {
            oneSignalBody = await oneSignalRes.json();
          } catch {
            oneSignalBody = { parse_error: "non_json_response" };
          }

          console.log("ONESIGNAL RESPONSE:", oneSignalBody);

          if (!oneSignalRes.ok) {
            console.error("onesignal_send_failed", oneSignalBody);
          } else {
            nativeSent = Math.max(
              includeSubscriptionIds.length,
              includePlayerIds.length,
              includePlayerIdsLegacy.length,
              externalIds.length
            );
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
