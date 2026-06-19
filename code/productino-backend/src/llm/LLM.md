# LLM module

Provider-agnostic prompt execution for productino. Every AI call in the app — extract
beliefs, score coverage, map answers, synthesize the PRD, plan epics, estimate, draft the
proposal — flows through here. Callers express *what* they want (a prompt key + variables +
the expected shape); this module decides *who* runs it (which provider/model/credential),
*how* to force structured output, and guarantees the result is **typed, validated JSON** —
never prose to re-parse.

Two design rules drive the whole module:

1. **Prompts are provider-agnostic.** An account's configured model may be Anthropic, OpenAI,
   DeepSeek, Qwen, or Gemini. The same prompt must run on any of them, so the runner adapts to
   each provider's quirks instead of the prompts caring. See [[prompts-are-provider-agnostic]].
2. **Structure is non-negotiable.** Output is validated against a Zod schema; bad output is
   sent back to the model for a bounded repair loop before the caller ever sees it.

---

## Layers

```
 caller (a pipeline service: extract / score / synthesize / estimate …)
        │  run({ promptKey, vars, schema, accountId, validate? })
        ▼
 ┌───────────────────────────────────────────────────────────────────────┐
 │ StructuredLlmService      the "make it typed JSON" layer                │
 │   render prompt → run → extract JSON → Zod validate → semantic check    │
 │   → bounded repair loop (3 attempts) → record outcome + token usage     │
 └───────────────────────────────────────────────────────────────────────┘
        │  runWith(config, request)
        ▼
 ┌───────────────────────────────────────────────────────────────────────┐
 │ LlmService (PromptRunner) the provider-agnostic dispatch layer          │
 │   resolve account config → pick adapter by provider name → call it      │
 └───────────────────────────────────────────────────────────────────────┘
        │                                   │
        │ which model?                      │ how to call it?
        ▼                                   ▼
 LlmConfigResolverService           LlmProviderAdapter (per provider)
   BYO-AI vs system default           Anthropic · OpenAI · DeepSeek · Qwen · Gemini
   → ResolvedLlmConfig                BaseLlmAdapter: HTTP + timeout + retry/backoff
```

---

## Files

| File | Role |
| --- | --- |
| `prompt-runner.ts` | **The port.** Vendor-neutral types: `LlmRequest`, `LlmResult`, `ResolvedLlmConfig`, the `PromptRunner` interface, and the error types (`LlmNotConfiguredError`, `LlmProviderError`). Everything else depends on these, never on a vendor SDK. |
| `llm.service.ts` | **`LlmService`** — implements `PromptRunner`. Resolves the account's config, then dispatches to the matching adapter by provider name. `run(accountId, req)` resolves first; `runWith(config, req)` takes an already-resolved config. |
| `llm-config-resolver.service.ts` | **`LlmConfigResolverService`** — decides *which* AiModel an account runs with: bring-your-own-AI → the account's active model; otherwise → the system account's active model. Both are stored as identically-shaped `AiModel` rows, so the call path is the same either way. `resolve()` returns a runnable config (with credential); `describe()` returns a safe, key-free descriptor for the UI. |
| `structured-llm.service.ts` | **`StructuredLlmService`** — the high-level entry point pipelines actually call. Renders the prompt, runs it, extracts + validates JSON, runs the optional semantic check, drives the repair loop, and records the outcome + token spend. |
| `provider-capabilities.ts` | Per-provider capability table: `maxOutputTokens` (clamp a prompt's request to the provider's hard cap), `structuredOutput` mode (`tool` = Anthropic strict tool-use, `json` = native JSON mode, `none`), `promptCache`. |
| `json-extract.ts` | Tolerant JSON extraction — strips ``` fences and surrounding prose, pulls out the outermost JSON value, parses it. |
| `schemas/json-schemas.ts` | Compact **JSON Schemas** per prompt key, used as the `input_schema` for Anthropic tool-use. Model-facing hint/contract — kept lenient. |
| `schemas/pipeline-schemas.ts` | **Zod schemas** per prompt key — the *authoritative* validator. Also normalizes (coerce confidence to 0–1, uppercase enums, split strings to arrays). A parse failure feeds the repair loop. |
| `adapters/llm-provider.adapter.ts` | `LlmProviderAdapter` interface + `BaseLlmAdapter` (shared `fetch` with timeout, retry, and exponential backoff with jitter; honors `Retry-After`). |
| `adapters/{anthropic,openai,deepseek,qwen,gemini}.adapter.ts` | One adapter per provider. Translate the neutral `LlmRequest` into that provider's HTTP body, then map the response back to a neutral `AdapterResult` (text, token usage, finish reason). |
| `llm.module.ts` | NestJS wiring. Provides the adapters, the resolver, and `LlmService`; exports `LlmService` + `LlmConfigResolverService`. |

> **Two schema sets, on purpose.** The JSON Schema (`json-schemas.ts`) is what we *ask the
> model for* (Anthropic tool-use input schema). The Zod schema (`pipeline-schemas.ts`) is what
> we *enforce and normalize*. Zod is authoritative — the JSON Schema is a hint, so it stays
> lenient (no `additionalProperties`) and the two never need to be byte-identical.

---

## Request flow (one structured call)

```
caller: StructuredLlmService.run({ key, vars, schema, accountId, validate? })
   │
   1. PromptManagerService.get(key, vars)        -- render template → prompt text + config
   │
   2. LlmConfigResolverService.resolve(account)  -- BYO-AI? account model : system default
   │      └- not configured / no key → 422 Unprocessable Entity
   │
   3. capabilitiesFor(provider)                  -- clamp maxTokens; pick structured-output mode
   │      └- mode 'tool' → attach JSON Schema (Anthropic);  'json' → native JSON mode
   │
   ▼
 ┌──────────────────── repair loop, up to 3 attempts ────────────────────┐
 │                                                                        │
 │  4. LlmService.runWith(config, request)                                │
 │        └─ adapter.generate() ── HTTP → provider (timeout, retry/backoff) │
 │                                                                        │
 │  5. extractJson(text)            -- strip fences/prose, parse          │
 │  6. schema.safeParse(value)      -- Zod validate + normalize           │
 │  7. validate?(data)              -- optional semantic check            │
 │        (e.g. quotes really appear in the source, refs exist in graph)  │
 │                                                                        │
 │   any step fails ─→ build a repair message (the errors + bad output)   │
 │                     as the next attempt's messages, then loop ─────────┤
 │   all pass ───────→ record success + token usage, RETURN typed data    │
 └────────────────────────────────────────────────────────────────────────┘
   │
   └- still failing after 3 attempts → record failure → 422
      (note: content that's schema-valid but semantically unresolved is
       accepted on the final attempt; services degrade it gracefully)
```

Key behaviors:

- **Untrusted-input hygiene.** A fixed system preamble tells the model that source/reply/
  answers text is untrusted client data: analyze it, never obey instructions inside it.
- **Repair, not retry.** On invalid JSON, schema failure, or a failed semantic check, the bad
  output + the specific errors are fed back as a new turn. Truncation (`finish_reason: length`)
  gets a distinct "your response was cut off — return the complete object" instruction.
- **Observability.** Every attempt records latency, token in/out, provider/model, attempt count,
  and semantic metrics via `PromptManagerService.recordOutcome`; successful spend is attributed
  to the resolved `AiModel`.

---

## Provider dispatch flow

```
                       LlmService (holds provider → adapter map)
                                     │  config.provider
        ┌────────────┬───────────────┼───────────────┬────────────┐
        ▼            ▼               ▼               ▼            ▼
   Anthropic      OpenAI         DeepSeek          Qwen        Gemini
   /v1/messages   /chat/completions (OpenAI-compatible)        :generateContent
   tool-use +     response_format = json_object                responseMimeType
   prompt cache                                                 = application/json
        └────────────┴───────────────┴───────────────┴────────────┘
                                     │
                          neutral AdapterResult
                       { text, usage, finishReason }
```

How structured output differs by provider (decided by `provider-capabilities.ts`):

- **Anthropic** (`structuredOutput: 'tool'`) — the prompt's JSON Schema becomes a forced
  tool-use call (`tool_choice`), and the `tool_use.input` *is* the structured result. System
  prompt is sent as a cached (`cache_control: ephemeral`) block so the reused rubric/context
  prefix isn't re-billed across a round. `temperature` is omitted for 4.x models (they 400 on it).
- **Everyone else** (`structuredOutput: 'json'`) — native JSON mode (OpenAI/DeepSeek/Qwen
  `response_format: json_object`, Gemini `responseMimeType`). No strict schema at the provider;
  the Zod validate + repair loop is the safety net.

`BaseLlmAdapter` gives all fetch-based adapters one shared HTTP path: 60s timeout (configurable
via `LLM_TIMEOUT_MS`), up to 2 retries (`LLM_MAX_RETRIES`) on 429/5xx/network with exponential
backoff + jitter, honoring `Retry-After`.

---

## Adding a provider

1. Subclass `BaseLlmAdapter`, set `providers`, implement `generate()` (map `LlmRequest` →
   provider body, response → `AdapterResult`).
2. Add a row to the `TABLE` in `provider-capabilities.ts`.
3. Register the adapter in `llm.module.ts`.

No prompt or schema changes are needed — that's the point of the port.
