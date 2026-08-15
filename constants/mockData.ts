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

const AVATARS = [
  'https://i.pravatar.cc/150?img=1',
  'https://i.pravatar.cc/150?img=2',
  'https://i.pravatar.cc/150?img=3',
  'https://i.pravatar.cc/150?img=4',
  'https://i.pravatar.cc/150?img=5',
  'https://i.pravatar.cc/150?img=6',
  'https://i.pravatar.cc/150?img=7',
  'https://i.pravatar.cc/150?img=8',
  'https://i.pravatar.cc/150?img=9',
  'https://i.pravatar.cc/150?img=10',
];

const POST_IMAGES = [
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80',
  'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&q=80',
  'https://images.unsplash.com/photo-1579547945413-497e1b99dac0?w=800&q=80',
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
];

export const MOCK_USERS: User[] = [
  {
    id: 'u1',
    name: 'Sofia Reyes',
    username: 'sofiareyes',
    avatar: AVATARS[0],
    bio: 'Designer & Creative Director | Making waves 🌊',
    followers: 12400,
    following: 893,
    posts: 248,
    verified: true,
  },
  {
    id: 'u2',
    name: 'Alex Martinez',
    username: 'alexm',
    avatar: AVATARS[1],
    bio: 'Photographer | Traveler | Coffee addict',
    followers: 5800,
    following: 412,
    posts: 134,
  },
  {
    id: 'u3',
    name: 'Luna Chen',
    username: 'lunachen',
    avatar: AVATARS[2],
    bio: 'Music producer | Sound waves are life',
    followers: 29000,
    following: 210,
    posts: 89,
    verified: true,
  },
  {
    id: 'u4',
    name: 'Mateo Rivera',
    username: 'mateo_r',
    avatar: AVATARS[3],
    bio: 'Developer & Entrepreneur',
    followers: 3200,
    following: 560,
    posts: 67,
  },
  {
    id: 'u5',
    name: 'Isabella Park',
    username: 'isapark',
    avatar: AVATARS[4],
    bio: 'Fitness coach | Wellness enthusiast',
    followers: 18700,
    following: 742,
    posts: 312,
  },
  {
    id: 'u6',
    name: 'Carlos Vega',
    username: 'carlosvega',
    avatar: AVATARS[5],
    bio: 'Chef | Food lover | Travel blogger',
    followers: 7600,
    following: 330,
    posts: 198,
  },
];

export const CURRENT_USER: User = {
  id: 'me',
  name: 'Jordan Wave',
  username: 'jordanwave',
  avatar: AVATARS[6],
  bio: 'Riding the ConnectWave 🌊 | Digital creator | Explorer of worlds',
  followers: 4280,
  following: 612,
  posts: 94,
  verified: false,
};

export const MOCK_POSTS: Post[] = [
  {
    id: 'p1',
    user: MOCK_USERS[2],
    content: 'Just dropped my new EP "Neon Waves" 🎵 Been working on this for 8 months and I could not be more proud. Link in bio to stream it now! 🌊',
    image: POST_IMAGES[0],
    likes: 2847,
    comments: 312,
    shares: 94,
    timestamp: '2m ago',
    liked: false,
    tags: ['music', 'newrelease', 'neonwaves'],
  },
  {
    id: 'p2',
    user: MOCK_USERS[0],
    content: 'New brand identity project just wrapped up! So much fun playing with gradients and motion. What do you all think of this direction? 👇',
    image: POST_IMAGES[3],
    likes: 1203,
    comments: 87,
    shares: 45,
    timestamp: '15m ago',
    liked: true,
    tags: ['design', 'branding', 'creative'],
  },
  {
    id: 'p3',
    user: MOCK_USERS[1],
    content: 'Golden hour hits different when you are 3,000 meters above sea level. No filter needed, nature does all the work. 📸',
    image: POST_IMAGES[1],
    likes: 892,
    comments: 56,
    shares: 23,
    timestamp: '1h ago',
    liked: false,
    tags: ['photography', 'nature', 'golden hour'],
  },
  {
    id: 'p4',
    user: MOCK_USERS[4],
    content: 'Monday motivation: your body is capable of amazing things. Remember that rest is also part of progress. Take care of yourselves 💪❤️',
    likes: 3410,
    comments: 204,
    shares: 178,
    timestamp: '2h ago',
    liked: false,
    tags: ['fitness', 'motivation', 'wellness'],
  },
  {
    id: 'p5',
    user: MOCK_USERS[5],
    content: 'Spent the whole afternoon perfecting this mango habanero salsa recipe. The kick is REAL. Full recipe dropping this week on my blog! 🌶️🥭',
    image: POST_IMAGES[4],
    likes: 567,
    comments: 92,
    shares: 34,
    timestamp: '3h ago',
    liked: true,
    tags: ['food', 'recipe', 'cooking'],
  },
  {
    id: 'p6',
    user: MOCK_USERS[3],
    content: 'Been building in public for 6 months. Just hit 1000 users on my SaaS app! The journey has been wild. Thread on what I learned 🧵👇',
    likes: 1876,
    comments: 143,
    shares: 267,
    timestamp: '5h ago',
    liked: false,
    tags: ['buildinpublic', 'startup', 'saas'],
  },
];

export const MOCK_STORIES: Story[] = [
  { id: 's1', user: MOCK_USERS[0], seen: false },
  { id: 's2', user: MOCK_USERS[2], seen: false },
  { id: 's3', user: MOCK_USERS[4], seen: true },
  { id: 's4', user: MOCK_USERS[1], seen: false },
  { id: 's5', user: MOCK_USERS[3], seen: true },
  { id: 's6', user: MOCK_USERS[5], seen: false },
];

export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'c1',
    user: MOCK_USERS[0],
    lastMessage: 'Loved the new track! Can we collab? 🎵',
    lastTime: '2m',
    unread: 3,
    online: true,
    messages: [
      { id: 'm1', senderId: 'u1', text: 'Hey! Saw your latest post, amazing work!', timestamp: '10:30 AM', read: true },
      { id: 'm2', senderId: 'me', text: 'Thank you so much! Means a lot coming from you 😊', timestamp: '10:32 AM', read: true },
      { id: 'm3', senderId: 'u1', text: 'Loved the new track! Can we collab? 🎵', timestamp: '10:45 AM', read: false },
    ],
  },
  {
    id: 'c2',
    user: MOCK_USERS[2],
    lastMessage: 'The EP drops Friday! Excited? 🌊',
    lastTime: '15m',
    unread: 1,
    online: true,
    messages: [
      { id: 'm1', senderId: 'u3', text: 'Working on something big right now...', timestamp: '9:00 AM', read: true },
      { id: 'm2', senderId: 'me', text: 'Ooh tell me more!', timestamp: '9:05 AM', read: true },
      { id: 'm3', senderId: 'u3', text: 'The EP drops Friday! Excited? 🌊', timestamp: '10:30 AM', read: false },
    ],
  },
  {
    id: 'c3',
    user: MOCK_USERS[1],
    lastMessage: 'Sure, meet at the spot at 6pm?',
    lastTime: '1h',
    unread: 0,
    online: false,
    messages: [
      { id: 'm1', senderId: 'me', text: 'Want to do a photoshoot this weekend?', timestamp: '8:00 AM', read: true },
      { id: 'm2', senderId: 'u2', text: 'Absolutely! Been wanting to try that new location', timestamp: '8:30 AM', read: true },
      { id: 'm3', senderId: 'me', text: 'Nice! Saturday works?', timestamp: '8:45 AM', read: true },
      { id: 'm4', senderId: 'u2', text: 'Sure, meet at the spot at 6pm?', timestamp: '9:00 AM', read: true },
    ],
  },
  {
    id: 'c4',
    user: MOCK_USERS[4],
    lastMessage: 'Check out this workout plan I made for you!',
    lastTime: '3h',
    unread: 0,
    online: false,
    messages: [
      { id: 'm1', senderId: 'u5', text: 'Hey! Starting your fitness journey?', timestamp: 'Yesterday', read: true },
      { id: 'm2', senderId: 'me', text: 'Yeah trying to get more consistent', timestamp: 'Yesterday', read: true },
      { id: 'm3', senderId: 'u5', text: 'Check out this workout plan I made for you!', timestamp: '7:00 AM', read: true },
    ],
  },
  {
    id: 'c5',
    user: MOCK_USERS[3],
    lastMessage: 'Shipped the feature! 🚀',
    lastTime: '1d',
    unread: 0,
    online: false,
    messages: [
      { id: 'm1', senderId: 'u4', text: 'Hey, any feedback on the beta?', timestamp: 'Yesterday', read: true },
      { id: 'm2', senderId: 'me', text: 'Works great! Love the new UI', timestamp: 'Yesterday', read: true },
      { id: 'm3', senderId: 'u4', text: 'Shipped the feature! 🚀', timestamp: 'Yesterday', read: true },
    ],
  },
  {
    id: 'c6',
    user: MOCK_USERS[5],
    lastMessage: 'Recipe is live! Go check it 🌶️',
    lastTime: '2d',
    unread: 0,
    online: false,
    messages: [
      { id: 'm1', senderId: 'u6', text: 'What cuisines are you into lately?', timestamp: '2 days ago', read: true },
      { id: 'm2', senderId: 'me', text: 'Really into Mexican food right now', timestamp: '2 days ago', read: true },
      { id: 'm3', senderId: 'u6', text: 'Recipe is live! Go check it 🌶️', timestamp: '2 days ago', read: true },
    ],
  },
];
