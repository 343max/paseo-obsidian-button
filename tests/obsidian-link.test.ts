import { describe, expect, it } from "vitest";
import { findObsidianLinks } from "../shared/obsidian-link";

const REDIRECT =
  "https://go.43v.de/open?vault=Bear&file=pi-agent%2Fplans%2Fdocker%2Fobsidian-local%2Fobsidian-url-redirect-service.md";
const REDIRECT_FILE = "pi-agent/plans/docker/obsidian-local/obsidian-url-redirect-service.md";

describe("findObsidianLinks", () => {
  it("normalizes a redirect link in prose into a canonical open URI", () => {
    const links = findObsidianLinks(`Have a look at ${REDIRECT} for the details.`);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      href: REDIRECT,
      uri: `obsidian://open?vault=Bear&file=${encodeURIComponent(REDIRECT_FILE)}`,
      vault: "Bear",
      file: REDIRECT_FILE,
      label: "obsidian-url-redirect-service",
      detail: `Bear · ${REDIRECT_FILE}`,
    });
  });

  it("strips the closing bracket prose puts around a link", () => {
    const links = findObsidianLinks(`(see ${REDIRECT})`);
    expect(links[0]?.href).toBe(REDIRECT);
  });

  it("strips a sentence period but keeps the link's own parentheses", () => {
    const links = findObsidianLinks(`Notes: https://go.43v.de/open?vault=Bear&file=Notes%2FPlan(1).md.`);
    expect(links[0]?.file).toBe("Notes/Plan(1).md");
  });

  it("reads a link written as inline Markdown", () => {
    const links = findObsidianLinks(`- [the plan](${REDIRECT})`);
    expect(links[0]?.uri).toBe(`obsidian://open?vault=Bear&file=${encodeURIComponent(REDIRECT_FILE)}`);
  });

  it("keeps a direct obsidian URI as written, including other actions", () => {
    const links = findObsidianLinks("open obsidian://advanced-uri?vault=Bear&file=Plan.md now");
    expect(links[0]).toMatchObject({
      uri: "obsidian://advanced-uri?vault=Bear&file=Plan.md",
      vault: "Bear",
      file: "Plan.md",
      label: "Plan",
    });
  });

  it("accepts a redirect that carries no vault", () => {
    const links = findObsidianLinks("https://go.43v.de/open?file=Notes%2FPlan.md");
    expect(links[0]?.uri).toBe("obsidian://open?file=Notes%2FPlan.md");
  });

  it("lists each link once, in order", () => {
    const links = findObsidianLinks(`${REDIRECT} then obsidian://open?vault=Bear&file=Other.md then ${REDIRECT}`);
    expect(links.map((link) => link.label)).toEqual(["obsidian-url-redirect-service", "Other"]);
  });

  it("ignores links that are not Obsidian links", () => {
    const text = [
      "https://paseo.sh/docs/plugins",
      "https://github.com/getpaseo/paseo/issues/42",
      "https://example.com/open?vault=Bear",
      "obsidian://",
    ].join(" ");
    expect(findObsidianLinks(text)).toEqual([]);
  });
});
