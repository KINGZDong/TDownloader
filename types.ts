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
  name: string;
  size: number; // in bytes
  date: number; // timestamp
  type: FileType;
  path?: string; // Local path if downloaded
  thumbnail?: string; // Base64 or path
  isDownloading?: boolean;
}

export interface DownloadTask {
  id: number; // correlates to TdFile.id
  fileName: string;
  progress: number; // 0-100
  speed: number; // bytes per second
  downloadedSize: number;
  status: 'pending' | 'downloading' | 'paused' | 'completed' | 'error';
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