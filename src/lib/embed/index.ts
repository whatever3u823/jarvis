import { config } from "../config";

/**
 * Text embeddings. Two providers:
 *  - local: an ONNX model run in-process via transformers.js (nothing leaves
 *    the machine, no per-token cost; too large for serverless functions);
 *  - voyage: the Voyage AI embeddings API (used on Vercel).
 * The vector column dimension must match `dimensions`.
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

export class EmbeddingError extends Error {}

/** Voyage AI embeddings (https://docs.voyageai.com/reference/embeddings-api). */
export class VoyageEmbedder implements Embedder {
  readonly dimensions = config.embeddingDimensions;

  constructor(
    readonly model: string,
    private apiKey = process.env.VOYAGE_API_KEY ?? "",
    private baseUrl = config.voyageApiUrl,
  ) {}

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    // Batch by count and by a rough token estimate (~4 characters per token),
    // well inside the API's per-request limits.
    let batch: string[] = [];
    let tokens = 0;
    const flush = async () => {
      if (batch.length) out.push(...(await this.request(batch, "document")));
      batch = [];
      tokens = 0;
    };
    for (const t of texts) {
      const est = Math.ceil(t.length / 4);
      if (batch.length >= 128 || tokens + est > 60_000) await flush();
      batch.push(t);
      tokens += est;
    }
    await flush();
    return out;
  }

  async embedQuery(text: string): Promise<number[]> {
    return (await this.request([text], "query"))[0];
  }

  private async request(input: string[], inputType: "query" | "document"): Promise<number[][]> {
    if (!this.apiKey) throw new EmbeddingError("VOYAGE_API_KEY is not set.");
    const deadline = Date.now() + 150_000;
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await fetch(`${this.baseUrl}/embeddings`, {
          method: "POST",
          headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({
            input,
            model: this.model,
            input_type: inputType,
            output_dimension: this.dimensions,
            truncation: true,
          }),
        });
      } catch (err) {
        if (attempt < 4 && Date.now() < deadline) {
          await sleep(1000 * 2 ** attempt);
          continue;
        }
        throw new EmbeddingError(`Could not reach the Voyage API: ${err instanceof Error ? err.message : err}`);
      }
      if (res.ok) {
        const json = (await res.json()) as { data: { embedding: number[]; index: number }[] };
        const vectors = [...json.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
        if (vectors.length !== input.length || vectors.some((v) => v.length !== this.dimensions))
          throw new EmbeddingError(`Voyage returned ${vectors.length} embeddings of unexpected size for ${input.length} inputs.`);
        return vectors;
      }
      const body = await res.text().catch(() => "");
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && Date.now() < deadline) {
        const after = Number(res.headers.get("retry-after"));
        const wait = Number.isFinite(after) && after > 0 ? after * 1000 : Math.min(20_000, 1000 * 2 ** attempt);
        await sleep(Math.min(wait, Math.max(0, deadline - Date.now())));
        continue;
      }
      if (res.status === 401 || res.status === 403) throw new EmbeddingError("The Voyage API key was rejected. Check VOYAGE_API_KEY.");
      if (res.status === 429)
        throw new EmbeddingError(
          "Voyage AI kept rate-limiting the requests (HTTP 429). Accounts without a payment method have very low rate limits; " +
            "adding one in the Voyage dashboard raises them (the free token allowance still applies).",
        );
      throw new EmbeddingError(`Voyage API error ${res.status}: ${body.slice(0, 300)}`);
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const globalForEmbedder = globalThis as unknown as { __jarvisEmbedder?: Embedder };

/** Process-wide singleton (survives Next.js dev hot reloads). */
export function getEmbedder(): Embedder {
  if (!globalForEmbedder.__jarvisEmbedder) {
    globalForEmbedder.__jarvisEmbedder =
      config.embeddingProvider === "voyage" ? new VoyageEmbedder(config.embeddingModel) : new LocalEmbedder(config.embeddingModel);
  }
  return globalForEmbedder.__jarvisEmbedder;
}
