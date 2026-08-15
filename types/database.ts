export interface DbUserProfile {
  id: string;
  username: string;
  email: string;
  name: string;
  avatar: string;
  bio: string;
  verified: boolean;
  posts_count: number;
  followers_count: number;
  following_count: number;
  created_at: string;
  updated_at: string;
}

export interface DbPost {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  video_url: string | null;
  media_type: 'text' | 'image' | 'video';
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
  user_profiles?: DbUserProfile;
  // from get_discovery_feed RPC
  score?: number;
}

export interface DbPostLike {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface DbConversation {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface DbConversationParticipant {
  conversation_id: string;
  user_id: string;
  last_read_at: string;
}

export interface DbMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  read: boolean;
  created_at: string;
  user_profiles?: DbUserProfile;
}

// App-level types (mapped from DB)
export interface AppUser {
  id: string;
  username: string;
  email: string;
  name: string;
  avatar: string;
  bio: string;
  verified: boolean;
  posts_count: number;
  followers_count: number;
  following_count: number;
}

export interface AppPost {
  id: string;
  user: AppUser;
  content: string;
  image_url: string | null;
  video_url: string | null;
  media_type: 'text' | 'image' | 'video';
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
  liked: boolean;
  timestamp: string;
  score?: number;
}

export interface AppMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  read: boolean;
  created_at: string;
  timestamp: string;
  media_url?: string;
  media_type?: string;
}

export interface AppConversation {
  id: string;
  other_user: AppUser;
  last_message: string;
  last_time: string;
  unread: number;
  online: boolean;
  messages: AppMessage[];
  updated_at: string;
}
