// Server functions for the Article Analyser.
// Only createServerFn declarations + erased types live here.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  ArticleImpactSchema,
  EXPOSURE_SYSTEM_PROMPT,
  type ArticleImpact,
} from "./exposure-schema";

export { ArticleImpactSchema };
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

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const { generateText, Output } = await import("ai");

    const gateway = createLovableAiGatewayProvider(key);

    const { output } = await generateText({
      model: gateway("google/gemini-3.6-flash"),
      output: Output.object({ schema: ArticleImpactSchema }),
      system: EXPOSURE_SYSTEM_PROMPT,
      prompt: `Analyse this article:\n\n${data.text}`,
    });

    return output;
  });
