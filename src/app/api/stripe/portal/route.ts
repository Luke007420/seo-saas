import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { userId?: string };

export async function POST(req: Request) {
  try {
    const { userId } = (await req.json()) as Body;
    if (!userId) return new Response(JSON.stringify({ error: "Missing userId" }), { status: 400 });

    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!stripeSecret || !supabaseUrl || !serviceRole) {
      return new Response(JSON.stringify({ error: "Missing server env vars" }), { status: 500 });
    }

    const stripe = new Stripe(stripeSecret);
    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile, error } = await admin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !profile?.stripe_customer_id) {
      return new Response(JSON.stringify({ error: "No Stripe customer for this user" }), { status: 400 });
    }

    const origin = req.headers.get("origin") ?? "http://localhost:3000";

    const portal = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/dashboard`,
    });

    return new Response(JSON.stringify({ url: portal.url }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
