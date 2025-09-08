"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
      else setChecking(false);
    });
  }, [router]);

  if (checking) return <div className="p-8">Loading…</div>;

  return (
    <main className="min-h-screen p-8 flex items-center justify-center">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-semibold">SEO Product Description Generator</h1>
        <p className="mt-3 text-gray-600">
          Turn a product title + keywords into polished, SEO-ready copy.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link href="/login" className="rounded-md bg-black text-white px-4 py-2 text-sm">
            Start free
          </Link>
          <Link href="/pricing" className="rounded-md border px-4 py-2 text-sm">
            Pricing
          </Link>
        </div>
      </div>
    </main>
  );
}
