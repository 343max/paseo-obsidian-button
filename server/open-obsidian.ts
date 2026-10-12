import { spawn } from "node:child_process";
import type { RpcInput } from "@getpaseo/plugin";
import { isObsidianUri, openObsidianRpc } from "../shared/open-obsidian";

const TIMEOUT_MS = 10_000;

interface UrlOpener {
  command: string;
  args(uri: string): string[];
}

/** The OS handler launches whichever app registered the `obsidian://` scheme. */
function openerForPlatform(platform: NodeJS.Platform): UrlOpener | null {
  switch (platform) {
    case "darwin":
      return { command: "open", args: (uri) => [uri] };
    case "win32":
      // `start` reads its first argument as the window title, hence the empty one.
      return { command: "cmd", args: (uri) => ["/c", "start", "", uri] };
    case "linux":
      return { command: "xdg-open", args: (uri) => [uri] };
    default:
      return null;
  }
}

/** The argument is passed as a single argv entry, never through a shell. */
function run(opener: UrlOpener, uri: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(opener.command, opener.args(uri), { stdio: "ignore" });
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
  const opener = openerForPlatform(process.platform);
  if (!opener) {
    return { opened: false, detail: `No URL opener is known for ${process.platform}.` };
  }
  try {
    await run(opener, uri);
    return { opened: true };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`paseo-obsidian-button: ${opener.command} failed for ${uri}: ${detail}`);
    return { opened: false, detail };
  }
}
