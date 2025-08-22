// src/app/api/stripe/create-checkout/route.ts
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs"; // ensure Node runtime (Stripe SDK requires it)

type Body = { userId?: string; email?: string };

export async function POST(req: Request) {
  try {
    const { userId, email } = (await req.json()) as Body;

    if (!userId || !email) {
      return new Response(JSON.stringify({ error: "Missing userId or email" }), { status: 400 });
    }

    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    const priceId = process.env.STRIPE_PRICE_PRO_MONTHLY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!stripeSecret || !priceId || !supabaseUrl || !serviceRole) {
      return new Response(
        JSON.stringify({ error: "Missing required server env vars" }),
        { status: 500 }
      );
    }

    const stripe = new Stripe(stripeSecret);
    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Ensure a Stripe customer exists and is saved on the user's profile
    const { data: profile } = await admin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    let customerId = profile?.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { user_id: userId },
      });
      customerId = customer.id;

      await admin.from("profiles").upsert({
        user_id: userId,
        stripe_customer_id: customerId,
        // is_pro will flip to true on webhook confirmation
      });
    }

    const origin = req.headers.get("origin") ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: userId, // read in webhook to flip is_pro
      allow_promotion_codes: true,
      success_url: `${origin}/dashboard?upgrade=success`,
      cancel_url: `${origin}/pricing?canceled=1`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
