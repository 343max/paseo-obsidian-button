import type { PluginClientContext } from "@getpaseo/plugin/client";
import { MessageItem } from "./client/message";
import { setPluginClient } from "./client/plugin-client";
import { MESSAGE_KIND, MESSAGE_VERSION, messageSchema, transformMessage } from "./shared/message";

/**
 * Draws an Open in Obsidian button under any message that links to a note.
 *
 * Both directions are covered: a link the agent wrote, and one the user pasted.
 * The transformer runs while the message streams, so the button is there as soon
 * as the link is.
 *
 * The daemon half of the plugin owns the actual opening, because the app's
 * external opener accepts HTTP(S) only and cannot launch `obsidian://`.
 */
export default function contribute(client: PluginClientContext) {
  setPluginClient(client);

  // Registered one by one rather than in a loop: the contribution is generic in
  // the item type, and a loop widens it to a union that no longer infers `item`.
  client.addTimelineTransformer({
    id: "obsidian-assistant-message",
    query: { itemType: "assistant_message" },
    transform: ({ item }) => transformMessage(item.text),
  });
  client.addTimelineTransformer({
    id: "obsidian-user-message",
    query: { itemType: "user_message" },
    transform: ({ item }) => transformMessage(item.text),
  });

  client.addTimelineRenderer({
    kind: MESSAGE_KIND,
    version: MESSAGE_VERSION,
    schema: messageSchema,
    Component: MessageItem,
  });

  return () => {
    setPluginClient(null);
  };
}
