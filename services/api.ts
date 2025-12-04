import { io, Socket } from 'socket.io-client';
import { AuthState, Chat, TdFile, DownloadTask, ProxyConfig } from '../types';

class ApiService {
  private socket: Socket;
  private listeners: Record<string, Function[]> = {};

  constructor() {
    // Connect to the backend server
    this.socket = io('http://localhost:3001', {
      transports: ['websocket'],
      autoConnect: true,
    });

    this.setupSocketListeners();
  }

  private setupSocketListeners() {
    this.socket.on('connect', () => {
      console.log('Connected to backend');
      this.emitEvent('connection_status', true);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from backend');
      this.emitEvent('connection_status', false);
    });

    this.socket.on('auth_update', (data: { state: AuthState, qrLink?: string }) => {
      this.emitEvent('auth_update', data);
    });

    this.socket.on('chats_update', (chats: Chat[]) => {
      this.emitEvent('chats_update', chats);
    });

    this.socket.on('files_update', (files: TdFile[]) => {
      this.emitEvent('files_update', files);
    });

    this.socket.on('download_progress', (task: DownloadTask) => {
      this.emitEvent('download_progress', task);
    });

    this.socket.on('download_complete', (data: { id: number, path: string }) => {
      this.emitEvent('download_complete', data);
    });
    
    this.socket.on('error', (err: string) => {
      console.error('Backend error:', err);
      alert('Backend Error: ' + err);
    });
  }

  // Event System for React Components
  on(event: string, callback: Function) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  off(event: string, callback: Function) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  private emitEvent(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  // --- API Methods ---

  async checkAuthStatus(): Promise<void> {
    this.socket.emit('get_auth_state');
  }

  async sendPhoneNumber(phone: string): Promise<void> {
    this.socket.emit('login_phone', phone);
  }

  async verifyCode(code: string): Promise<void> {
    this.socket.emit('login_code', code);
  }
  
  async verifyPassword(password: string): Promise<void> {
    this.socket.emit('login_password', password);
  }

  async requestQrCode(): Promise<void> {
    this.socket.emit('request_qr');
  }

  async logout(): Promise<void> {
    this.socket.emit('logout');
    localStorage.removeItem('td_auth_state');
    window.location.reload();
  }

  async getChats(): Promise<void> {
    this.socket.emit('get_chats');
  }

  async getFiles(chatId: number): Promise<void> {
    this.socket.emit('get_files', chatId);
  }

  async setProxy(config: ProxyConfig): Promise<void> {
    this.socket.emit('set_proxy', config);
  }

  async startDownload(fileId: number, fileName: string, totalSize: number) {
    this.socket.emit('download_file', { fileId, fileName, totalSize });
  }

  async pauseDownload(fileId: number) {
    this.socket.emit('pause_download', fileId);
  }

  async resumeDownload(fileId: number) {
    this.socket.emit('resume_download', fileId);
  }

  async cancelDownload(fileId: number) {
    this.socket.emit('cancel_download', fileId);
  }

  async clearCompleted() {
    this.socket.emit('clear_completed_downloads');
  }
}

export const api = new ApiService();