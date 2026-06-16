---
key: detect-conflicts
description: Find contradictions between the project's beliefs
temperature: 0
maxTokens: 4000
---
You are a senior software discovery analyst. Below is the current list of BELIEFS about a
client's project (each with how sure we are). Find genuine **contradictions** — pairs of
beliefs that cannot both be true, or that pull the design in incompatible directions (e.g.
"single-tenant, one company per instance" vs "users can switch between organisations";
"no data migration" vs "import 12k legacy accounts").

Rules:
- Only report real conflicts. If two beliefs are merely unrelated or simply unconfirmed, do
  NOT report them. It is correct to return an empty list.
- For each conflict, name the two beliefs (`beliefA`, `beliefB`, copied/short-paraphrased from
  the list), a short `summary` (≤ 10 words), and a `detail` explaining why they conflict and
  what to clarify.

BELIEFS:
{{beliefsList}}

Respond with ONLY a JSON object — no prose, no code fences:
{
  "conflicts": [
    {
      "beliefA": "Single-tenant: one company per instance",
      "beliefB": "Users can switch between organisations",
      "summary": "Tenancy model contradiction",
      "detail": "Single-tenant assumed, but org-switching implies multi-tenant. Confirm whether one instance serves one company or many."
    }
  ]
}
