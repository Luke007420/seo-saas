import OpenAI from "openai";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

const DAILY_FREE_LIMIT = 5;

type GenerateBody = {
  title?: string;
  keywords?: string[] | string;
};

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GenerateBody;
    const title = (body?.title ?? "").toString().trim();
    const keywordsInput = body?.keywords ?? [];
    const keywords = Array.isArray(keywordsInput)
      ? keywordsInput
      : String(keywordsInput).split(",").map((k) => k.trim()).filter(Boolean);

    if (!title || keywords.length === 0) {
      return json({ error: "Missing title or keywords" }, 400);
    }

    // auth (read Supabase session from cookies)
    const supabase = createRouteHandlerClient({ cookies });
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) return json({ error: "Not signed in" }, 401);
    const userId = session.user.id;

    // plan check
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_pro")
      .eq("user_id", userId)
      .maybeSingle();
    const isPro = !!profile?.is_pro;

    // usage check (today)
    if (!isPro) {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date();   end.setHours(23, 59, 59, 999);

      const { count } = await supabase
        .from("generations")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());

      if ((count ?? 0) >= DAILY_FREE_LIMIT) {
        return json({ error: `Daily limit reached (${DAILY_FREE_LIMIT}/day on Free).` }, 403);
      }
    }

    // OpenAI call
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return json({ error: "Missing OPENAI_API_KEY" }, 500);
    const openai = new OpenAI({ apiKey });

    const prompt = [
      `You are an e-commerce SEO copywriter.`,
      `Create product copy in Markdown using this structure:`,
      `# Improved Product Title`,
      `- 5 bullet points (benefits/features)`,
      ``,
      `## SEO Description`,
      `A concise 1–2 paragraph description.`,
      ``,
      `**Meta title:** (<= 60 chars)`,
      `**Meta description:** (120–160 chars)`,
      ``,
      `Product: ${title}`,
      `Keywords: ${keywords.join(", ")}`,
    ].join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You write clear, conversion-focused product copy." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    });

    const output_markdown = completion.choices?.[0]?.message?.content?.trim() || "";

    // save to DB as the user
    const { error: dbErr } = await supabase.from("generations").insert([
      {
        user_id: userId,
        product_title: title,
        keywords,
        output_markdown,
      },
    ]);
    if (dbErr) return json({ error: dbErr.message }, 500);

    return json({ output_markdown }, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, 500);
  }
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
