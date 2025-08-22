"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";

type Generation = {
  id: string;
  product_title: string;
  keywords: string[];
  output_markdown: string;
  created_at: string;
};

const DAILY_FREE_LIMIT = 5;

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // plan & usage
  const [isPro, setIsPro] = useState(false);
  const [todayCount, setTodayCount] = useState(0);

  // form state
  const [title, setTitle] = useState("");
  const [keywordsInput, setKeywordsInput] = useState("");
  const keywords = useMemo(
    () =>
      keywordsInput
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
    [keywordsInput]
  );

  // generation state
  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState<Generation[]>([]);
  const [error, setError] = useState<string | null>(null);

  // helpers
  const startOfTodayISO = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);
  const endOfTodayISO = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }, []);

  const loadHistory = useCallback(async () => {
    const { data, error } = await supabase
      .from("generations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    if (!error && data) setHistory(data as Generation[]);
  }, []);

  const loadPlanAndUsage = useCallback(async (uid: string) => {
    // Get plan (profiles.is_pro) — missing profile counts as false (Free)
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("is_pro")
      .eq("user_id", uid)
      .maybeSingle();
    if (!profErr && profile?.is_pro) setIsPro(true);
    else setIsPro(false);

    // Get today's usage count
    const { count } = await supabase
      .from("generations")
      .select("*", { count: "exact", head: true })
      .eq("user_id", uid)
      .gte("created_at", startOfTodayISO)
      .lte("created_at", endOfTodayISO);

    setTodayCount(count ?? 0);
  }, [endOfTodayISO, startOfTodayISO]);

  // auth + initial data
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (!session) {
        router.replace("/login");
      } else {
        const uid = session.user.id;
        setUserId(uid);
        setEmail(session.user.email ?? null);
        await Promise.all([loadHistory(), loadPlanAndUsage(uid)]);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });
    return () => listener.subscription.unsubscribe();
  }, [loadHistory, loadPlanAndUsage, router]);

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title || keywords.length === 0) {
      setError("Please enter a product title and at least one keyword.");
      return;
    }
    if (!userId) {
      setError("Not signed in.");
      return;
    }

    // Soft paywall: block if Free and at limit
    if (!isPro && todayCount >= DAILY_FREE_LIMIT) {
      setError(
        `Daily limit reached (${DAILY_FREE_LIMIT}/day on Free). Visit the Pricing page to upgrade.`
      );
      return;
    }

    setGenerating(true);
    try {
      // 1) Ask our API to generate the Markdown
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, keywords }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to generate");

      const output_markdown: string = json.output_markdown || "";

      // 2) Save to Supabase as the logged-in user (RLS will allow this)
      const { error: dbErr } = await supabase.from("generations").insert([
        {
          user_id: userId,
          product_title: title,
          keywords,
          output_markdown,
        },
      ]);
      if (dbErr) throw dbErr;

      // 3) Refresh history & usage
      await Promise.all([loadHistory(), loadPlanAndUsage(userId)]);

    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
          ? err
          : "Something went wrong";
      setError(message);
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <div className="p-8">Loading…</div>;

  const usageText = isPro
    ? "Unlimited on Pro"
    : `${todayCount}/${DAILY_FREE_LIMIT} used today`;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex items-center gap-4">
          <Link href="/pricing" className="text-sm underline">
            Pricing
          </Link>
          <button
            className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
            onClick={async () => {
              await supabase.auth.signOut();
              router.replace("/login");
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      
      <div className="mt-1 text-sm text-gray-500">Signed in as {email}</div>
  



      <div className="mt-1 text-sm text-gray-500">
        Plan: {isPro ? "Pro" : "Free"} • Usage: {usageText}
      </div>
      <p className="text-xs text-gray-500">
        (To test Pro, set <code>is_pro = true</code> for your user in Supabase → profiles.)
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        {/* Left: form */}
        <div className="rounded-xl border p-6">
          <h2 className="font-medium mb-4">Generate SEO Product Copy</h2>
          <form onSubmit={onGenerate} className="space-y-3">
            <div>
              <label className="text-sm">Product title</label>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2"
                placeholder="e.g., Wireless Noise-Cancelling Headphones"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm">Keywords (comma-separated)</label>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2"
                placeholder="bluetooth 5.3, long battery life, comfort"
                value={keywordsInput}
                onChange={(e) => setKeywordsInput(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">Parsed: {keywords.join(", ") || "—"}</p>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={generating}
              className="rounded-md bg-black text-white px-3 py-2 text-sm disabled:opacity-60"
            >
              {generating ? "Generating…" : "Generate"}
            </button>
          </form>
        </div>

        {/* Right: history */}
        <div className="rounded-xl border p-6">
          <h2 className="font-medium mb-4">Recent Generations</h2>
          {history.length === 0 ? (
            <p className="text-sm text-gray-500">No generations yet.</p>
          ) : (
            <ul className="space-y-4">
              {history.map((g) => (
                <li key={g.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{g.product_title}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(g.created_at).toLocaleString()} — {g.keywords.join(", ")}
                      </div>
                    </div>
                    <button
                      className="text-xs underline"
                      onClick={() => {
                        navigator.clipboard.writeText(g.output_markdown);
                      }}
                    >
                      Copy Markdown
                    </button>
                  </div>
                  <div className="mt-3">
                    <ReactMarkdown>{g.output_markdown}</ReactMarkdown>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
