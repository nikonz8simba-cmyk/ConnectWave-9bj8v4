// mockData.ts — legacy type definitions kept for reference.
// All mock data instances have been removed; the app now uses live Supabase data.

export interface User {
  id: string;
  name: string;
  username: string;
  avatar: string;
  bio?: string;
  followers: number;
  following: number;
  posts: number;
  verified?: boolean;
}

export interface Post {
  id: string;
  user: User;
  content: string;
  image?: string;
  likes: number;
  comments: number;
  shares: number;
  timestamp: string;
  liked: boolean;
  tags?: string[];
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  read: boolean;
}

export interface Conversation {
  id: string;
  user: User;
  lastMessage: string;
  lastTime: string;
  unread: number;
  messages: Message[];
  online: boolean;
}

export interface Story {
  id: string;
  user: User;
  seen: boolean;
}
