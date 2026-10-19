import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import { createQuoteByCodeHandler } from "../lib/server/admin-quote-by-code";
import type { RepositoryResult } from "../lib/repositories/shared";
import type { Quote } from "../lib/types";

const quote = { id: "q-1", code: "IS-2026-4201", customerFirstName: "Mario" } as unknown as Quote;

const allow = async () => null;
const deny = async () => NextResponse.json({ ok: false, error: "Operazione non autorizzata" }, { status: 401 });

function request(query = "") {
  return new NextRequest(`http://localhost/api/admin/quote-by-code${query}`);
}

function repository(result: RepositoryResult<Quote | null>, calls: string[] = []) {
  return async (code: string) => {
    calls.push(code);
    return result;
  };
}

async function run() {
  // Senza autenticazione -> 401, repository mai interrogato
  {
    const calls: string[] = [];
    const GET = createQuoteByCodeHandler({ authorize: deny, getQuoteByCode: repository({ data: quote, source: "supabase" }, calls) });
    const response = await GET(request("?code=IS-2026-4201"));
    assert.equal(response.status, 401);
    assert.equal(calls.length, 0);
  }

  // Codice mancante o vuoto -> 400
  for (const query of ["", "?code=", "?code=%20%20"]) {
    const GET = createQuoteByCodeHandler({ authorize: allow, getQuoteByCode: repository({ data: quote, source: "supabase" }) });
    const response = await GET(request(query));
    assert.equal(response.status, 400, `query "${query}"`);
    const body = await response.json();
    assert.equal(body.ok, false);
  }

  // Preventivo trovato -> 200 con { ok, data }
  {
    const calls: string[] = [];
    const GET = createQuoteByCodeHandler({ authorize: allow, getQuoteByCode: repository({ data: quote, source: "supabase" }, calls) });
    const response = await GET(request("?code=%20IS-2026-4201%20"));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { ok: true, data: quote });
    assert.deepEqual(calls, ["IS-2026-4201"]);
  }

  // Preventivo non trovato -> 404
  {
    const GET = createQuoteByCodeHandler({ authorize: allow, getQuoteByCode: repository({ data: null, source: "supabase" }) });
    const response = await GET(request("?code=IS-2026-0000"));
    assert.equal(response.status, 404);
    assert.equal((await response.json()).ok, false);
  }

  // Errore repository -> 503 senza dettagli tecnici
  {
    const originalError = console.error;
    console.error = () => {};
    try {
      const GET = createQuoteByCodeHandler({
        authorize: allow,
        getQuoteByCode: repository({ data: null, source: "mock", error: "permission denied for table quotes (42501)" })
      });
      const response = await GET(request("?code=IS-2026-4201"));
      assert.equal(response.status, 503);
      const body = await response.json();
      assert.equal(body.ok, false);
      assert.doesNotMatch(JSON.stringify(body), /permission|42501/);

      const throwing = createQuoteByCodeHandler({
        authorize: allow,
        getQuoteByCode: async () => { throw new Error("boom"); }
      });
      const thrown = await throwing(request("?code=IS-2026-4201"));
      assert.equal(thrown.status, 500);
      assert.doesNotMatch(JSON.stringify(await thrown.json()), /boom/);
    } finally {
      console.error = originalError;
    }
  }

  console.log("admin quote-by-code checks passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
