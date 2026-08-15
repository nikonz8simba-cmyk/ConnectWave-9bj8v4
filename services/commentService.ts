import { supabase } from '@/lib/supabase';
import { AppComment, DbComment, DbUserProfile } from '@/types/database';
import { mapDbProfileToAppUser } from './authService';

// ─── Timestamp helpers ───────────────────────────────────────────────────────

function formatRelative(dateStr: string): string {
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
  return `hace ${Math.floor(diffDays / 7)}sem`;
}

function formatDatetime(dateStr: string): string {
  const date = new Date(dateStr);
  const datePart = date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${datePart}, ${timePart}`;
}

export async function fetchComments(postId: string): Promise<AppComment[]> {
  const { data, error } = await supabase
    .from('post_comments')
    .select('*, user_profiles(*)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  return (data as DbComment[]).map(c => ({
    id: c.id,
    post_id: c.post_id,
    user: mapDbProfileToAppUser(c.user_profiles as DbUserProfile),
    content: c.content,
    created_at: c.created_at,
    timestamp: formatRelative(c.created_at),
    datetime: formatDatetime(c.created_at),
  }));
}

export async function addComment(
  postId: string,
  userId: string,
  content: string
): Promise<{ data: AppComment | null; error: string | null }> {
  const { data, error } = await supabase
    .from('post_comments')
    .insert({ post_id: postId, user_id: userId, content })
    .select('*, user_profiles(*)')
    .single();

  if (error) return { data: null, error: error.message };

  const c = data as DbComment;
  return {
    data: {
      id: c.id,
      post_id: c.post_id,
      user: mapDbProfileToAppUser(c.user_profiles as DbUserProfile),
      content: c.content,
      created_at: c.created_at,
      timestamp: formatRelative(c.created_at),
      datetime: formatDatetime(c.created_at),
    },
    error: null,
  };
}

export async function deleteComment(
  commentId: string,
  userId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('post_comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', userId);

  return { error: error?.message ?? null };
}
