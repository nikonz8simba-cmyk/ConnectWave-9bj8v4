import { supabase } from '@/lib/supabase';
import { AppPost, DbPost, DbUserProfile } from '@/types/database';
import { mapDbProfileToAppUser } from './authService';

// ─── Parsing ──────────────────────────────────────────────────────────────────

/**
 * Parses all #hashtag tokens from a text string.
 */
export function parseHashtags(
  text: string
): { tag: string; start: number; end: number }[] {
  const results: { tag: string; start: number; end: number }[] = [];
  const regex = /#([a-zA-Z0-9_]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    results.push({ tag: match[1], start: match.index, end: match.index + match[0].length });
  }
  return results;
}

// ─── Feed query ───────────────────────────────────────────────────────────────

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffSecs < 60) return 'ahora';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('es', { month: 'short', day: 'numeric' });
}

/**
 * Fetch posts that contain #tag in their content, sorted by recency.
 * Excludes the calling user from results to avoid self-dominated feeds.
 */
export async function fetchPostsByHashtag(
  tag: string,
  currentUserId: string,
  limit = 30
): Promise<AppPost[]> {
  const [postsRes, likesRes] = await Promise.all([
    supabase
      .from('posts')
      .select('*, user_profiles(*)')
      .ilike('content', `%#${tag}%`)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', currentUserId),
  ]);

  if (postsRes.error || !postsRes.data) return [];

  const likedIds = new Set<string>(
    (likesRes.data ?? []).map((l: { post_id: string }) => l.post_id)
  );

  return (postsRes.data as DbPost[]).map(p => {
    const profile = (p.user_profiles as DbUserProfile);
    return {
      id: p.id,
      user: mapDbProfileToAppUser(profile),
      content: p.content,
      image_url: p.image_url ?? null,
      video_url: p.video_url ?? null,
      media_type: p.media_type ?? 'text',
      likes_count: p.likes_count,
      comments_count: p.comments_count,
      shares_count: p.shares_count,
      created_at: p.created_at,
      liked: likedIds.has(p.id),
      timestamp: formatTimestamp(p.created_at),
    };
  });
}
