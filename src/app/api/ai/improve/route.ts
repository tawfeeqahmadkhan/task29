import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { z } from "zod";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

const schema = z.object({
  text: z.string().min(1).max(5000),
  mode: z.enum(["grammar", "rephrase", "expand", "shorten"]),
});

const prompts: Record<string, (text: string) => string> = {
  grammar: (t) => `Fix grammar and spelling errors in the following text. Return only the corrected text with no explanation:\n\n${t}`,
  rephrase: (t) => `Rephrase the following text to improve clarity and flow. Return only the rephrased text:\n\n${t}`,
  expand: (t) => `Expand the following text with more detail and context. Return only the expanded text:\n\n${t}`,
  shorten: (t) => `Shorten the following text while preserving the key message. Return only the shortened text:\n\n${t}`,
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > 20_000) return NextResponse.json({ error: "Content too large" }, { status: 413 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { text, mode } = parsed.data;

  try {
    const { text: result } = await generateText({
      model: groq("llama-3.1-8b-instant"),
      prompt: prompts[mode](text),
      maxOutputTokens: 1000,
    });

    return NextResponse.json({ result, mode });
  } catch {
    return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
  }
}
