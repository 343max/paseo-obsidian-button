/**
 * Where a link ends and the markup around it begins.
 *
 * Prose wraps links in things that are not part of them: sentence punctuation,
 * Markdown emphasis, and the closing bracket of the phrase the link sits in.
 * The trailing characters here are the ones GitHub-flavored Markdown also
 * excludes from an autolink.
 */

const TRAILING_MARKUP = /[.,;:!?*_~`]+$/;
const CLOSERS: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

function occurrences(value: string, character: string): number {
  return value.split(character).length - 1;
}

/** Trims until neither markup nor an unopened closing bracket is left. */
export function trimLinkMarkup(raw: string): string {
  let value = raw;
  for (;;) {
    const withoutMarkup = value.replace(TRAILING_MARKUP, "");
    if (withoutMarkup !== value) {
      value = withoutMarkup;
      continue;
    }
    const last = value[value.length - 1];
    const opener = CLOSERS[last];
    // A closer the link never opened belongs to the prose; `Plan(1).md` keeps its own.
    if (!opener || occurrences(value, last) <= occurrences(value, opener)) return value;
    value = value.slice(0, -1);
  }
}
