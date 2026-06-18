<script setup lang="ts">
// Public marketing landing page — reachable without auth (see middleware/auth.global.ts).
// Logged-in visitors are sent straight to the app.
definePageMeta({ layout: false });

const token = useCookie<string | null>('productino_token');
if (token.value) {
  await navigateTo('/projects', { replace: true });
}

// The pipeline, as an animated flow. The loop back from "Answers" to "Score" is
// the product's heart — confidence converges round after round.
const flow = [
  { key: 'brief', label: 'Brief', glyph: '✎' },
  { key: 'extract', label: 'Extract beliefs', glyph: '◇' },
  { key: 'score', label: 'Score coverage', glyph: '▤' },
  { key: 'ask', label: 'Ask client', glyph: '?' },
  { key: 'answers', label: 'Answers', glyph: '↺' },
  { key: 'define', label: 'Definition', glyph: '§' },
  { key: 'plan', label: 'Plan', glyph: '☷' },
  { key: 'propose', label: 'Proposal', glyph: '€' },
];

const capabilities = [
  {
    tag: 'intake',
    title: 'Smart intake',
    body: 'Drop in a messy brief or a raw meeting transcript. Productino normalizes it into a structured, traceable understanding — not a prompt dump.',
  },
  {
    tag: 'belief graph',
    title: 'The Belief Graph',
    body: 'Every requirement, assumption, risk and decision becomes a node — tagged with how sure we are and linked back to the exact line it came from.',
  },
  {
    tag: 'coverage',
    title: 'Gap analysis & scoring',
    body: 'Scores how well-defined the project is against a fixed rubric. A measurable confidence gate tells you when you’ve actually asked enough.',
  },
  {
    tag: 'questions',
    title: 'The right questions',
    body: 'Prioritized, deduped clarifying questions — each with a proposed default answer — exported as a clean, client-facing document.',
  },
  {
    tag: 'converge',
    title: 'The convergence loop',
    body: 'Paste the client’s reply and watch confidence climb round over round. It converges instead of endlessly chatting.',
  },
  {
    tag: 'conflicts',
    title: 'Conflict detection',
    body: 'Surfaces contradictions between requirements early — before they quietly blow up a fixed-price deal.',
  },
  {
    tag: 'definition',
    title: 'Product definition',
    body: 'A versioned PRD with user stories and NFRs, plus the contractual armor: explicit assumptions, out-of-scope and a risk register.',
  },
  {
    tag: 'delivery',
    title: 'Delivery plan',
    body: 'Decomposes into epics → stories → tasks with ranged estimates and honest MVP / later phasing.',
  },
  {
    tag: 'proposal',
    title: 'Priced proposal / SOW',
    body: 'A client-ready, phased, priced proposal falls out of the same data — no copy-paste drift between spec, tasks and quote.',
  },
  {
    tag: 'bring your own ai',
    title: 'Bring your own AI',
    body: 'Provider-agnostic: run on Claude, OpenAI, DeepSeek or Qwen with your own keys. Per-project token and cost tracking is built in.',
  },
];

const edge = [
  {
    title: 'Measurable convergence',
    body: 'A coverage map and a confidence gate — not vibes. You know when the brief is safe to quote.',
  },
  {
    title: 'Provenance & certainty',
    body: 'Soft beliefs stay soft until the client confirms them. Every claim traces back to its source.',
  },
  {
    title: 'One source of truth',
    body: 'PRD, tasks and proposal are projections of the same graph — they can’t drift apart.',
  },
  {
    title: 'Protects your margin',
    body: 'Assumptions, out-of-scope and risks are surfaced up front — your armor against scope creep.',
  },
];

const stats = [
  { value: '1', unit: 'briefing in', label: 'transcripts, docs, emails' },
  { value: '14', unit: 'rubric areas', label: 'scored for completeness' },
  { value: '1', unit: 'source of truth', label: 'PRD · tasks · proposal' },
  { value: '∞', unit: 'rounds', label: 'until you’re confident' },
];

const pains = [
  {
    title: 'Briefs that hide the work',
    body: 'A transcript full of “we’d probably want…” quietly becomes a fixed-price commitment nobody can defend.',
  },
  {
    title: 'Margin death by scope creep',
    body: '“But I thought X was included.” The four words that turn a profitable project into a loss.',
  },
  {
    title: 'Clarification that never ends',
    body: 'Forty back-and-forth emails later and you still can’t tell whether you’ve asked enough to commit.',
  },
  {
    title: 'Documents that drift',
    body: 'By week two the PRD, the task list and the quote each tell a different story.',
  },
];

const steps = [
  {
    n: '01',
    title: 'Ingest the briefing',
    body: 'Paste a transcript, document or email thread. Productino extracts discrete beliefs — each tagged with how sure it is and the exact line it came from.',
  },
  {
    n: '02',
    title: 'Map the Belief Graph',
    body: 'Requirements, assumptions, risks and decisions become a structured, versioned graph — not prose to re-read.',
  },
  {
    n: '03',
    title: 'Score & question',
    body: 'A coverage map shows what’s weak. Productino generates the highest-impact clarifying questions, each with a proposed default answer.',
  },
  {
    n: '04',
    title: 'Converge with the client',
    body: 'Paste their reply. Confidence climbs, contradictions surface, and a smaller next round is generated — until you clear the gate.',
  },
  {
    n: '05',
    title: 'Define & plan',
    body: 'A versioned PRD with assumptions, out-of-scope and risks — then epics → stories → tasks with ranged estimates and MVP phasing.',
  },
  {
    n: '06',
    title: 'Price the proposal',
    body: 'A phased, costed, client-ready SOW falls out of the same data — pricing computed from the plan, never guessed.',
  },
];

const personas = [
  {
    title: 'Outsourcing shops',
    body: 'Quote fixed-price work with confidence — and the assumptions to defend it.',
  },
  {
    title: 'Agencies & consultancies',
    body: 'Run discovery that converges instead of meandering, on every new engagement.',
  },
  {
    title: 'Solo consultants & PMs',
    body: 'Look like a ten-person discovery team — without the ten people.',
  },
];

const faqs = [
  {
    q: 'Does it replace my project managers?',
    a: 'No — it makes them faster. Productino does the structured gap-finding and drafting; your team curates the questions and talks to the client.',
  },
  {
    q: 'Which AI models does it use?',
    a: 'Bring your own: Claude, OpenAI, DeepSeek or Qwen, with your own keys. The prompts are provider-agnostic, so you’re never locked in.',
  },
  {
    q: 'Is my client data used to train models?',
    a: 'No. Calls go to your configured provider with your own keys, and nothing is shared across tenants.',
  },
  {
    q: 'What do I actually get out of it?',
    a: 'A coverage map, a clean client-facing question doc, a versioned PRD, a task breakdown with estimates, and a priced proposal — all from one briefing.',
  },
  {
    q: 'When can I use it?',
    a: 'Private beta now, broader access soon. Sign in if you already have an account, or request early access.',
  },
];
</script>

<template>
  <div class="min-h-screen bg-neutral-950 text-neutral-300">
    <!-- coming soon banner -->
    <div
      class="sticky top-0 z-30 flex items-center justify-center gap-2 border-b border-brand/30 bg-brand/10 px-4 py-2 text-center text-xs font-semibold text-brand sm:text-sm"
    >
      <span class="relative flex h-2 w-2">
        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
        <span class="relative inline-flex h-2 w-2 rounded-full bg-brand" />
      </span>
      Coming soon — productino is in private beta. Early access for outsourcing teams.
    </div>

    <!-- top nav -->
    <header class="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
      <div class="flex items-center gap-2.5">
        <img src="/mark.svg" alt="" width="34" height="34" class="rounded-lg" />
        <span class="font-mono text-lg font-extrabold tracking-tight text-white">
          productino<span class="text-brand">.</span>
        </span>
      </div>
      <NuxtLink to="/login" class="btn-ghost text-sm">Sign in</NuxtLink>
    </header>

    <!-- hero -->
    <section class="relative overflow-hidden">
      <div class="hero-grid" aria-hidden="true" />
      <div class="hero-glow" aria-hidden="true" />
      <div class="relative mx-auto max-w-3xl px-6 pb-10 pt-12 text-center lg:pt-20">
        <div class="reveal">
          <div class="kicker">// ai-assisted discovery-to-delivery</div>
          <h1 class="mx-auto mt-5 max-w-2xl text-[2.5rem] font-extrabold leading-[1.02] tracking-tight sm:text-[3.5rem]">
            <span class="block text-neutral-500">From a vague brief</span>
            <span class="block text-white">
              to a <span class="accent">scoped, costed</span> plan
            </span>
          </h1>
          <p class="mx-auto mt-6 max-w-xl text-base leading-relaxed text-neutral-400 sm:text-lg">
            Productino is the discovery engine for software outsourcing teams. It reads the client
            briefing, finds what’s missing, asks the right questions — then turns the answers into
            a definition, a roadmap and a priced proposal.
          </p>
          <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
            <NuxtLink to="/login" class="btn-primary px-5 py-2.5 text-base">Sign in</NuxtLink>
            <a href="#how" class="btn-ghost px-5 py-2.5 text-base">See how it works</a>
          </div>
          <p class="mt-6 font-mono text-[11px] text-neutral-600">
            provenance on every claim · bring your own model · no vector DB
          </p>
        </div>
      </div>

      <!-- animated product flow — the hero's payoff: the loop the headline promises -->
      <div class="relative px-6 pb-12 pt-2">
        <div class="mx-auto max-w-5xl">
          <div class="mb-4 text-center"><span class="kicker">// brief → definition → proposal</span></div>
          <div class="flow flex flex-wrap items-center justify-center gap-y-3">
            <template v-for="(step, i) in flow" :key="step.key">
              <div class="flow-step" :class="{ loop: step.key === 'answers' || step.key === 'score' }" :style="{ '--i': i }">
                <span class="flow-glyph" :style="{ '--i': i }">{{ step.glyph }}</span>
                <span class="flow-label">{{ step.label }}</span>
              </div>
              <span v-if="i < flow.length - 1" class="flow-conn" :style="{ '--i': i }" />
            </template>
          </div>
          <p class="mt-4 text-center font-mono text-[11px] text-neutral-500">
            <span class="text-brand">↺</span> answers feed back into scoring — confidence converges each round
          </p>
        </div>
      </div>
    </section>

    <!-- stats strip -->
    <section class="border-y border-neutral-900 bg-neutral-900/30 px-6 py-7">
      <div class="mx-auto grid max-w-5xl grid-cols-2 gap-6 sm:grid-cols-4">
        <div v-for="s in stats" :key="s.label" class="text-center">
          <div class="font-mono text-3xl font-extrabold text-brand">{{ s.value }}</div>
          <div class="mt-0.5 text-xs font-semibold uppercase tracking-wide text-neutral-200">{{ s.unit }}</div>
          <div class="text-[11px] text-neutral-500">{{ s.label }}</div>
        </div>
      </div>
    </section>

    <!-- the problem -->
    <section class="mx-auto max-w-6xl px-6 py-14">
      <div class="kicker">// sound familiar?</div>
      <h2 class="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
        Outsourcing margin dies in discovery
      </h2>
      <p class="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-400">
        Fixed-price work lives or dies on what you understood before you signed. The gaps you
        miss become the change requests you eat.
      </p>
      <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="pain in pains" :key="pain.title" class="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
          <div class="font-mono text-xl text-red-400/70">✕</div>
          <h3 class="mt-2 text-base font-semibold text-white">{{ pain.title }}</h3>
          <p class="mt-1.5 text-sm leading-relaxed text-neutral-400">{{ pain.body }}</p>
        </div>
      </div>
    </section>

    <!-- how it works -->
    <section id="how" class="border-t border-neutral-900 bg-neutral-900/20 px-6 py-14">
      <div class="mx-auto max-w-6xl">
        <div class="kicker">// how it works</div>
        <h2 class="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          One loop, with a confidence gate
        </h2>
        <div class="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="step in steps"
            :key="step.n"
            class="rounded-xl border border-neutral-800 bg-neutral-900 p-5 transition-colors hover:border-brand/40"
          >
            <div class="font-mono text-sm font-bold text-brand">{{ step.n }}</div>
            <h3 class="mt-1 text-base font-semibold text-white">{{ step.title }}</h3>
            <p class="mt-2 text-sm leading-relaxed text-neutral-400">{{ step.body }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- belief graph spotlight -->
    <section class="mx-auto max-w-6xl px-6 py-14">
      <div class="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <div class="kicker">// the belief graph</div>
          <h2 class="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            It knows what it doesn’t know yet
          </h2>
          <p class="mt-3 text-sm leading-relaxed text-neutral-400">
            Productino isn’t a document generator. It keeps a living graph of what you believe
            about the project — and, crucially, how sure you are and why.
          </p>
          <ul class="mt-5 flex flex-col gap-3 text-sm text-neutral-300">
            <li class="flex gap-2"><span class="text-brand">✓</span> Every belief carries a status — stated, inferred or assumed — so soft guesses never masquerade as scope.</li>
            <li class="flex gap-2"><span class="text-brand">✓</span> Provenance links each one back to the exact line of the briefing.</li>
            <li class="flex gap-2"><span class="text-brand">✓</span> A weighted coverage rollup tells you when it’s safe to quote.</li>
          </ul>
        </div>

        <!-- faux graph card (illustrative) -->
        <div class="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 shadow-2xl" aria-hidden="true">
          <div class="flex items-end justify-between">
            <div>
              <span class="font-mono text-4xl font-bold text-brand">76%</span>
              <span class="ml-1 text-xs uppercase tracking-wider text-neutral-500">confidence</span>
            </div>
            <span class="font-mono text-[11px] text-neutral-500">31% → 58% → 76%</span>
          </div>
          <div class="mt-4 font-mono text-[10px] uppercase tracking-wider text-neutral-500">// coverage</div>
          <div class="mt-2 flex flex-col gap-2.5">
            <div class="flex items-center gap-3">
              <span class="w-28 shrink-0 font-mono text-[11px] text-neutral-300">functional scope</span>
              <div class="h-2 flex-1 overflow-hidden rounded bg-neutral-800"><div class="h-full rounded bg-green-500" style="width: 80%" /></div>
              <span class="w-8 text-right text-[11px] text-neutral-400">80%</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="w-28 shrink-0 font-mono text-[11px] text-neutral-300">compliance</span>
              <div class="h-2 flex-1 overflow-hidden rounded bg-neutral-800"><div class="h-full rounded bg-red-500" style="width: 30%" /></div>
              <span class="w-8 text-right text-[11px] text-neutral-400">30%</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="w-28 shrink-0 font-mono text-[11px] text-neutral-300">integrations</span>
              <div class="h-2 flex-1 overflow-hidden rounded bg-neutral-800"><div class="h-full rounded bg-amber-500" style="width: 60%" /></div>
              <span class="w-8 text-right text-[11px] text-neutral-400">60%</span>
            </div>
          </div>
          <div class="mt-4 border-l-2 border-neutral-800 pl-3">
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded border border-amber-500/40 px-1.5 py-0.5 font-mono text-[10px] uppercase text-amber-300">inferred</span>
              <span class="font-mono text-[10px] uppercase tracking-wider text-neutral-500">feature</span>
              <span class="text-[11px] text-neutral-400">· 55%</span>
            </div>
            <p class="mt-1 text-sm text-neutral-200">Recurring monthly subscriptions</p>
            <p class="mt-1 text-[11px] italic text-neutral-600">“we’ll probably need people to pay every month”</p>
          </div>
        </div>
      </div>
    </section>

    <!-- capabilities -->
    <section id="capabilities" class="mx-auto max-w-6xl px-6 py-14">
      <div class="kicker">// capabilities</div>
      <h2 class="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
        Everything from intake to invoice-ready scope
      </h2>
      <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="cap in capabilities"
          :key="cap.tag"
          class="rounded-xl border border-neutral-800 bg-neutral-900 p-5 transition-colors hover:border-brand/40"
        >
          <div class="kicker">// {{ cap.tag }}</div>
          <h3 class="mt-1.5 text-base font-semibold text-white">{{ cap.title }}</h3>
          <p class="mt-2 text-sm leading-relaxed text-neutral-400">{{ cap.body }}</p>
        </div>
      </div>
    </section>

    <!-- who it's for -->
    <section class="border-t border-neutral-900 bg-neutral-900/20 px-6 py-14">
      <div class="mx-auto max-w-6xl">
        <div class="kicker">// built for</div>
        <h2 class="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Teams that quote to win
        </h2>
        <div class="mt-8 grid gap-4 md:grid-cols-3">
          <div
            v-for="persona in personas"
            :key="persona.title"
            class="rounded-xl border border-neutral-800 bg-neutral-900 p-6"
          >
            <h3 class="text-base font-semibold text-white">{{ persona.title }}</h3>
            <p class="mt-2 text-sm leading-relaxed text-neutral-400">{{ persona.body }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- why not chatgpt -->
    <section class="border-t border-neutral-900 bg-neutral-950 px-6 py-14">
      <div class="mx-auto max-w-6xl">
        <div class="kicker">// why not just chatgpt</div>
        <h2 class="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Not a document generator — a convergence engine
        </h2>
        <p class="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-400">
          Anyone can write a PRD today. The value is the AI knowing what it
          <span class="text-neutral-200">doesn’t know yet</span>, and forcing the ambiguity out
          before you commit to a fixed price.
        </p>
        <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div v-for="item in edge" :key="item.title" class="border-l-2 border-brand/50 pl-4">
            <h3 class="text-sm font-semibold text-white">{{ item.title }}</h3>
            <p class="mt-1.5 text-sm leading-relaxed text-neutral-400">{{ item.body }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- faq -->
    <section class="mx-auto max-w-3xl px-6 py-14">
      <div class="kicker">// faq</div>
      <h2 class="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">Questions, answered</h2>
      <div class="mt-6 flex flex-col gap-3">
        <details
          v-for="faq in faqs"
          :key="faq.q"
          class="group rounded-xl border border-neutral-800 bg-neutral-900 p-4 [&_summary::-webkit-details-marker]:hidden"
        >
          <summary class="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-neutral-100">
            {{ faq.q }}
            <span class="text-neutral-600 transition-transform group-open:rotate-90">▸</span>
          </summary>
          <p class="mt-2 text-sm leading-relaxed text-neutral-400">{{ faq.a }}</p>
        </details>
      </div>
    </section>

    <!-- footer cta -->
    <footer class="border-t border-neutral-900 px-6 py-12">
      <div class="mx-auto flex max-w-3xl flex-col items-center text-center">
        <img src="/mark.svg" alt="" width="48" height="48" class="rounded-xl" />
        <h2 class="mt-4 text-xl font-bold tracking-tight text-white">
          Stop losing margin to scope creep.
        </h2>
        <p class="mt-2 max-w-xl text-sm text-neutral-400">
          Productino is launching soon for outsourcing and agency teams. Sign in if you already
          have an account.
        </p>
        <div class="mt-5 flex items-center gap-3">
          <NuxtLink to="/login" class="btn-primary px-5 py-2.5">Sign in</NuxtLink>
          <span class="rounded-full border border-brand/30 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand">
            Coming soon
          </span>
        </div>
        <p class="mt-8 font-mono text-[11px] text-neutral-600">
          productino<span class="text-brand">.</span> — from brief to delivery
        </p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* soft brand glow + faint terminal grid behind the hero */
.hero-glow {
  position: absolute;
  inset: -25% 0 auto 0;
  height: 520px;
  background: radial-gradient(50% 55% at 50% 0%, rgba(74, 222, 128, 0.14), transparent 70%);
  pointer-events: none;
}
.hero-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(74, 222, 128, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(74, 222, 128, 0.05) 1px, transparent 1px);
  background-size: 44px 44px;
  -webkit-mask-image: radial-gradient(75% 65% at 50% 8%, #000 0%, transparent 75%);
  mask-image: radial-gradient(75% 65% at 50% 8%, #000 0%, transparent 75%);
}

/* headline accent — underlined in brand, not just colored */
.accent {
  color: #4ade80;
  box-shadow: inset 0 -0.12em 0 rgba(74, 222, 128, 0.22);
}

/* gentle load reveal */
.reveal {
  animation: rise 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
@keyframes rise {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}

/* animated pipeline — sequential green pulse + flowing connectors */
.flow-step {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 9999px;
  border: 1px solid #262626;
  background: #0f0f0f;
  padding: 0.4rem 0.85rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: #737373;
  white-space: nowrap;
  animation: chip 7.2s ease-in-out infinite;
  animation-delay: calc(var(--i) * 0.8s);
}
.flow-step.loop {
  box-shadow: 0 0 0 1px rgba(74, 222, 128, 0.12) inset;
}
.flow-glyph {
  display: inline-flex;
  height: 1.25rem;
  width: 1.25rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: #1f1f1f;
  font-family: theme('fontFamily.mono');
  font-size: 0.7rem;
  animation: glyph 7.2s ease-in-out infinite;
  animation-delay: calc(var(--i) * 0.8s);
}
.flow-label {
  font-family: theme('fontFamily.mono');
}
.flow-conn {
  height: 2px;
  width: 1.5rem;
  border-radius: 2px;
  background-image: linear-gradient(
    90deg,
    #262626 0%,
    #262626 38%,
    #4ade80 50%,
    #262626 62%,
    #262626 100%
  );
  background-size: 250% 100%;
  animation: flow 1.8s linear infinite;
  animation-delay: calc(var(--i) * 0.12s);
}
@keyframes chip {
  0%, 70%, 100% {
    border-color: #262626;
    color: #737373;
    transform: translateY(0);
  }
  9% {
    border-color: #4ade80;
    color: #4ade80;
    transform: translateY(-2px);
  }
}
@keyframes glyph {
  0%, 70%, 100% {
    background: #1f1f1f;
    color: #737373;
    transform: scale(1);
  }
  9% {
    background: #4ade80;
    color: #0a0a0a;
    transform: scale(1.12);
  }
}
@keyframes flow {
  0% {
    background-position: 250% 0;
  }
  100% {
    background-position: -250% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .flow-step,
  .flow-glyph,
  .flow-conn,
  .reveal {
    animation: none;
  }
}
</style>
