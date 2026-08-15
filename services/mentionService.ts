import { supabase } from '@/lib/supabase';
import { AppUser, DbUserProfile } from '@/types/database';
import { mapDbProfileToAppUser } from './authService';

/**
 * Search users by username prefix for @mention autocomplete.
 * Returns up to 6 results excluding the current user.
 */
export async function searchMentions(
  prefix: string,
  currentUserId: string
): Promise<AppUser[]> {
  const term = prefix.trim().toLowerCase();
  if (!term) return [];

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, username, name, avatar, bio, verified, posts_count, followers_count, following_count, email, created_at, updated_at')
    .ilike('username', `${term}%`)
    .neq('id', currentUserId)
    .order('followers_count', { ascending: false })
    .limit(6);

  if (error || !data) return [];
  return (data as DbUserProfile[]).map(mapDbProfileToAppUser);
}

/**
 * Parses text and returns an array of {username, index} pairs for all @mentions found.
 */
export function parseMentions(text: string): { username: string; start: number; end: number }[] {
  const mentions: { username: string; start: number; end: number }[] = [];
  const regex = /@([a-zA-Z0-9_]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    mentions.push({ username: match[1], start: match.index, end: match.index + match[0].length });
  }
  return mentions;
}
