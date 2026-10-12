import { describe, expect, it } from "vitest";
import { findObsidianLinks } from "../shared/obsidian-link";
import { parseInline, parseMarkdown, type Block, type Inline } from "../shared/markdown";

describe("parseMarkdown", () => {
  it("reads headings, paragraphs, and lists", () => {
    const blocks = parseMarkdown("# Title\n\nSome prose.\n\n- one\n- two\n\n1. first\n2. second");
    expect(blocks.map((block) => block.kind)).toEqual(["heading", "paragraph", "list", "list"]);
    const lists = blocks.filter((block) => block.kind === "list") as Extract<Block, { kind: "list" }>[];
    expect(lists[0]?.ordered).toBe(false);
    expect(lists[0]?.items).toEqual([[{ kind: "text", text: "one" }], [{ kind: "text", text: "two" }]]);
    expect(lists[1]).toMatchObject({ ordered: true, start: 1 });
    expect(lists[1]?.items).toHaveLength(2);
  });

  it("keeps a fenced block together and out of the prose", () => {
    const blocks = parseMarkdown("before\n\n```ts\nconst a = 1;\n```\n\nafter");
    expect(blocks.map((block) => block.kind)).toEqual(["paragraph", "code", "paragraph"]);
    expect(blocks[1]).toMatchObject({ language: "ts", text: "const a = 1;" });
  });

  it("reads a table with its header row", () => {
    const blocks = parseMarkdown("| a | b |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ kind: "table" });
    const table = blocks[0] as { rows: unknown[] };
    expect(table.rows).toHaveLength(2);
  });

  it("keeps a link inside a paragraph as a link span", () => {
    const blocks = parseMarkdown("See [the plan](obsidian://open?vault=Bear&file=Plan.md) now.");
    const paragraph = blocks[0] as { content: { kind: string; href?: string }[] };
    const link = paragraph.content.find((span) => span.kind === "link");
    expect(link?.href).toBe("obsidian://open?vault=Bear&file=Plan.md");
  });

  it("leaves unmatched emphasis as text", () => {
    const spans = parseInline("a * b * c and 2 * 3 * 4");
    expect(spans.every((span) => span.kind === "text")).toBe(true);
  });
});

describe("link boundaries shared with the transformer", () => {
  const hrefsIn = (text: string): string[] => {
    const hrefs: string[] = [];
    const walk = (spans: Inline[]): void => {
      for (const span of spans) {
        if (span.kind === "link") hrefs.push(span.href);
        else if (span.kind === "strong" || span.kind === "emphasis" || span.kind === "strike") walk(span.content);
      }
    };
    for (const block of parseMarkdown(text)) {
      if (block.kind === "paragraph" || block.kind === "heading") walk(block.content);
    }
    return hrefs;
  };

  it("trims the same markup from an inline link that the renderer maps by href", () => {
    const url = "https://go.43v.de/open?vault=Bear&file=pi-agent%2Fplans%2Fdocker%2Fhomeassistant%2Fplan-mode-smoke-test.md";
    expect(findObsidianLinks(`**[plan](${url})**`)[0]?.href).toBe(url);
    expect(hrefsIn(`**[plan](${url})**`)).toEqual([url]);
  });

  it("trims a bold marker after a bare link", () => {
    const url = "https://go.43v.de/open?vault=Bear&file=Notes%2FPlan.md";
    expect(hrefsIn(`see ${url}**`)).toEqual([url]);
  });
});
