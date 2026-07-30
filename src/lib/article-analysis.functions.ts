// Server functions for the Article Analyser.
// Only createServerFn declarations + erased types live here.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const ArticleImpactSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  category: z.string(),
  regions: z.array(z.string()),
  transmissionChannel: z.string(),
  strength: z.enum(["Low", "Medium", "High"]),
  positive: z.array(
    z.object({
      ticker: z.string(),
      company: z.string(),
      sector: z.string(),
      mechanism: z.string(),
      confidence: z.enum(["Low", "Medium", "High"]),
    }),
  ),
  negative: z.array(
    z.object({
      ticker: z.string(),
      company: z.string(),
      sector: z.string(),
      mechanism: z.string(),
      confidence: z.enum(["Low", "Medium", "High"]),
    }),
  ),
  caveats: z.string(),
});

export type ArticleImpact = z.infer<typeof ArticleImpactSchema>;

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
      system: [
        "You are an equity-exposure research assistant for an educational tool.",
        "Given a news article, identify the mechanical transmission channel to listed equities.",
        "List publicly listed companies with real exchange tickers that are most positively and most negatively exposed.",
        "Explain the mechanism concretely (input costs, demand, substitution, regulation, supply chain).",
        "Never give investment advice; never use the words buy, sell, or recommendation.",
        "Describe exposure and historical behaviour only. 3-6 names per side when supportable, fewer if not.",
      ].join(" "),
      prompt: `Analyse this article:\n\n${data.text}`,
    });

    return output;
  });
