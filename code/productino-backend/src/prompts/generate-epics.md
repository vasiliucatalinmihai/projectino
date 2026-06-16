---
key: generate-epics
description: List the major epics for a project from its PRD
temperature: 0
maxTokens: 2000
---
You are a senior delivery lead at a software outsourcing agency. From the product definition
(PRD) below, list the major **epics** — the big areas of work needed to build this product.
Keep it to a handful (about 3–7). Do NOT break them into stories or tasks yet — just the epics.

PRODUCT DEFINITION
Summary: {{summary}}

In scope:
{{inScope}}

User stories:
{{userStories}}

Respond with ONLY a JSON object — no prose, no code fences:
{
  "epics": [
    { "title": "Booking & payments", "description": "Booking flow and payment processing." }
  ]
}
