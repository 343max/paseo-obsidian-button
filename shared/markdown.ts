/**
 * A small Markdown reader for plugin-rendered messages.
 *
 * A timeline transformer replaces the whole entry, so Paseo's own Markdown no
 * longer runs on messages this plugin renders. This covers the formatting agents
 * actually use in prose: headings, paragraphs, lists, quotes, rules, fenced code,
 * tables, and the inline spans below. Rich layout stays Paseo's job, which is why
 * the plugin only takes over a message that carries an Obsidian link.
 *
 * Pure, synchronous, and length-agnostic: callers memoize on the text.
 */

export type Inline =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "strong"; readonly content: Inline[] }
  | { readonly kind: "emphasis"; readonly content: Inline[] }
  | { readonly kind: "strike"; readonly content: Inline[] }
  | { readonly kind: "code"; readonly text: string }
  | { readonly kind: "link"; readonly text: string; readonly href: string };

export type Block =
  | { readonly kind: "paragraph"; readonly content: Inline[] }
  | { readonly kind: "heading"; readonly level: number; readonly content: Inline[] }
  | { readonly kind: "code"; readonly language: string | null; readonly text: string }
  | { readonly kind: "quote"; readonly content: Inline[] }
  | { readonly kind: "list"; readonly ordered: boolean; readonly start: number; readonly items: Inline[][] }
  | { readonly kind: "table"; readonly header: Inline[][]; readonly rows: Inline[][][] }
  | { readonly kind: "rule" };

const FENCE = /^\s{0,3}(```+|~~~+)\s*([^\s`]*)\s*$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const RULE = /^\s{0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/;
const BULLET = /^\s{0,3}[-*+]\s+(.*)$/;
const ORDERED = /^\s{0,3}(\d{1,9})[.)]\s+(.*)$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const TABLE_DIVIDER = /^\s*\|?(?:\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?\s*$/;
const WORD = /[0-9A-Za-z_]/;
const LINK_START = /^\[([^\]]*)\]\(([^()\s]+)(?:\s+"[^"]*")?\)/;
const AUTOLINK = /^<((?:https?|obsidian):\/\/[^>\s]+)>/;
const BARE_URL = /^((?:https?|obsidian):\/\/[^\s<>"'`]+)/;
const CODE_SPAN = /^(`+)([^`]|[^`][\s\S]*?[^`])\1/;
const STRONG = /^(\*\*|__)(?=\S)([\s\S]*?\S)\1/;
const STRIKE = /^~~(?=\S)([\s\S]*?\S)~~/;

function openLinkHref(raw: string): string {
  const trailing = raw.replace(/[.,;:!?]+$/, "");
  return trailing.length > 0 ? trailing : raw;
}

/**
 * Reads inline spans. Hand-rolled rather than one large regular expression so
 * that an unbalanced delimiter simply stays text instead of eating the rest.
 */
export function parseInline(text: string): Inline[] {
  const spans: Inline[] = [];
  let buffer = "";
  let index = 0;

  const flush = () => {
    if (buffer.length > 0) spans.push({ kind: "text", text: buffer });
    buffer = "";
  };

  while (index < text.length) {
    const rest = text.slice(index);
    let match = CODE_SPAN.exec(rest);
    if (match) {
      flush();
      spans.push({ kind: "code", text: match[2] });
      index += match[0].length;
      continue;
    }

    match = LINK_START.exec(rest);
    if (match) {
      flush();
      const href = openLinkHref(match[2]);
      spans.push({ kind: "link", text: match[1] || href, href });
      index += match[0].length;
      continue;
    }

    match = AUTOLINK.exec(rest);
    if (match) {
      flush();
      spans.push({ kind: "link", text: match[1], href: match[1] });
      index += match[0].length;
      continue;
    }

    match = BARE_URL.exec(rest);
    if (match) {
      const href = openLinkHref(match[1]);
      flush();
      spans.push({ kind: "link", text: href, href });
      index += href.length;
      continue;
    }

    match = STRONG.exec(rest);
    if (match) {
      flush();
      spans.push({ kind: "strong", content: parseInline(match[2]) });
      index += match[0].length;
      continue;
    }

    match = STRIKE.exec(rest);
    if (match) {
      flush();
      spans.push({ kind: "strike", content: parseInline(match[1]) });
      index += match[0].length;
      continue;
    }

    const character = rest[0];
    // Emphasis only outside words, so `snake_case_name` and `2*3*4` stay text.
    if ((character === "*" || character === "_") && (index === 0 || !WORD.test(text[index - 1])) && rest[1] && rest[1] !== " ") {
      const emphasis = new RegExp(`^\\${character}(?=\\S)([\\s\\S]*?\\S)\\${character}`).exec(rest);
      if (emphasis) {
        flush();
        spans.push({ kind: "emphasis", content: parseInline(emphasis[1]) });
        index += emphasis[0].length;
        continue;
      }
    }

    buffer += character;
    index += 1;
  }

  flush();
  return spans;
}

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function isTableStart(lines: string[], index: number): boolean {
  const line = lines[index];
  const next = lines[index + 1];
  return line !== undefined && next !== undefined && line.includes("|") && TABLE_DIVIDER.test(next);
}

function indentOf(line: string): number {
  const match = /^[ \t]*/.exec(line);
  return match ? match[0].replace(/\t/g, "  ").length : 0;
}

/** A fence closes on a line holding nothing but the marker it opened with. */
function isClosingFence(line: string, marker: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 3 || trimmed[0] !== marker) return false;
  for (const character of trimmed) {
    if (character !== marker) return false;
  }
  return true;
}

/** Blocks in reading order. Unknown syntax degrades to paragraphs, never to nothing. */
export function parseMarkdown(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let index = 0;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ kind: "paragraph", content: parseInline(paragraph.join(" ").trim()) });
    paragraph = [];
  };

  while (index < lines.length) {
    const line = lines[index];

    const fence = FENCE.exec(line);
    if (fence) {
      flushParagraph();
      const marker = fence[1][0];
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !isClosingFence(lines[index], marker)) {
        body.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push({ kind: "code", language: fence[2] || null, text: body.join("\n") });
      continue;
    }

    if (line.trim().length === 0) {
      flushParagraph();
      index += 1;
      continue;
    }

    if (RULE.test(line)) {
      flushParagraph();
      blocks.push({ kind: "rule" });
      index += 1;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph();
      blocks.push({ kind: "heading", level: heading[1].length, content: parseInline(heading[2].trim()) });
      index += 1;
      continue;
    }

    if (QUOTE.test(line)) {
      flushParagraph();
      const quoted: string[] = [];
      while (index < lines.length) {
        const quotedLine = QUOTE.exec(lines[index]);
        if (!quotedLine) break;
        quoted.push(quotedLine[1]);
        index += 1;
      }
      blocks.push({ kind: "quote", content: parseInline(quoted.join(" ").trim()) });
      continue;
    }

    if (isTableStart(lines, index)) {
      flushParagraph();
      const header = splitRow(lines[index]).map(parseInline);
      index += 2;
      const rows: Inline[][][] = [];
      while (index < lines.length && lines[index].includes("|") && lines[index].trim().length > 0) {
        rows.push(splitRow(lines[index]).map(parseInline));
        index += 1;
      }
      blocks.push({ kind: "table", header, rows });
      continue;
    }

    const bullet = BULLET.exec(line);
    const ordered = ORDERED.exec(line);
    if (bullet || ordered) {
      flushParagraph();
      const items: Inline[][] = [];
      const start = ordered ? Number.parseInt(ordered[1], 10) : 1;
      while (index < lines.length) {
        const itemLine = lines[index];
        const nextBullet = BULLET.exec(itemLine);
        const nextOrdered = ORDERED.exec(itemLine);
        if (nextBullet || nextOrdered) {
          items.push(parseInline((nextBullet ? nextBullet[1] : nextOrdered?.[2] ?? "").trim()));
          index += 1;
          continue;
        }
        // An indented line without a marker continues the item above it.
        if (items.length > 0 && itemLine.trim().length > 0 && indentOf(itemLine) >= 2) {
          const last = items[items.length - 1];
          items[items.length - 1] = [...last, ...parseInline(` ${itemLine.trim()}`)];
          index += 1;
          continue;
        }
        break;
      }
      blocks.push({ kind: "list", ordered: Boolean(ordered), start, items });
      continue;
    }

    paragraph.push(line.trim());
    index += 1;
  }

  flushParagraph();
  return blocks;
}
