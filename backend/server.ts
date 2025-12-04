/**
 * TDDownloader Backend Server
 * 
 * REQUIRED DEPENDENCIES:
 * npm install tdl tdl-tdlib-addon socket.io
 * 
 * REQUIRED BINARY:
 * You must have the `tdjson` dynamic library in your root or system path.
 * - Windows: tdjson.dll
 * - Linux: libtdjson.so
 * - macOS: libtdjson.dylib
 */

import { Client } from 'tdl';
import { TDLib } from 'tdl-tdlib-addon';
import { Server } from 'socket.io';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';

// --- CONFIGURATION ---
// You should typically get these from https://my.telegram.org
const API_ID = 20293998; // Example ID (Use your own for production)
const API_HASH = 'c02157796d88835821d3f25c739d2906'; // Example Hash
const SESSION_NAME = 'td_session';
const DOWNLOAD_DIR = path.join(os.homedir(), 'Downloads', 'TDownloader');

if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// --- SETUP ---
const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const client = new Client(new TDLib(), {
  apiId: API_ID,
  apiHash: API_HASH,
  databaseDirectory: `_td_database`,
  filesDirectory: `_td_files`,
});

// State Management
let currentAuthState = 'LOGGED_OUT';
let activeDownloads = new Map(); // fileId -> { fileName, size, startTime }

// --- HELPER FUNCTIONS ---

// Map TDLib chat object to frontend Chat interface
function mapChat(chat: any): any {
  let type = 'private';
  if (chat.type._ === 'chatTypeSupergroup' || chat.type._ === 'chatTypeBasicGroup') {
    type = chat.type.is_channel ? 'channel' : 'group';
  }
  
  return {
    id: chat.id,
    title: chat.title,
    unreadCount: chat.unread_count,
    lastMessage: chat.last_message?.content?.text?.text || 'Media message',
    timestamp: chat.last_message?.date * 1000 || Date.now(),
    type: type,
  };
}

// Map TDLib message content to frontend TdFile interface
function mapMessageToFile(message: any): any | null {
  const content = message.content;
  let fileData = null;
  let fileType = 'Document';
  let thumbnail = null;

  if (content._ === 'messagePhoto') {
    const photo = content.photo.sizes[content.photo.sizes.length - 1]; // Biggest size
    fileData = photo.photo;
    fileType = 'Image';
    // Small thumbnail for preview (miniature)
    if (content.photo.minithumbnail) {
       thumbnail = content.photo.minithumbnail.data;
    }
  } else if (content._ === 'messageVideo') {
    fileData = content.video.video;
    fileType = 'Video';
    if (content.video.minithumbnail) thumbnail = content.video.minithumbnail.data;
  } else if (content._ === 'messageDocument') {
    fileData = content.document.document;
    fileType = 'Document';
    if (content.document.minithumbnail) thumbnail = content.document.minithumbnail.data;
  } else if (content._ === 'messageAudio') {
    fileData = content.audio.audio;
    fileType = 'Music';
  }

  if (!fileData) return null;

  return {
    id: fileData.id,
    uniqueId: fileData.remote.unique_id,
    name: content.document?.file_name || content.video?.file_name || content.audio?.file_name || `file_${fileData.id}.${fileType === 'Image' ? 'jpg' : 'dat'}`,
    size: fileData.expected_size,
    date: message.date,
    type: fileType,
    thumbnail: thumbnail, // Base64 string from minithumbnail if available
    path: fileData.local.path,
    isDownloading: fileData.local.is_downloading_active
  };
}

// --- TDL EVENTS ---

client.on('error', console.error);

client.on('update', (update) => {
  // 1. Auth Updates
  if (update._ === 'updateAuthorizationState') {
    const state = update.authorization_state;
    let frontendState = 'LOGGED_OUT';
    let qrLink = undefined;

    switch (state._) {
      case 'authorizationStateWaitPhoneNumber':
        frontendState = 'LOGGED_OUT';
        break;
      case 'authorizationStateWaitOtherDeviceConfirmation':
        frontendState = 'QR_CODE';
        qrLink = state.link;
        break;
      case 'authorizationStateWaitCode':
        frontendState = 'AWAITING_CODE';
        break;
      case 'authorizationStateWaitPassword':
        frontendState = 'AWAITING_PASSWORD';
        break;
      case 'authorizationStateReady':
        frontendState = 'READY';
        break;
    }

    currentAuthState = frontendState;
    io.emit('auth_update', { state: frontendState, qrLink });
  }

  // 2. File Updates (Progress Monitoring)
  if (update._ === 'updateFile') {
    const file = update.file;
    const downloadInfo = activeDownloads.get(file.id);

    if (downloadInfo || file.local.is_downloading_active) {
       const progress = file.expected_size ? Math.round((file.local.downloaded_size / file.expected_size) * 100) : 0;
       
       // Calculate speed (simplified)
       const speed = 0; // In a real app, calculate delta over time

       io.emit('download_progress', {
         id: file.id,
         fileName: downloadInfo?.fileName || 'Unknown File',
         totalSize: file.expected_size,
         downloadedSize: file.local.downloaded_size,
         progress: progress,
         speed: speed,
         status: file.local.is_downloading_completed ? 'completed' : 'downloading'
       });

       // Move file on completion
       if (file.local.is_downloading_completed) {
         const task = activeDownloads.get(file.id);
         if (task) {
            const finalPath = path.join(DOWNLOAD_DIR, task.fileName);
            try {
              fs.copyFileSync(file.local.path, finalPath);
              console.log(`File saved to ${finalPath}`);
              io.emit('download_complete', { id: file.id, path: finalPath });
              activeDownloads.delete(file.id);
            } catch (err) {
              console.error('Error moving file:', err);
            }
         }
       }
    }
  }
});

// --- SOCKET EVENTS ---

io.on('connection', (socket) => {
  console.log('Client connected');

  // Initial State Push
  socket.emit('auth_update', { state: currentAuthState });

  socket.on('get_auth_state', () => {
    socket.emit('auth_update', { state: currentAuthState });
  });

  // Auth Actions
  socket.on('request_qr', async () => {
    try {
      await client.invoke({ _: 'requestQrCodeAuthentication', other_user_ids: [] });
    } catch (e) { console.error(e); }
  });

  socket.on('login_phone', async (phone) => {
    try {
      await client.invoke({ _: 'setAuthenticationPhoneNumber', phone_number: phone });
    } catch (e) { socket.emit('error', e.message); }
  });

  socket.on('login_code', async (code) => {
    try {
      await client.invoke({ _: 'checkAuthenticationCode', code: code });
    } catch (e) { socket.emit('error', e.message); }
  });
  
  socket.on('login_password', async (password) => {
    try {
      await client.invoke({ _: 'checkAuthenticationPassword', password: password });
    } catch (e) { socket.emit('error', e.message); }
  });

  socket.on('logout', async () => {
    try {
      await client.invoke({ _: 'logOut' });
    } catch (e) { console.error(e); }
  });

  // Data Actions
  socket.on('get_chats', async () => {
    try {
      // Load chats if not loaded
      await client.invoke({ _: 'loadChats', chat_list: { _: 'chatListMain' }, limit: 20 });
      const result = await client.invoke({ _: 'getChats', chat_list: { _: 'chatListMain' }, limit: 50 });
      
      const chatsPromises = result.chat_ids.map(id => client.invoke({ _: 'getChat', chat_id: id }));
      const chatsRaw = await Promise.all(chatsPromises);
      const chats = chatsRaw.map(mapChat);
      
      socket.emit('chats_update', chats);
    } catch (e) {
      console.error('Get chats error', e);
    }
  });

  socket.on('get_files', async (chatId) => {
    try {
      // Get recent history
      const history = await client.invoke({
        _: 'getChatHistory',
        chat_id: chatId,
        limit: 50,
        from_message_id: 0,
        offset: 0,
        only_local: false
      });
      
      const files = history.messages
        .map(mapMessageToFile)
        .filter(f => f !== null);

      socket.emit('files_update', files);
    } catch (e) {
      console.error('Get files error', e);
    }
  });

  // Download Actions
  socket.on('download_file', async ({ fileId, fileName, totalSize }) => {
    try {
      activeDownloads.set(fileId, { fileName, totalSize, startTime: Date.now() });
      await client.invoke({
        _: 'downloadFile',
        file_id: fileId,
        priority: 1,
        offset: 0,
        limit: 0,
        synchronous: false
      });
    } catch (e) {
      console.error('Download error', e);
    }
  });

  socket.on('cancel_download', async (fileId) => {
    try {
      await client.invoke({ _: 'cancelDownloadFile', file_id: fileId, only_if_pending: false });
      activeDownloads.delete(fileId);
    } catch (e) { console.error(e); }
  });

  // Proxy
  socket.on('set_proxy', async (config) => {
    if (!config.enabled) {
      await client.invoke({ _: 'disableProxy' });
      return;
    }

    let typeClass = {};
    if (config.type === 'socks5') {
       typeClass = { _: 'proxyTypeSocks5', username: config.username || '', password: config.password || '' };
    } else if (config.type === 'http') {
       typeClass = { _: 'proxyTypeHttp', username: config.username || '', password: config.password || '', http_only: false };
    } else if (config.type === 'mtproto') {
       typeClass = { _: 'proxyTypeMtproto', secret: config.secret };
    }

    try {
      await client.invoke({
        _: 'addProxy',
        server: config.host,
        port: config.port,
        enable: true,
        type: typeClass
      });
    } catch (e) {
      socket.emit('error', 'Failed to set proxy: ' + e.message);
    }
  });
});

// --- STARTUP ---
httpServer.listen(3001, () => {
  console.log('Server running on http://localhost:3001');
  client.connect();
});