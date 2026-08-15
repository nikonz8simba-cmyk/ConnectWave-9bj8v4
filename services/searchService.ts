import { supabase } from '@/lib/supabase';
import { AppUser, AppPost, DbUserProfile, DbPost } from '@/types/database';
import { mapDbProfileToAppUser } from './authService';
import { fetchUserPosts } from './postService';

export async function searchUsers(
  query: string,
  currentUserId: string
): Promise<AppUser[]> {
  if (!query.trim()) return [];

  const term = query.trim().toLowerCase();

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .or(`name.ilike.%${term}%,username.ilike.%${term}%`)
    .neq('id', currentUserId)
    .limit(30);

  if (error || !data) return [];

  return (data as DbUserProfile[]).map(mapDbProfileToAppUser);
}

export async function fetchPublicProfile(
  userId: string
): Promise<AppUser | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return mapDbProfileToAppUser(data as DbUserProfile);
}

export { fetchUserPosts };
