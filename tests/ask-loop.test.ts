/**
 * End-to-end test of the answering loop against a local stand-in for the
 * Anthropic Messages API (streaming SSE). It exercises the real retrieval
 * (database + embeddings), the tool loop, passage registration, and the
 * citation / quotation verification. It needs the database with at least one
 * indexed document containing the Encheiridion text; it is skipped otherwise.
 *
 *   npx tsx --test tests/ask-loop.test.ts
 */
import "../scripts/env";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { after, before, test } from "node:test";

const NEEDLE = "Of things some are in our power";
const requests: { headers: IncomingMessage["headers"]; body: any }[] = [];

function sse(res: ServerResponse, events: object[]) {
  res.writeHead(200, { "content-type": "text/event-stream" });
  for (const e of events) res.write(`event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`);
  res.end();
}

function messageStart() {
  return {
    type: "message_start",
    message: { id: "msg_test", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 100, output_tokens: 1 } },
  };
}

/** Find the passage ID whose text contains `needle` in everything the model was shown. */
function passageIdContaining(body: any, needle: string): string {
  const text = JSON.stringify(body.messages);
  const re = /<passage id=\\"(P\d+)\\"[^>]*>\\n([\s\S]*?)\\n<\/passage>/g;
  for (const m of text.matchAll(re)) if (m[2].includes(needle)) return m[1];
  throw new Error("needle passage not shown to the model");
}

const server = createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = JSON.parse(raw);
    requests.push({ headers: req.headers, body });
    if (requests.length === 1) {
      // Round 1: ask for one more search.
      sse(res, [
        messageStart(),
        { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "toolu_1", name: "search_library", input: {} } },
        { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: '{"query": "judgments about things, not things themselves, disturb us"' } },
        { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: ', "limit": 4}' } },
        { type: "content_block_stop", index: 0 },
        { type: "message_delta", delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 30 } },
        { type: "message_stop" },
      ]);
      return;
    }
    // Round 2: answer, citing a real passage, one real quote, one fabricated quote, one bogus ID.
    const id = passageIdContaining(body, NEEDLE);
    const answer =
      `Epictetus divides everything into what is up to us and what is not [${id}]. ` +
      `He opens the Manual with “Of things some are in our power, and others are not” [${id}].\n\n` +
      `<synthesis>Read together, this makes judgment the one thing fully ours [${id}][P999].</synthesis>\n\n` +
      `He also says “the wise man owns a golden lamp of virtue forever” [${id}].`;
    sse(res, [
      messageStart(),
      { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
      ...answer.match(/.{1,40}/gs)!.map((t) => ({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: t } })),
      { type: "content_block_stop", index: 0 },
      { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 80 } },
      { type: "message_stop" },
    ]);
  });
});

let hasCorpus = false;

before(async () => {
  const { db } = await import("../src/lib/db");
  const { rows } = await db().query(`select count(*)::int as n from chunks where text like $1`, [`%${NEEDLE}%`]);
  hasCorpus = rows[0].n > 0;
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as { port: number };
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${port}`;
  process.env.ANTHROPIC_API_KEY = "test-key";
  delete process.env.ANTHROPIC_AUTH_TOKEN;
});

after(async () => {
  server.close();
  const { db } = await import("../src/lib/db");
  await db().end();
});

test("ask: retrieval → tool loop → grounded answer with verified citations", async (t) => {
  if (!hasCorpus) return t.skip("no indexed document containing the Encheiridion");
  const { ask } = await import("../src/lib/rag/ask");
  const events: any[] = [];
  for await (const e of ask({ question: "What does Epictetus mean by things being within our control?" })) events.push(e);

  const error = events.find((e) => e.type === "error");
  assert.equal(error, undefined, error?.message);

  // Two model calls: initial + after the tool result.
  assert.equal(requests.length, 2);
  const first = requests[0];
  assert.equal(first.body.model, "claude-opus-5-5");
  assert.equal(first.body.fallbacks, "default");
  assert.match(String(first.headers["anthropic-beta"]), /server-side-fallback-2026-07-01/);
  assert.deepEqual(first.body.tools.map((x: any) => x.name), ["search_library", "read_pages"]);
  assert.equal(first.body.stream, true);
  assert.match(first.body.messages.at(-1).content, /<question>What does Epictetus mean/);

  // The tool result carried new passages back to the model.
  const second = requests[1].body.messages;
  assert.equal(second.at(-2).role, "assistant");
  assert.equal(second.at(-2).content[0].type, "tool_use");
  const toolResult = second.at(-1).content[0];
  assert.equal(toolResult.type, "tool_result");
  assert.equal(toolResult.tool_use_id, "toolu_1");
  assert.match(toolResult.content, /<passage id="P\d+"/);

  // Research trail: the initial retrieval plus the model's own search.
  const searches = events.filter((e) => e.type === "search");
  assert.equal(searches.length, 2);
  assert.equal(searches[1].query, "judgments about things, not things themselves, disturb us");

  // Streaming text arrived, then the verified result.
  assert.ok(events.filter((e) => e.type === "text").length > 3);
  const done = events.find((e) => e.type === "done");
  assert.ok(done, "done event");
  const cited: string[] = done.citations.cited;
  assert.equal(cited.length, 1);
  assert.deepEqual(done.citations.unknown, ["P999"]);

  // Every cited ID resolves to a real retrieved passage with a page.
  const passages = events.filter((e) => e.type === "passages").at(-1).passages;
  const p = passages.find((x: any) => x.id === cited[0]);
  assert.ok(p.text.includes(NEEDLE));
  assert.ok(p.pageStart >= 1 && p.pageEnd >= p.pageStart);

  // The genuine quotation verifies; the fabricated one is flagged.
  assert.equal(done.quotes.length, 2);
  assert.equal(done.quotes[0].verified, true);
  assert.equal(done.quotes[1].verified, false);
});
