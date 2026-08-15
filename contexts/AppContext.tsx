import React, { createContext, useState, ReactNode } from 'react';
import {
  MOCK_POSTS,
  MOCK_CONVERSATIONS,
  Post,
  Conversation,
  Message,
  CURRENT_USER,
  User,
} from '@/constants/mockData';

interface AppContextType {
  posts: Post[];
  conversations: Conversation[];
  currentUser: User;
  toggleLike: (postId: string) => void;
  sendMessage: (conversationId: string, text: string) => void;
  markConversationRead: (conversationId: string) => void;
  addPost: (content: string, image?: string) => void;
  totalUnread: number;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [posts, setPosts] = useState<Post[]>(MOCK_POSTS);
  const [conversations, setConversations] = useState<Conversation[]>(MOCK_CONVERSATIONS);
  const currentUser = CURRENT_USER;

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0);

  const toggleLike = (postId: string) => {
    setPosts(prev =>
      prev.map(p => {
        if (p.id !== postId) return p;
        return {
          ...p,
          liked: !p.liked,
          likes: p.liked ? p.likes - 1 : p.likes + 1,
        };
      })
    );
  };

  const sendMessage = (conversationId: string, text: string) => {
    const newMessage: Message = {
      id: `m_${Date.now()}`,
      senderId: 'me',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: true,
    };
    setConversations(prev =>
      prev.map(c => {
        if (c.id !== conversationId) return c;
        return {
          ...c,
          messages: [...c.messages, newMessage],
          lastMessage: text,
          lastTime: 'now',
          unread: 0,
        };
      })
    );
  };

  const markConversationRead = (conversationId: string) => {
    setConversations(prev =>
      prev.map(c => {
        if (c.id !== conversationId) return c;
        return {
          ...c,
          unread: 0,
          messages: c.messages.map(m => ({ ...m, read: true })),
        };
      })
    );
  };

  const addPost = (content: string, image?: string) => {
    const newPost: Post = {
      id: `p_${Date.now()}`,
      user: currentUser,
      content,
      image,
      likes: 0,
      comments: 0,
      shares: 0,
      timestamp: 'just now',
      liked: false,
    };
    setPosts(prev => [newPost, ...prev]);
  };

  return (
    <AppContext.Provider
      value={{
        posts,
        conversations,
        currentUser,
        toggleLike,
        sendMessage,
        markConversationRead,
        addPost,
        totalUnread,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
