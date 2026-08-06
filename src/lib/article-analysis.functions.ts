// Server functions for the Article Analyser.
// Only createServerFn declarations + erased types live here.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ArticleImpact } from "./exposure-schema";

export type { ArticleImpact };

export const analyzeArticle = createServerFn({ method: "POST" })
  .inputValidator((input: { text: string }) =>
    z
      .object({ text: z.string().trim().min(80).max(20000) })
      .parse(input),
  )
  .handler(async ({ data }): Promise<ArticleImpact> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured for this project.");
    const { extractExposure } = await import("./exposure-extract.server");
    return extractExposure(data.text, key);
  });
