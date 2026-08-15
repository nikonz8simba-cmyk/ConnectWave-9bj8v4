import React, { useCallback } from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { parseMentions } from '@/services/mentionService';
import { parseHashtags } from '@/services/hashtagService';
import { Colors, FontWeight } from '@/constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MentionTextProps {
  /** Raw text that may contain @username and/or #hashtag tokens */
  text: string;
  /** Optional map of username → userId for direct profile navigation */
  mentionUserMap?: Record<string, string>;
  /** Base text style */
  style?: TextStyle | TextStyle[];
  /** Number of lines to clamp */
  numberOfLines?: number;
}

// ─── Token types ──────────────────────────────────────────────────────────────

type Token =
  | { kind: 'plain'; text: string }
  | { kind: 'mention'; username: string }
  | { kind: 'hashtag'; tag: string };

/**
 * Merge @mention and #hashtag spans into a sorted token list,
 * filling gaps with plain-text tokens.
 */
function tokenize(text: string): Token[] {
  type Span =
    | { kind: 'mention'; username: string; start: number; end: number }
    | { kind: 'hashtag'; tag: string; start: number; end: number };

  const spans: Span[] = [
    ...parseMentions(text).map(m => ({
      kind: 'mention' as const,
      username: m.username,
      start: m.start,
      end: m.end,
    })),
    ...parseHashtags(text).map(h => ({
      kind: 'hashtag' as const,
      tag: h.tag,
      start: h.start,
      end: h.end,
    })),
  ].sort((a, b) => a.start - b.start);

  const tokens: Token[] = [];
  let cursor = 0;

  for (const span of spans) {
    if (span.start > cursor) {
      tokens.push({ kind: 'plain', text: text.slice(cursor, span.start) });
    }
    if (span.kind === 'mention') {
      tokens.push({ kind: 'mention', username: span.username });
    } else {
      tokens.push({ kind: 'hashtag', tag: span.tag });
    }
    cursor = span.end;
  }

  if (cursor < text.length) {
    tokens.push({ kind: 'plain', text: text.slice(cursor) });
  }

  return tokens;
}

// ─── MentionText ──────────────────────────────────────────────────────────────

/**
 * Renders text with tappable, highlighted @mention and #hashtag tokens.
 * - @mention → navigates to /profile/[id] (or /search as fallback)
 * - #hashtag  → navigates to /hashtag/[tag]
 */
export function MentionText({
  text,
  mentionUserMap,
  style,
  numberOfLines,
}: MentionTextProps) {
  const router = useRouter();

  const handleMentionPress = useCallback(
    (username: string) => {
      const userId = mentionUserMap?.[username];
      if (userId) {
        router.push(`/profile/${userId}` as any);
      } else {
        router.push('/search' as any);
      }
    },
    [mentionUserMap, router]
  );

  const handleHashtagPress = useCallback(
    (tag: string) => {
      router.push(`/hashtag/${tag}` as any);
    },
    [router]
  );

  const tokens = tokenize(text);

  // Fast path: no special tokens
  if (tokens.length === 1 && tokens[0].kind === 'plain') {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {tokens.map((token, i) => {
        if (token.kind === 'plain') {
          return <Text key={i}>{token.text}</Text>;
        }
        if (token.kind === 'mention') {
          return (
            <Text
              key={i}
              style={tokenStyles.mention}
              onPress={() => handleMentionPress(token.username)}
              suppressHighlighting
            >
              @{token.username}
            </Text>
          );
        }
        // hashtag
        return (
          <Text
            key={i}
            style={tokenStyles.hashtag}
            onPress={() => handleHashtagPress(token.tag)}
            suppressHighlighting
          >
            #{token.tag}
          </Text>
        );
      })}
    </Text>
  );
}

const tokenStyles = StyleSheet.create({
  mention: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  hashtag: {
    color: Colors.secondary,
    fontWeight: FontWeight.semibold,
  },
});
