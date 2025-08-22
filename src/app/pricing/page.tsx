"use client";

import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useState } from "react";

export default function PricingPage() {
  const [loading, setLoading] = useState(false);

  async function startCheckout() {
    setLoading(true);
    try {
      // must be signed in
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        window.location.href = "/login";
        return;
      }

      // call our server route to create a Stripe Checkout session
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, email: user.email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to start checkout");

      // go to Stripe
      window.location.href = json.url;
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold">Pricing</h1>
          <Link href="/dashboard" className="text-sm underline">
            Back to Dashboard
          </Link>
        </header>

        <p className="mt-3 text-gray-600">Start free. Upgrade when you need more.</p>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Free */}
          <div className="rounded-2xl border p-6">
            <h2 className="text-xl font-semibold">Free</h2>
            <div className="mt-2 text-3xl font-bold">
              $0<span className="text-base font-normal">/mo</span>
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              <li>• 5 generations per day</li>
              <li>• Save history</li>
              <li>• Email magic-link login</li>
            </ul>
            <div className="mt-6">
              <span className="inline-block rounded-md border px-3 py-2 text-sm">
                You’re on Free
              </span>
            </div>
          </div>

          {/* Pro */}
          <div className="rounded-2xl border p-6">
            <h2 className="text-xl font-semibold">Pro</h2>
            <div className="mt-2 text-3xl font-bold">
              $49<span className="text-base font-normal">/mo</span>
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              <li>• Unlimited generations</li>
              <li>• Priority quality</li>
              <li>• Upcoming: bulk CSV, brand voice</li>
            </ul>
            <div className="mt-6">
              <button
                className="rounded-md bg-black text-white px-3 py-2 text-sm disabled:opacity-60"
                onClick={startCheckout}
                disabled={loading}
              >
                {loading ? "Redirecting…" : "Upgrade to Pro"}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              (For manual testing, you can still toggle <code>is_pro</code> in Supabase → profiles.)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
