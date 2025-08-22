// src/app/api/stripe/webhook/route.ts
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const stripeSecret = process.env.STRIPE_SECRET_KEY!;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const stripe = new Stripe(stripeSecret); // use your account's default API version
  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // Read raw body & signature for verification
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    if (!sig) {
      return new Response("Missing signature", { status: 400 });
    }

    const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId =
          (session.client_reference_id as string | null) ||
          (session.metadata?.user_id as string | undefined);
        const customerId = (session.customer as string) || undefined;

        if (userId) {
          await admin.from("profiles").upsert({
            user_id: userId,
            is_pro: true,
            stripe_customer_id: customerId,
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const { data: profile } = await admin
          .from("profiles")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (profile?.user_id) {
          await admin.from("profiles").update({ is_pro: false }).eq("user_id", profile.user_id);
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const status = sub.status; // "active" | "trialing" | "canceled" | ...

        const { data: profile } = await admin
          .from("profiles")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (profile?.user_id) {
          const shouldBePro = status === "active" || status === "trialing";
          await admin.from("profiles").update({ is_pro: shouldBePro }).eq("user_id", profile.user_id);
        }
        break;
      }
    }

    return new Response("ok", { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(`Webhook error: ${message}`, { status: 400 });
  }
}
