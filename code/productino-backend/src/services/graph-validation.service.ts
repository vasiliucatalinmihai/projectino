import { Injectable } from '@nestjs/common';

/** Where a quote was found in the source, and how confidently. */
export type QuoteMatch = 'exact' | 'normalized' | 'fuzzy' | 'none';
export interface QuoteLocation {
  span?: [number, number];
  match: QuoteMatch;
}

/** Result of grading a batch of beliefs' quotes against their source. */
export interface BeliefGrading {
  graded: number; // beliefs that carried a non-empty quote
  grounded: number; // of those, found in the source (any match tier)
  ungrounded: string[]; // names of beliefs whose quote was not found
  rate: number; // grounded / graded (1.0 when nothing to grade)
}

/** Resolving model-emitted references (e.g. belief names) onto the real graph. */
export interface RefResolution {
  resolved: Map<string, string>; // input name → canonical node name
  unknown: string[]; // references that match no node
}

const FUZZY_RECALL = 0.6; // quote → source: share of quote tokens present
const REF_JACCARD = 0.5; // reference → node name: token-set overlap

/**
 * Deterministic, LLM-free semantic checks over model output. The product's
 * immutable Source text and the existing belief graph are the oracle: we verify
 * that quotes actually appear in the source and that references point at real
 * nodes — catching fabrication without a second model call.
 */
@Injectable()
export class GraphValidationService {
  /**
   * Locate a quote in the source. Tries exact, then whitespace-tolerant (which
   * still yields a real span), then a loose token-overlap fallback (grounded but
   * no precise span). `none` means the quote isn't supported by the source.
   */
  locateQuote(rawQuote: string | null | undefined, source: string): QuoteLocation {
    const quote = (rawQuote ?? '').trim();
    if (!quote || !source) return { match: 'none' };

    const exactIndex = source.indexOf(quote);
    if (exactIndex >= 0) return { span: [exactIndex, exactIndex + quote.length], match: 'exact' };

    const regex = this.whitespaceTolerantRegex(quote);
    if (regex) {
      const match = regex.exec(source);
      if (match) return { span: [match.index, match.index + match[0].length], match: 'normalized' };
    }

    if (this.tokenRecall(quote, source) >= FUZZY_RECALL) return { match: 'fuzzy' };
    return { match: 'none' };
  }

  /**
   * Grade a batch of beliefs' quotes. Beliefs with an empty quote are skipped
   * (a legitimately unsourced ASSUMED belief is not a hallucination).
   */
  gradeBeliefs(
    beliefs: Array<{ name?: string | null; quote?: string | null }>,
    source: string,
  ): BeliefGrading {
    let graded = 0;
    let grounded = 0;
    const ungrounded: string[] = [];
    for (const belief of beliefs) {
      const quote = (belief.quote ?? '').trim();
      if (!quote) continue;
      graded++;
      if (this.locateQuote(quote, source).match !== 'none') grounded++;
      else ungrounded.push((belief.name ?? '').trim() || '(unnamed)');
    }
    const rate = graded ? Math.round((grounded / graded) * 100) / 100 : 1;
    return { graded, grounded, ungrounded, rate };
  }

  /**
   * Resolve model-emitted references onto real node names (exact → normalized →
   * fuzzy). Anything that resolves is normalized to the canonical node name;
   * the rest are reported as `unknown` (invented references).
   */
  resolveBeliefRefs(names: string[], nodeNames: string[]): RefResolution {
    const byExact = new Map(nodeNames.map((name) => [name, name]));
    const byNormalized = new Map(nodeNames.map((name) => [this.normalize(name), name]));

    const resolved = new Map<string, string>(); // keyed by the caller's original string
    const unknown: string[] = [];
    for (const raw of names) {
      const name = (raw ?? '').trim();
      if (!name) {
        unknown.push(raw);
        continue;
      }
      if (byExact.has(name)) {
        resolved.set(raw, byExact.get(name)!);
        continue;
      }
      const normalized = this.normalize(name);
      if (byNormalized.has(normalized)) {
        resolved.set(raw, byNormalized.get(normalized)!);
        continue;
      }
      const fuzzy = this.bestFuzzyNode(name, nodeNames);
      if (fuzzy) resolved.set(raw, fuzzy);
      else unknown.push(raw);
    }
    return { resolved, unknown };
  }

  // ── internals ────────────────────────────────────────────────────

  private whitespaceTolerantRegex(quote: string): RegExp | null {
    if (!/[a-zA-Z0-9]/.test(quote)) return null;
    const pattern = quote
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // escape regex metacharacters (leaves whitespace)
      .replace(/\s+/g, '\\s+'); // then tolerate any run of whitespace
    try {
      return new RegExp(pattern);
    } catch {
      return null;
    }
  }

  private tokenRecall(needle: string, haystack: string): number {
    const needleTokens = this.tokens(needle);
    if (!needleTokens.length) return 0;
    const haystackTokens = new Set(this.tokens(haystack));
    const hits = needleTokens.filter((token) => haystackTokens.has(token)).length;
    return hits / needleTokens.length;
  }

  private bestFuzzyNode(name: string, nodeNames: string[]): string | null {
    const nameTokens = new Set(this.tokens(name));
    if (!nameTokens.size) return null;
    let best: string | null = null;
    let bestScore = 0;
    for (const node of nodeNames) {
      const score = this.jaccard(nameTokens, new Set(this.tokens(node)));
      if (score > bestScore) {
        bestScore = score;
        best = node;
      }
    }
    return bestScore >= REF_JACCARD ? best : null;
  }

  private jaccard(a: Set<string>, b: Set<string>): number {
    if (!a.size || !b.size) return 0;
    let intersection = 0;
    for (const token of a) if (b.has(token)) intersection++;
    return intersection / (a.size + b.size - intersection);
  }

  private tokens(text: string): string[] {
    return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  }

  private normalize(text: string): string {
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
  }
}
