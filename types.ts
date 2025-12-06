
export enum AuthState {
  LOGGED_OUT = 'LOGGED_OUT',
  AWAITING_CODE = 'AWAITING_CODE',
  AWAITING_PASSWORD = 'AWAITING_PASSWORD',
  READY = 'READY',
  QR_CODE = 'QR_CODE'
}

export interface Chat {
  id: number;
  title: string;
  photo?: string;
  lastMessage?: string;
  timestamp: number;
  unreadCount: number;
  type: 'private' | 'group' | 'channel' | 'basic_group' | 'supergroup';
}

export enum FileType {
  ALL = 'All',
  IMAGE = 'Image',
  VIDEO = 'Video',
  DOCUMENT = 'Document',
  MUSIC = 'Music',
}

export interface TdFile {
  id: number; // This is the file_id used for downloading
  uniqueId: string;
  messageId: number; // The ID of the message this file belongs to
  groupId: string; // media_album_id for grouping (0 if none)
  name: string;
  text?: string; // Caption or message text
  size: number; // in bytes
  date: number; // timestamp
  type: FileType;
  path?: string; // Local path if downloaded
  thumbnail?: string; // Base64 minithumbnail (fallback)
  isDownloading?: boolean;
  isDownloaded?: boolean; // True if the full file exists locally
}

export interface DownloadTask {
  id: number; // correlates to TdFile.id
  fileName: string;
  progress: number; // 0-100
  speed: number; // bytes per second
  downloadedSize: number;
  status: 'pending' | 'downloading' | 'paused' | 'completed' | 'error' | 'cancelled';
  totalSize: number;
}

export interface ProxyConfig {
  enabled: boolean;
  type: 'socks5' | 'http' | 'mtproto';
  host: string;
  port: number;
  username?: string;
  password?: string;
  secret?: string; // for MTProto
}

export interface ConnectionState {
  state: 'waiting_for_network' | 'connecting_to_proxy' | 'connecting' | 'updating' | 'ready' | 'unknown';
}

export interface SavedSession {
  id: string; // unique session folder name
  firstName: string;
  lastName?: string;
  username?: string;
  phoneNumber?: string;
  avatar?: string; // base64
  lastActive: number;
}
