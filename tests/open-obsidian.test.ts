import { describe, expect, it } from "vitest";
import { chooseOpener } from "../server/open-obsidian";

const host = "43v.de";

describe("chooseOpener", () => {
  it("uses the macOS opener, which always exists", () => {
    const decision = chooseOpener({
      platform: "darwin",
      host,
      hasGraphicalSession: false,
      hasCommand: () => false,
    });
    expect(decision).toMatchObject({ opener: { command: "open" } });
    expect("opener" in decision && decision.opener.args("obsidian://open?vault=Bear")).toEqual([
      "obsidian://open?vault=Bear",
    ]);
  });

  it("uses start on Windows with the empty window title", () => {
    const decision = chooseOpener({
      platform: "win32",
      host,
      hasGraphicalSession: false,
      hasCommand: () => false,
    });
    expect("opener" in decision && decision.opener.args("obsidian://open")).toEqual([
      "/c",
      "start",
      "",
      "obsidian://open",
    ]);
  });

  it("refuses on a Linux host without a desktop session", () => {
    const decision = chooseOpener({
      platform: "linux",
      host,
      hasGraphicalSession: false,
      hasCommand: () => true,
    });
    expect(decision).toEqual({ reason: `${host} has no desktop session, so it cannot open an app.` });
  });

  it("refuses on a desktop Linux host without xdg-open", () => {
    const decision = chooseOpener({
      platform: "linux",
      host,
      hasGraphicalSession: true,
      hasCommand: () => false,
    });
    expect(decision).toEqual({ reason: `${host} has no xdg-open installed, so it cannot open an app.` });
  });

  it("uses xdg-open on a Linux host that has a session and the tool", () => {
    const decision = chooseOpener({
      platform: "linux",
      host,
      hasGraphicalSession: true,
      hasCommand: () => true,
    });
    expect("opener" in decision && decision.opener.args("obsidian://open")).toEqual(["obsidian://open"]);
  });

  it("refuses on an unknown platform", () => {
    const decision = chooseOpener({ platform: "freebsd", host, hasGraphicalSession: true, hasCommand: () => true });
    expect("reason" in decision).toBe(true);
  });
});
