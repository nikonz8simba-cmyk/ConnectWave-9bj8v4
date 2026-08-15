import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { AppPost, AppConversation } from '@/types/database';
import {
  fetchFeedPosts,
  togglePostLike,
  createPost as createPostService,
} from '@/services/postService';
import { fetchConversations } from '@/services/chatService';

interface AppContextType {
  posts: AppPost[];
  conversations: AppConversation[];
  loadingPosts: boolean;
  loadingChats: boolean;
  totalUnread: number;
  refreshPosts: () => Promise<void>;
  refreshConversations: () => Promise<void>;
  toggleLike: (postId: string) => Promise<void>;
  addPost: (content: string, imageUrl?: string) => Promise<{ error: string | null }>;
  updateConversationOptimistic: (conversationId: string, updates: Partial<AppConversation>) => void;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuthContext();
  const [posts, setPosts] = useState<AppPost[]>([]);
  const [conversations, setConversations] = useState<AppConversation[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingChats, setLoadingChats] = useState(false);

  const refreshPosts = useCallback(async () => {
    if (!user) return;
    setLoadingPosts(true);
    const data = await fetchFeedPosts(user.id);
    setPosts(data);
    setLoadingPosts(false);
  }, [user]);

  const refreshConversations = useCallback(async () => {
    if (!user) return;
    setLoadingChats(true);
    const data = await fetchConversations(user.id);
    setConversations(data);
    setLoadingChats(false);
  }, [user]);

  useEffect(() => {
    if (user?.id) {
      refreshPosts();
      refreshConversations();
    } else {
      setPosts([]);
      setConversations([]);
    }
  }, [user?.id]);

  const toggleLike = useCallback(
    async (postId: string) => {
      if (!user) return;
      const post = posts.find(p => p.id === postId);
      if (!post) return;

      // Optimistic update
      setPosts(prev =>
        prev.map(p => {
          if (p.id !== postId) return p;
          return {
            ...p,
            liked: !p.liked,
            likes_count: p.liked ? p.likes_count - 1 : p.likes_count + 1,
          };
        })
      );

      const { error } = await togglePostLike(postId, user.id, post.liked);
      if (error) {
        // Revert on error
        setPosts(prev =>
          prev.map(p => {
            if (p.id !== postId) return p;
            return { ...p, liked: post.liked, likes_count: post.likes_count };
          })
        );
      }
    },
    [user, posts]
  );

  const addPost = useCallback(
    async (content: string, imageUrl?: string): Promise<{ error: string | null }> => {
      if (!user) return { error: 'Not authenticated' };
      const { data, error } = await createPostService(user.id, content, imageUrl);
      if (error) return { error };
      if (data) setPosts(prev => [data, ...prev]);
      return { error: null };
    },
    [user]
  );

  const updateConversationOptimistic = useCallback(
    (conversationId: string, updates: Partial<AppConversation>) => {
      setConversations(prev =>
        prev.map(c => (c.id === conversationId ? { ...c, ...updates } : c))
      );
    },
    []
  );

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0);

  return (
    <AppContext.Provider
      value={{
        posts,
        conversations,
        loadingPosts,
        loadingChats,
        totalUnread,
        refreshPosts,
        refreshConversations,
        toggleLike,
        addPost,
        updateConversationOptimistic,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
