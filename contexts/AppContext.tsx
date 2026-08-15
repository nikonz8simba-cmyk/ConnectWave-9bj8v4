import React, { createContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { AppPost, AppConversation, DbPost, DbUserProfile } from '@/types/database';
import {
  fetchDiscoveryFeed,
  togglePostLike,
  createPost as createPostService,
} from '@/services/postService';
import { fetchConversations } from '@/services/chatService';
import { supabase } from '@/lib/supabase';
import { mapDbProfileToAppUser } from '@/services/authService';

interface AppContextType {
  posts: AppPost[];
  conversations: AppConversation[];
  loadingPosts: boolean;
  loadingMorePosts: boolean;
  hasMorePosts: boolean;
  loadingChats: boolean;
  totalUnread: number;
  refreshPosts: () => Promise<void>;
  loadMorePosts: () => Promise<void>;
  refreshConversations: () => Promise<void>;
  toggleLike: (postId: string) => Promise<void>;
  addPost: (content: string, imageUrl?: string, videoUrl?: string) => Promise<{ error: string | null }>;
  updateConversationOptimistic: (conversationId: string, updates: Partial<AppConversation>) => void;
  markConversationRead: (conversationId: string) => void;
  removePost: (postId: string) => void;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const [posts, setPosts] = useState<AppPost[]>([]);
  const [conversations, setConversations] = useState<AppConversation[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [feedOffset, setFeedOffset] = useState(0);
  const [loadingChats, setLoadingChats] = useState(false);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const postsChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Feed ───────────────────────────────────────────────────────────────

  const refreshPosts = useCallback(async () => {
    if (!user) return;
    setLoadingPosts(true);
    const { posts: data, hasMore } = await fetchDiscoveryFeed(user.id, 0);
    setPosts(data);
    setHasMorePosts(hasMore);
    setFeedOffset(data.length);
    setLoadingPosts(false);
  }, [user]);

  const loadMorePosts = useCallback(async () => {
    if (!user || loadingMorePosts || !hasMorePosts) return;
    setLoadingMorePosts(true);
    const { posts: more, hasMore } = await fetchDiscoveryFeed(user.id, feedOffset);
    if (more.length > 0) {
      setPosts(prev => {
        const ids = new Set(prev.map(p => p.id));
        return [...prev, ...more.filter(p => !ids.has(p.id))];
      });
      setFeedOffset(prev => prev + more.length);
    }
    setHasMorePosts(hasMore);
    setLoadingMorePosts(false);
  }, [user, feedOffset, loadingMorePosts, hasMorePosts]);

  // ── Conversations ──────────────────────────────────────────────────────

  const refreshConversations = useCallback(async () => {
    if (!user) return;
    setLoadingChats(true);
    const data = await fetchConversations(user.id);
    setConversations(data);
    setLoadingChats(false);
  }, [user]);

  // ── Real-time: new posts INSERT → prepend to feed ──────────────────────

  useEffect(() => {
    if (!user?.id) return;

    if (postsChannelRef.current) {
      supabase.removeChannel(postsChannelRef.current);
    }

    const channel = supabase
      .channel(`feed_posts_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts',
        },
        async (payload) => {
          const newRow = payload.new as DbPost & { user_id: string };

          // Skip own posts (already added optimistically via addPost)
          if (newRow.user_id === user.id) return;

          // Fetch the full post with user profile attached
          const { data } = await supabase
            .from('posts')
            .select('*, user_profiles(*)')
            .eq('id', newRow.id)
            .single();

          if (!data) return;

          // Check if current user has liked this post
          const { data: likeRow } = await supabase
            .from('post_likes')
            .select('post_id')
            .eq('post_id', newRow.id)
            .eq('user_id', user.id)
            .maybeSingle();

          const liked = likeRow != null;
          const profile = data.user_profiles as DbUserProfile;

          const now = new Date();
          const datePart = now.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
          const timePart = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });

          const appPost: AppPost = {
            id: data.id,
            user: mapDbProfileToAppUser(profile),
            content: data.content,
            image_url: data.image_url ?? null,
            video_url: data.video_url ?? null,
            media_type: data.media_type ?? 'text',
            likes_count: data.likes_count,
            comments_count: data.comments_count,
            shares_count: data.shares_count,
            created_at: data.created_at,
            liked,
            timestamp: 'ahora',
            datetime: `${datePart}, ${timePart}`,
          };

          setPosts(prev => {
            // Avoid duplicates
            if (prev.some(p => p.id === appPost.id)) return prev;
            return [appPost, ...prev];
          });
          setFeedOffset(prev => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'posts',
        },
        (payload) => {
          const updated = payload.new as DbPost;
          setPosts(prev =>
            prev.map(p =>
              p.id === updated.id
                ? {
                    ...p,
                    likes_count: updated.likes_count,
                    comments_count: updated.comments_count,
                    shares_count: updated.shares_count,
                  }
                : p
            )
          );
        }
      )
      .subscribe();

    postsChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      postsChannelRef.current = null;
    };
  }, [user?.id]);

  // ── Real-time: messages → refresh conversation list ────────────────────

  useEffect(() => {
    if (!user?.id) return;

    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }

    const channel = supabase
      .channel(`app_messages_${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => { refreshConversations(); }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        () => { refreshConversations(); }
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      realtimeChannelRef.current = null;
    };
  }, [user?.id, refreshConversations]);

  // ── Bootstrap ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (user?.id) {
      refreshPosts();
      refreshConversations();
    } else {
      setPosts([]);
      setConversations([]);
    }
  }, [user?.id]);

  // ── Actions ────────────────────────────────────────────────────────────

  const toggleLike = useCallback(
    async (postId: string) => {
      if (!user) return;
      const post = posts.find(p => p.id === postId);
      if (!post) return;

      // Optimistic update
      setPosts(prev =>
        prev.map(p =>
          p.id !== postId
            ? p
            : { ...p, liked: !p.liked, likes_count: p.liked ? p.likes_count - 1 : p.likes_count + 1 }
        )
      );

      const { error } = await togglePostLike(postId, user.id, post.liked);
      if (error) {
        // Revert on error
        setPosts(prev =>
          prev.map(p => (p.id !== postId ? p : { ...p, liked: post.liked, likes_count: post.likes_count }))
        );
      }
    },
    [user, posts]
  );

  const addPost = useCallback(
    async (content: string, imageUrl?: string, videoUrl?: string): Promise<{ error: string | null }> => {
      if (!user) return { error: 'Not authenticated' };
      const { data, error } = await createPostService(user.id, content, imageUrl, videoUrl);
      if (error) return { error };
      if (data) {
        setPosts(prev => [data, ...prev]);
        setFeedOffset(prev => prev + 1);
      }
      return { error: null };
    },
    [user]
  );

  const removePost = useCallback((postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
    setFeedOffset(prev => Math.max(0, prev - 1));
  }, []);

  const updateConversationOptimistic = useCallback(
    (conversationId: string, updates: Partial<AppConversation>) => {
      setConversations(prev =>
        prev.map(c => (c.id === conversationId ? { ...c, ...updates } : c))
      );
    },
    []
  );

  const markConversationRead = useCallback((conversationId: string) => {
    setConversations(prev =>
      prev.map(c => (c.id === conversationId ? { ...c, unread: 0 } : c))
    );
  }, []);

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0);

  return (
    <AppContext.Provider
      value={{
        posts,
        conversations,
        loadingPosts,
        loadingMorePosts,
        hasMorePosts,
        loadingChats,
        totalUnread,
        refreshPosts,
        loadMorePosts,
        refreshConversations,
        toggleLike,
        addPost,
        updateConversationOptimistic,
        markConversationRead,
        removePost,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
