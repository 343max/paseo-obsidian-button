import type { PluginTheme } from "@getpaseo/plugin";
import type { PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { openExternalUrl } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MessageData } from "../shared/message";
import type { ObsidianLink } from "../shared/obsidian-link";
import { Markdown } from "./markdown";
import { openObsidianLink, type OpenOutcome } from "./open-obsidian";

/**
 * A message that mentions an Obsidian link, drawn with a button per link.
 *
 * The transformer only sends messages here that carry such a link, so the
 * Markdown above the buttons is this plugin's rendering of the same text.
 */
export function MessageItem({ item, theme, layout, host }: PluginTimelineItemProps<MessageData>) {
  const { text, links } = item.data;
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const byHref = useMemo(() => new Map(links.map((link) => [link.href, link])), [links]);

  const open = useCallback(
    async (link: ObsidianLink) => {
      setPendingUri(link.uri);
      setProblem(null);
      setNote(null);
      try {
        const outcome = await openObsidianLink(link);
        if (outcome.ok) setNote(describeOutcome(outcome, host.label));
        else setProblem(outcome.detail ?? "Obsidian could not be opened.");
      } catch (error) {
        setProblem(error instanceof Error ? error.message : String(error));
      } finally {
        setPendingUri(null);
      }
    },
    [host.label],
  );

  const onOpenLink = useCallback(
    (href: string) => {
      const link = byHref.get(href);
      if (link) {
        void open(link);
        return;
      }
      // Everything else keeps behaving like a normal link in the transcript.
      void openExternalUrl(href).catch((error: unknown) => {
        setProblem(error instanceof Error ? error.message : String(error));
      });
    },
    [byHref, open],
  );

  return (
    <View style={{ gap: layout.compact ? 8 : 10 }}>
      <Markdown text={text} theme={theme} compact={layout.compact} onOpenLink={onOpenLink} />
      {links.map((link) => (
        <ObsidianButton
          key={link.uri}
          link={link}
          theme={theme}
          compact={layout.compact}
          pending={pendingUri === link.uri}
          onPress={() => void open(link)}
        />
      ))}
      {note !== null && <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12.5 }}>{note}</Text>}
      {problem !== null && <Text style={{ color: theme.colors.statusDanger, fontSize: 12.5 }}>{problem}</Text>}
    </View>
  );
}

/**
 * Where the click ended up. A daemon that cannot open apps used to answer
 * "opened" and leave the row silent, which reads exactly like a broken button.
 */
function describeOutcome(outcome: OpenOutcome, hostLabel: string): string | null {
  if (outcome.via === "daemon") return `Opened on ${hostLabel}.`;
  if (outcome.via === "device") return "Opened on this device.";
  if (outcome.via === "browser") {
    return outcome.detail
      ? `Opened in your browser instead. ${outcome.detail}`
      : "Opened in your browser instead.";
  }
  return null;
}

interface ButtonProps {
  link: ObsidianLink;
  theme: PluginTheme;
  compact: boolean;
  pending: boolean;
  onPress(): void;
}

function ObsidianButton({ link, theme, compact, pending, onPress }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${link.label} in Obsidian`}
      accessibilityHint="Opens the note in the Obsidian app"
      disabled={pending}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: compact ? 8 : 10,
        paddingHorizontal: compact ? 10 : 12,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface1,
        opacity: pending ? 0.6 : 1,
      }}
    >
      <Icon name="FileText" size={16} color={theme.colors.accent} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text numberOfLines={1} style={{ color: theme.colors.foreground, fontSize: 13.5, fontWeight: "600" }}>
          {link.label}
        </Text>
        <Text numberOfLines={1} style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>
          {pending ? "Opening Obsidian…" : link.detail}
        </Text>
      </View>
      <Icon name="ExternalLink" size={14} color={theme.colors.foregroundMuted} />
    </Pressable>
  );
}
