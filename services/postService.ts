import { supabase } from '@/lib/supabase';
import { AppPost, DbPost, DbUserProfile } from '@/types/database';
import { mapDbProfileToAppUser } from './authService';

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function mapDbPostToAppPost(post: DbPost, likedPostIds: Set<string>): AppPost {
  const profile = post.user_profiles as DbUserProfile;
  return {
    id: post.id,
    user: mapDbProfileToAppUser(profile),
    content: post.content,
    image_url: post.image_url,
    likes_count: post.likes_count,
    comments_count: post.comments_count,
    shares_count: post.shares_count,
    created_at: post.created_at,
    liked: likedPostIds.has(post.id),
    timestamp: formatTimestamp(post.created_at),
  };
}

export async function fetchFeedPosts(currentUserId: string): Promise<AppPost[]> {
  const [postsRes, likesRes] = await Promise.all([
    supabase
      .from('posts')
      .select('*, user_profiles(*)')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', currentUserId),
  ]);

  if (postsRes.error) {
    console.error('fetchFeedPosts error:', postsRes.error.message);
    return [];
  }

  const likedIds = new Set<string>(
    (likesRes.data ?? []).map((l: { post_id: string }) => l.post_id)
  );

  return (postsRes.data as DbPost[]).map(p => mapDbPostToAppPost(p, likedIds));
}

export async function togglePostLike(
  postId: string,
  userId: string,
  currentlyLiked: boolean
): Promise<{ error: string | null }> {
  if (currentlyLiked) {
    const { error } = await supabase
      .from('post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);
    if (error) return { error: error.message };

    await supabase
      .from('posts')
      .update({ likes_count: supabase.rpc as any })
      .eq('id', postId);

    // Decrement via raw update
    const { data: post } = await supabase
      .from('posts')
      .select('likes_count')
      .eq('id', postId)
      .single();
    if (post) {
      await supabase
        .from('posts')
        .update({ likes_count: Math.max(0, (post as any).likes_count - 1) })
        .eq('id', postId);
    }
  } else {
    const { error } = await supabase
      .from('post_likes')
      .insert({ post_id: postId, user_id: userId });
    if (error) return { error: error.message };

    const { data: post } = await supabase
      .from('posts')
      .select('likes_count')
      .eq('id', postId)
      .single();
    if (post) {
      await supabase
        .from('posts')
        .update({ likes_count: (post as any).likes_count + 1 })
        .eq('id', postId);
    }
  }
  return { error: null };
}

export async function createPost(
  userId: string,
  content: string,
  imageUrl?: string
): Promise<{ data: AppPost | null; error: string | null }> {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: userId,
      content,
      image_url: imageUrl ?? null,
    })
    .select('*, user_profiles(*)')
    .single();

  if (error) return { data: null, error: error.message };
  return { data: mapDbPostToAppPost(data as DbPost, new Set()), error: null };
}
