import { supabase } from '@/lib/supabase';
import { mapDbProfileToAppUser } from './authService';
import { AppUser, DbUserProfile } from '@/types/database';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType = 'like' | 'comment' | 'mention';

export interface AppNotification {
  id: string;
  type: NotificationType;
  actor: AppUser;
  postId: string;
  postPreview: string;
  createdAt: string;
  timestamp: string;
  read: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffSecs < 60) return 'ahora';
  if (diffMins < 60) return `hace ${diffMins}m`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  if (diffDays < 7) return `hace ${diffDays}d`;
  const datePart = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  const timePart = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${datePart}, ${timePart}`;
}

// ─── Fetch notifications ──────────────────────────────────────────────────────
// Combines recent likes and comments on the current user's posts to build a
// notification feed. No dedicated notifications table needed — derived from
// post_likes and post_comments joined to the posts owner.

export async function fetchNotifications(
  currentUserId: string,
  limit = 40
): Promise<AppNotification[]> {
  // 1. Fetch user's own posts (we only care about activity on our posts)
  const { data: myPosts, error: postsError } = await supabase
    .from('posts')
    .select('id, content')
    .eq('user_id', currentUserId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (postsError || !myPosts || myPosts.length === 0) return [];

  const postIds = myPosts.map((p: { id: string; content: string }) => p.id);
  const postMap = new Map<string, string>(
    myPosts.map((p: { id: string; content: string }) => [p.id, p.content])
  );

  // 2. Fetch recent likes on those posts by others
  const [likesRes, commentsRes] = await Promise.all([
    supabase
      .from('post_likes')
      .select('id, post_id, user_id, created_at, user_profiles(*)')
      .in('post_id', postIds)
      .neq('user_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('post_comments')
      .select('id, post_id, user_id, content, created_at, user_profiles(*)')
      .in('post_id', postIds)
      .neq('user_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  const notifications: AppNotification[] = [];

  // Process likes
  for (const like of (likesRes.data ?? []) as any[]) {
    const profile = like.user_profiles as DbUserProfile;
    if (!profile) continue;
    notifications.push({
      id: `like_${like.id}`,
      type: 'like',
      actor: mapDbProfileToAppUser(profile),
      postId: like.post_id,
      postPreview: postMap.get(like.post_id) ?? '',
      createdAt: like.created_at,
      timestamp: formatTimestamp(like.created_at),
      read: false,
    });
  }

  // Process comments
  for (const comment of (commentsRes.data ?? []) as any[]) {
    const profile = comment.user_profiles as DbUserProfile;
    if (!profile) continue;

    // Check if it's a mention notification
    const isMention = comment.content?.includes(`@`) && false; // future feature
    notifications.push({
      id: `comment_${comment.id}`,
      type: 'comment',
      actor: mapDbProfileToAppUser(profile),
      postId: comment.post_id,
      postPreview: postMap.get(comment.post_id) ?? '',
      createdAt: comment.created_at,
      timestamp: formatTimestamp(comment.created_at),
      read: false,
    });
  }

  // Sort all by createdAt descending
  return notifications.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
