import { supabase } from '@/lib/supabase';
import { AppPost, DbPost, DbUserProfile } from '@/types/database';
import { mapDbProfileToAppUser } from './authService';

export const FEED_PAGE_SIZE = 15;

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

function mapDbPostToAppPost(post: DbPost, likedPostIds: Set<string>): AppPost {
  const profile = (post.user_profiles as DbUserProfile) ?? (post as any).user_profiles;
  return {
    id: post.id,
    user: mapDbProfileToAppUser(profile),
    content: post.content,
    image_url: post.image_url ?? null,
    video_url: post.video_url ?? null,
    media_type: post.media_type ?? 'text',
    likes_count: post.likes_count,
    comments_count: post.comments_count,
    shares_count: post.shares_count,
    created_at: post.created_at,
    liked: likedPostIds.has(post.id),
    timestamp: formatTimestamp(post.created_at),
    score: (post as any).score,
  };
}

// ─────────────────────────────────────────────
// Discovery feed with pagination (uses get_discovery_feed RPC)
// ─────────────────────────────────────────────
export async function fetchDiscoveryFeed(
  currentUserId: string,
  offset: number = 0
): Promise<{ posts: AppPost[]; hasMore: boolean }> {
  const [rpcRes, likesRes] = await Promise.all([
    supabase.rpc('get_discovery_feed', {
      p_user_id: currentUserId,
      p_limit: FEED_PAGE_SIZE + 1, // fetch one extra to detect hasMore
      p_offset: offset,
    }),
    supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', currentUserId),
  ]);

  if (rpcRes.error) {
    console.error('fetchDiscoveryFeed error:', rpcRes.error.message);
    return { posts: [], hasMore: false };
  }

  const likedIds = new Set<string>(
    (likesRes.data ?? []).map((l: { post_id: string }) => l.post_id)
  );

  const raw = (rpcRes.data ?? []) as Array<DbPost & { user_profiles: DbUserProfile; score: number }>;
  const hasMore = raw.length > FEED_PAGE_SIZE;
  const slice = hasMore ? raw.slice(0, FEED_PAGE_SIZE) : raw;

  const posts = slice.map(p => {
    // RPC returns user_profiles as json object
    const dbPost: DbPost = {
      ...p,
      user_profiles: typeof p.user_profiles === 'string'
        ? JSON.parse(p.user_profiles)
        : p.user_profiles,
    };
    return mapDbPostToAppPost(dbPost, likedIds);
  });

  return { posts, hasMore };
}

// ─────────────────────────────────────────────
// Fallback: simple chronological feed
// ─────────────────────────────────────────────
export async function fetchFeedPosts(currentUserId: string): Promise<AppPost[]> {
  const { posts } = await fetchDiscoveryFeed(currentUserId, 0);
  return posts;
}

// ─────────────────────────────────────────────
// Toggle like
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// Fetch posts by a specific user (for profile grid)
// ─────────────────────────────────────────────
export async function fetchUserPosts(
  targetUserId: string,
  currentUserId: string
): Promise<AppPost[]> {
  const [postsRes, likesRes] = await Promise.all([
    supabase
      .from('posts')
      .select('*, user_profiles(*)')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false }),
    supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', currentUserId),
  ]);

  if (postsRes.error || !postsRes.data) return [];

  const likedIds = new Set<string>(
    (likesRes.data ?? []).map((l: { post_id: string }) => l.post_id)
  );

  return (postsRes.data as DbPost[]).map(p => mapDbPostToAppPost(p, likedIds));
}

// ─────────────────────────────────────────────
// Create post
// ─────────────────────────────────────────────
export async function createPost(
  userId: string,
  content: string,
  imageUrl?: string,
  videoUrl?: string
): Promise<{ data: AppPost | null; error: string | null }> {
  const mediaType = videoUrl ? 'video' : imageUrl ? 'image' : 'text';
  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: userId,
      content,
      image_url: imageUrl ?? null,
      video_url: videoUrl ?? null,
      media_type: mediaType,
    })
    .select('*, user_profiles(*)')
    .single();

  if (error) return { data: null, error: error.message };
  return { data: mapDbPostToAppPost(data as DbPost, new Set()), error: null };
}
