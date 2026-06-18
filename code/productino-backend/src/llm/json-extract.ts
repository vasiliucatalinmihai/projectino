/**
 * Tolerant JSON extraction from a model's text response. Models wrap JSON in
 * ``` fences, add prose around it, or emit a leading array — this pulls out the
 * outermost JSON value and parses it.
 */
export interface JsonExtract {
  ok: boolean;
  value?: any;
  error?: string;
}

export function extractJson(text: string): JsonExtract {
  let s = (text ?? '').trim();
  if (!s) return { ok: false, error: 'empty response' };

  if (s.startsWith('```')) {
    s = s
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
  }

  const firstObj = s.indexOf('{');
  const firstArr = s.indexOf('[');
  if (firstObj === -1 && firstArr === -1) return { ok: false, error: 'no JSON object in output' };

  let start: number;
  let closeChar: string;
  if (firstArr !== -1 && (firstObj === -1 || firstArr < firstObj)) {
    start = firstArr;
    closeChar = ']';
  } else {
    start = firstObj;
    closeChar = '}';
  }

  const end = s.lastIndexOf(closeChar);
  if (end <= start) return { ok: false, error: 'unbalanced JSON in output' };

  try {
    return { ok: true, value: JSON.parse(s.slice(start, end + 1)) };
  } catch (e: any) {
    return { ok: false, error: `JSON.parse failed: ${e?.message ?? e}` };
  }
}
