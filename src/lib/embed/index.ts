import { config } from "../config";

/**
 * Text embeddings, computed locally with an ONNX model via transformers.js.
 * Nothing leaves the machine, and there is no per-token cost to re-index.
 *
 * The Embedder interface is the seam for swapping in a hosted embedding
 * provider later; the vector column dimension must match `dimensions`.
 */
export interface Embedder {
  readonly model: string;
  readonly dimensions: number;
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}

type FeatureExtractor = (
  texts: string[],
  opts: { pooling: "cls" | "mean"; normalize: boolean },
) => Promise<{ tolist(): number[][] }>;

class LocalEmbedder implements Embedder {
  readonly dimensions = config.embeddingDimensions;
  private extractor: Promise<FeatureExtractor> | null = null;

  constructor(readonly model: string) {}

  private load(): Promise<FeatureExtractor> {
    if (!this.extractor) {
      this.extractor = (async () => {
        const { pipeline, env } = await import("@huggingface/transformers");
        env.localModelPath = config.modelsDir + "/";
        env.allowLocalModels = true;
        // Models are fetched explicitly by `npm run models:fetch`; never download at request time.
        env.allowRemoteModels = false;
        const pipe = await pipeline("feature-extraction", this.model, { dtype: "fp32", device: "cpu" });
        return pipe as unknown as FeatureExtractor;
      })().catch((err) => {
        this.extractor = null;
        throw new Error(
          `Could not load embedding model "${this.model}" from ${config.modelsDir}. ` +
            `Run \`npm run models:fetch\` first. (${err instanceof Error ? err.message : err})`,
        );
      });
    }
    return this.extractor;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const extract = await this.load();
    const out: number[][] = [];
    // Small batches keep padding waste and peak memory low on CPU.
    const batch = 8;
    for (let i = 0; i < texts.length; i += batch) {
      const t = await extract(texts.slice(i, i + batch), { pooling: "cls", normalize: true });
      out.push(...t.tolist());
    }
    return out;
  }

  async embedQuery(text: string): Promise<number[]> {
    const extract = await this.load();
    const t = await extract([config.embeddingQueryPrefix + text], { pooling: "cls", normalize: true });
    return t.tolist()[0];
  }
}

const globalForEmbedder = globalThis as unknown as { __jarvisEmbedder?: Embedder };

/** Process-wide singleton (survives Next.js dev hot reloads). */
export function getEmbedder(): Embedder {
  if (!globalForEmbedder.__jarvisEmbedder) {
    globalForEmbedder.__jarvisEmbedder = new LocalEmbedder(config.embeddingModel);
  }
  return globalForEmbedder.__jarvisEmbedder;
}
