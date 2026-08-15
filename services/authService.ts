import { supabase } from '@/lib/supabase';
import { AppUser, DbUserProfile } from '@/types/database';

export function mapDbProfileToAppUser(profile: DbUserProfile): AppUser {
  return {
    id: profile.id,
    username: profile.username,
    email: profile.email,
    name: profile.name,
    avatar: profile.avatar,
    bio: profile.bio,
    verified: profile.verified,
    posts_count: profile.posts_count,
    followers_count: profile.followers_count,
    following_count: profile.following_count,
  };
}

export async function signUp(
  email: string,
  password: string,
  username: string,
  name: string
): Promise<{ data: any; error: string | null }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        name,
        avatar: `https://i.pravatar.cc/150?u=${email}`,
        bio: '',
      },
    },
  });
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function signIn(
  email: string,
  password: string
): Promise<{ data: any; error: string | null }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function fetchUserProfile(userId: string): Promise<AppUser | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return mapDbProfileToAppUser(data as DbUserProfile);
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<Pick<DbUserProfile, 'name' | 'bio' | 'avatar' | 'username'>>
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) return { error: error.message };
  return { error: null };
}
