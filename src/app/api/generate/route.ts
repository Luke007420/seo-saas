import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const title = (body?.title ?? "").toString().trim();
    const keywordsInput = body?.keywords ?? [];
    const keywords = Array.isArray(keywordsInput)
      ? keywordsInput
      : String(keywordsInput)
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean);

    if (!title || keywords.length === 0) {
      return new Response(JSON.stringify({ error: "Missing title or keywords" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

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

    const output = completion.choices?.[0]?.message?.content?.trim() || "";
    return new Response(JSON.stringify({ output_markdown: output }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
  let message = "Unknown error";
  if (err instanceof Error) {
    message = err.message;
  } else if (typeof err === "object" && err !== null && "message" in err) {
    message = String((err as { message?: unknown }).message ?? "Unknown error");
  }
  return new Response(JSON.stringify({ error: message }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
    });
  }

}
