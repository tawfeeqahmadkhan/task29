import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDocumentAccess } from "@/lib/document-access";
import { generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { z } from "zod";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

const schema = z.object({
  documentId: z.string(),
  content: z.string().max(50000),
  mode: z.enum(["summary", "keypoints", "tldr"]).default("summary"),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > 100_000) return NextResponse.json({ error: "Content too large" }, { status: 413 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { documentId, content, mode } = parsed.data;
  const access = await getDocumentAccess(documentId, session.user.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const prompts: Record<string, string> = {
    summary: `Summarize the following document in 2-3 clear paragraphs:\n\n${content}`,
    keypoints: `Extract the 5 most important key points from this document as a bulleted list:\n\n${content}`,
    tldr: `Write a one-sentence TL;DR for this document:\n\n${content}`,
  };

  try {
    const { text } = await generateText({
      model: groq("llama-3.1-8b-instant"),
      prompt: prompts[mode],
      maxTokens: 500,
    });

    return NextResponse.json({ result: text, mode });
  } catch {
    return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
  }
}
