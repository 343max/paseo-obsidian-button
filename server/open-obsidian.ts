import { spawn } from "node:child_process";
import { accessSync, constants, readdirSync } from "node:fs";
import { hostname } from "node:os";
import { delimiter, join } from "node:path";
import type { RpcInput } from "@getpaseo/plugin";
import { isObsidianUri, openObsidianRpc } from "../shared/open-obsidian";

const TIMEOUT_MS = 10_000;

interface UrlOpener {
  readonly command: string;
  readonly args: (uri: string) => readonly string[];
}

function hasGraphicalSession(env: NodeJS.ProcessEnv): boolean {
  if (env.DISPLAY || env.WAYLAND_DISPLAY) return true;
  // A daemon can be started without those variables while an X server is up.
  try {
    return readdirSync("/tmp/.X11-unix").length > 0;
  } catch {
    return false;
  }
}

function hasCommandInPath(command: string, env: NodeJS.ProcessEnv): boolean {
  return (env.PATH ?? "").split(delimiter).some((directory) => {
    if (!directory) return false;
    try {
      accessSync(join(directory, command), constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}

/**
 * Decides whether this host can hand a URI to an app, before anything runs.
 *
 * The check matters most on Linux: `xdg-open` without a desktop session does not
 * fail. It falls back to a text browser, takes seconds, and exits 0 with nothing
 * opened, so a caller that only watches the exit code reports success and never
 * falls back. Answering "no" here turns that into an immediate, explainable
 * refusal instead.
 */
export function chooseOpener(input: {
  platform: string;
  host: string;
  hasGraphicalSession: boolean;
  hasCommand: (command: string) => boolean;
}): { opener: UrlOpener } | { reason: string } {
  switch (input.platform) {
    case "darwin":
      return { opener: { command: "open", args: (uri) => [uri] } };
    case "win32":
      // `start` reads its first argument as the window title, hence the empty one.
      return { opener: { command: "cmd", args: (uri) => ["/c", "start", "", uri] } };
    case "linux":
      if (!input.hasGraphicalSession) {
        return { reason: `${input.host} has no desktop session, so it cannot open an app.` };
      }
      if (!input.hasCommand("xdg-open")) {
        return { reason: `${input.host} has no xdg-open installed, so it cannot open an app.` };
      }
      return { opener: { command: "xdg-open", args: (uri) => [uri] } };
    default:
      return { reason: `No URL opener is known for ${input.platform}.` };
  }
}

/** The argument is passed as a single argv entry, never through a shell. */
function run(opener: UrlOpener, uri: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(opener.command, [...opener.args(uri)], { stdio: "ignore" });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${opener.command} did not finish within ${TIMEOUT_MS}ms`));
    }, TIMEOUT_MS);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`${opener.command} exited with ${signal ?? `code ${code}`}`));
    });
  });
}

export async function openInObsidian({ uri }: RpcInput<typeof openObsidianRpc>) {
  if (!isObsidianUri(uri)) {
    return { opened: false, detail: "That is not an obsidian:// URI." };
  }
  const decision = chooseOpener({
    platform: process.platform,
    host: hostname(),
    hasGraphicalSession: hasGraphicalSession(process.env),
    hasCommand: (command) => hasCommandInPath(command, process.env),
  });
  if ("reason" in decision) {
    console.log(`paseo-obsidian-button: not opening ${uri}: ${decision.reason}`);
    return { opened: false, detail: decision.reason };
  }
  try {
    await run(decision.opener, uri);
    return { opened: true };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`paseo-obsidian-button: ${decision.opener.command} failed for ${uri}: ${detail}`);
    return { opened: false, detail };
  }
}
