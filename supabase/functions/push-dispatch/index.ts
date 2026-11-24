import { createClient } from "npm:@supabase/supabase-js@2.80.0";
import webpush from "npm:web-push@3.6.7";

export const validEndpoint = (value: string) =>
  /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)\/[A-Za-z0-9_/?=&%:.~-]+$/.test(
    value,
  );

export async function sameSecret(a: string, b: string) {
  const digest = async (value: string) =>
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(value),
      ),
    );

  const [first, second] = await Promise.all([
    digest(a),
    digest(b),
  ]);

  let difference = 0;

  for (let index = 0; index < first.length; index++) {
    difference |= first[index] ^ second[index];
  }

  return difference === 0;
}

Deno.serve(async (request: Request) => {
  const response = (status: number, body: object) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });

  if (request.method !== "POST") {
    return response(405, { error: "method" });
  }

  const configuredSecret =
    Deno.env.get("NEO_PUSH_CRON_SECRET") || "";

  if (configuredSecret.length < 32) {
    return response(503, {
      error: "configuration_pending",
    });
  }

  const receivedSecret =
    request.headers.get("x-neo-cron-secret") || "";

  if (
    receivedSecret.length > 256 ||
    !(await sameSecret(receivedSecret, configuredSecret))
  ) {
    return response(401, {
      error: "unauthorized",
    });
  }

  const publicKey =
    Deno.env.get("NEO_VAPID_PUBLIC_KEY");

  const privateKey =
    Deno.env.get("NEO_VAPID_PRIVATE_KEY");

  const subject =
    Deno.env.get("NEO_VAPID_SUBJECT");

  if (!publicKey || !privateKey || !subject) {
    return response(503, {
      error: "configuration_pending",
    });
  }

  try {
    webpush.setVapidDetails(
      subject,
      publicKey,
      privateKey,
    );

    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    // Lembretes pessoais.
    const reminders = await client.rpc(
      "neo_push_claim",
    );

    if (reminders.error) {
      throw new Error("claim");
    }

    // Publicações da comunidade.
    const community = await client.rpc(
      "neo_community_push_claim",
    );

    // Conversas privadas.
    const support = await client.rpc(
      "neo_support_push_claim",
    );

    // Biblioteca e atualizações de pedidos.
    const events = await client.rpc(
      "neo_event_push_claim",
    );

    // Fila adicional de campanhas, isolada: erro aqui não interrompe notificações oficiais.
    const campaigns = await client.rpc("neo_campaign_push_claim");

    /*
     * Uma fila opcional indisponível não impede as outras.
     * A fila principal de lembretes continua obrigatória.
     */
    const jobs = [
      ...(reminders.data || []),

      ...(community.error
        ? []
        : community.data || []),

      ...(support.error
        ? []
        : support.data || []),

      ...(events.error
        ? []
        : events.data || []),

      ...(campaigns.error
        ? []
        : campaigns.data || []),
    ];

    let sent = 0;
    let failed = 0;

    await Promise.all(
      jobs.map(
        async (job: {
          id: string;
          endpoint: string;
          kind?: string;
          title?: string;
          body?: string;
          keys: {
            p256dh: string;
            auth: string;
          };
        }) => {
          let outcome = "retry";

          try {
            if (!validEndpoint(job.endpoint)) {
              throw new Error("endpoint");
            }

            // Notifications must never disclose private message content or names.
            const payload: { tag: string; kind?: string } = { tag: job.id };
            if ([
              "community",
              "support",
              "library",
              "shop",
              "campaign",
            ].includes(job.kind || "")) {
              payload.kind = job.kind;
            }

            await webpush.sendNotification(
              {
                endpoint: job.endpoint,
                keys: job.keys,
              },
              JSON.stringify(payload),
              {
                TTL: 300,

                urgency:
                  job.kind === "support" ||
                  job.kind === "shop"
                    ? "high"
                    : "normal",

                topic: job.id.replaceAll("-", ""),
                timeout: 10000,
              },
            );

            outcome = "sent";
            sent++;
          } catch (error) {
            const statusCode = (
              error as {
                statusCode?: number;
              }
            ).statusCode;

            if (
              statusCode === 404 ||
              statusCode === 410
            ) {
              outcome = "gone";
            }

            failed++;
          }

          const finishFunction =
            job.kind === "campaign"
              ? "neo_campaign_push_finish"
              : job.kind === "support"
                ? "neo_support_push_finish"
              : job.kind === "community"
                ? "neo_community_push_finish"
                : [
                      "library",
                      "shop",
                    ].includes(job.kind || "")
                  ? "neo_event_push_finish"
                  : "neo_push_finish";

          const finished = await client.rpc(
            finishFunction,
            {
              p_id: job.id,
              p_outcome: outcome,
            },
          );

          if (finished.error) {
            throw new Error("finish");
          }
        },
      ),
    );

    return response(200, {
      sent,
      failed,

      ...(community.error
        ? { community_available: false }
        : {}),

      ...(support.error
        ? { support_available: false }
        : {}),

      ...(events.error
        ? { events_available: false }
        : {}),

      ...(campaigns.error
        ? { campaign_available: false }
        : {}),
    });
  } catch {
    return response(500, {
      error: "dispatch_failed",
    });
  }
});