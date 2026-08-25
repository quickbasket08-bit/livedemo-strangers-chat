export type ChatMode = "text" | "video";

export interface SessionData {
  sessionId: string;
  username: string;
}

export interface QueueRow {
  session_id: string;
  username: string;
  mode: ChatMode;
  created_at: string;
}

export interface RoomRow {
  id: string;
  mode: ChatMode;
  user1_id: string;
  user1_name: string;
  user2_id: string;
  user2_name: string;
  created_at: string;
  ended_at: string | null;
}

export interface MessageRow {
  id: string;
  room_id: string;
  sender_id: string;
  username: string;
  content: string;
  created_at: string;
}
