/**
 * Hosted-deployment pieces: the Voyage AI client (against a local stand-in
 * for its API) and the password session tokens. No database needed.
 *
 *   npx tsx --test tests/hosted.test.ts
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import { checkPassword, sessionToken, verifySession } from "../src/lib/auth";
import { EmbeddingError, VoyageEmbedder } from "../src/lib/embed";

const seen: { input: string[]; input_type: string; output_dimension: number; model: string }[] = [];
let failNext: number[] = [];
let base = "";

const server = createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    if (req.headers.authorization !== "Bearer k") {
      res.writeHead(401);
      return res.end();
    }
    const status = failNext.shift();
    if (status) {
      res.writeHead(status, { "retry-after": "0.05" });
      return res.end("busy");
    }
    const body = JSON.parse(raw);
    seen.push(body);
    // Return embeddings out of order, as the API may; the client must sort by index.
    const data = body.input.map((t: string, i: number) => ({ index: i, embedding: Array.from({ length: body.output_dimension }, (_, j) => (j === 0 ? t.length : 0)) }));
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ data: data.reverse() }));
  });
});

before(async () => {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
after(() => server.close());

test("voyage: batches documents, keeps order, sends input types and dimension", async () => {
  seen.length = 0;
  const e = new VoyageEmbedder("voyage-3.5", "k", base);
  const texts = Array.from({ length: 300 }, (_, i) => "x".repeat(i + 1));
  const vecs = await e.embedDocuments(texts);
  assert.equal(vecs.length, 300);
  assert.deepEqual(vecs.map((v) => v[0]), texts.map((t) => t.length));
  assert.ok(seen.length >= 3 && seen.every((b) => b.input.length <= 128));
  assert.ok(seen.every((b) => b.input_type === "document" && b.output_dimension === e.dimensions && b.model === "voyage-3.5"));
  await e.embedQuery("what is within our power");
  assert.equal(seen.at(-1)!.input_type, "query");
});

test("voyage: retries rate limits and server errors", async () => {
  failNext = [429, 503];
  const v = await new VoyageEmbedder("voyage-3.5", "k", base).embedQuery("hello");
  assert.equal(v[0], 5);
  assert.deepEqual(failNext, []);
});

test("voyage: clear errors for a missing or rejected key", async () => {
  await assert.rejects(new VoyageEmbedder("voyage-3.5", "", base).embedQuery("x"), EmbeddingError);
  await assert.rejects(new VoyageEmbedder("voyage-3.5", "wrong", base).embedQuery("x"), /key was rejected/);
});

test("password sessions", async () => {
  const token = await sessionToken("opensesame");
  assert.equal(await verifySession(token, "opensesame"), true);
  assert.equal(await verifySession(token, "changed"), false);
  assert.equal(await verifySession(undefined, "opensesame"), false);
  assert.equal(await checkPassword("opensesame", "opensesame"), true);
  assert.equal(await checkPassword("opensesam", "opensesame"), false);
});
