import { createRequire } from 'module';
import { TDLib } from 'tdl-tdlib-addon';
import { Server } from 'socket.io';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import process from 'node:process';
import { exec } from 'child_process';
import 'dotenv/config'; 

// Shim for __dirname in ESM environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);
const { Client } = require('tdl');

// --- 0. 防止进程崩溃的关键代码 ---
(process as any).on('unhandledRejection', (reason: any, promise: any) => {
  if (reason) {
      if (reason.message === 'Request aborted' || reason.code === 500) return;
      if (reason.code === 400 && reason.message?.includes('requestQrCodeAuthentication')) return;
  }
  console.error('⚠️ 警告: 捕获到未处理的 Promise 拒绝 (通常是 TDLib 网络错误)');
  console.error('原因:', reason);
});

(process as any).on('uncaughtException', (error: any) => {
    console.error('⚠️ 警告: 捕获到未处理的异常');
    console.error(error);
});

// --- 配置区域 ---
const API_ID = Number(process.env.API_ID);
const API_HASH = process.env.API_HASH;

// 检查环境变量
if (!API_ID || !API_HASH) {
  console.error('\n==================================================');
  console.error('❌ 错误: 未在 .env 文件中找到 API_ID 或 API_HASH');
  console.error('请确保根目录下存在 .env 文件并包含以下内容:');
  console.error('API_ID=your_api_id');
  console.error('API_HASH=your_api_hash');
  console.error('==================================================\n');
  (process as any).exit(1);
}

// 2. 自动检测系统平台以加载对应的库文件
const platform = os.platform();
let libName = '';
if (platform === 'win32') libName = 'tdjson.dll';
else if (platform === 'darwin') libName = 'libtdjson.dylib';
else libName = 'libtdjson.so';

const libPath = path.resolve(__dirname, libName);

if (!fs.existsSync(libPath)) {
  console.error(`❌ Error: TDLib library not found: ${libName}`);
  console.error(`Please place ${libName} in the backend directory.`);
  (process as any).exit(1);
}

// --- 初始化 Server (Socket.io Only) ---
const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- 数据目录结构 ---
const HOME_DIR = os.homedir();
const APP_DATA_DIR = path.join(HOME_DIR, '.tdownloader-data');
const SESSIONS_DIR = path.join(APP_DATA_DIR, 'sessions');
const FILES_DIR = path.join(APP_DATA_DIR, 'files');
const SESSIONS_META_FILE = path.join(APP_DATA_DIR, 'sessions.json');

// Ensure dirs
[APP_DATA_DIR, SESSIONS_DIR, FILES_DIR].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

let appConfig = {
  downloadPath: path.join(os.homedir(), 'Downloads', 'TDownloader')
};
if (!fs.existsSync(appConfig.downloadPath)) fs.mkdirSync(appConfig.downloadPath, { recursive: true });


// --- Session Management Types ---
interface SavedSession {
  id: string; // Folder name
  firstName: string;
  lastName?: string;
  username?: string;
  phoneNumber?: string;
  avatar?: string; 
  lastActive: number;
}

// Global Variables
let client: any = null;
let currentSessionId: string | null = null;
let activeDownloads = new Map<number, any>();
let currentScanRequestId = 0;

// Helper: Load Sessions List
const loadSessionsMetadata = (): SavedSession[] => {
    if (!fs.existsSync(SESSIONS_META_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(SESSIONS_META_FILE, 'utf-8'));
    } catch { return []; }
};

// Helper: Save Sessions List
const saveSessionsMetadata = (sessions: SavedSession[]) => {
    fs.writeFileSync(SESSIONS_META_FILE, JSON.stringify(sessions, null, 2));
};

// Helper: Get User Info and Update Metadata
const updateCurrentSessionMetadata = async () => {
    if (!client || !currentSessionId) return;
    try {
        const me = await client.invoke({ _: 'getMe' });
        const sessions = loadSessionsMetadata();
        const existingIndex = sessions.findIndex(s => s.id === currentSessionId);
        
        // Get Avatar (if exists)
        let avatarBase64 = undefined;
        if (me.profile_photo?.small?.local?.path && fs.existsSync(me.profile_photo.small.local.path)) {
            avatarBase64 = fs.readFileSync(me.profile_photo.small.local.path).toString('base64');
        } else if (me.profile_photo?.small?.id) {
            try {
                await client.invoke({ _: 'downloadFile', file_id: me.profile_photo.small.id, priority: 1 });
            } catch {}
        }

        const sessionData: SavedSession = {
            id: currentSessionId,
            firstName: me.first_name,
            lastName: me.last_name,
            username: me.username,
            phoneNumber: me.phone_number,
            avatar: avatarBase64 || (existingIndex >= 0 ? sessions[existingIndex].avatar : undefined),
            lastActive: Date.now()
        };

        if (existingIndex >= 0) {
            sessions[existingIndex] = sessionData;
        } else {
            sessions.push(sessionData);
        }
        
        saveSessionsMetadata(sessions);
        io.emit('sessions_list_update', sessions); // Notify frontend
    } catch (e) {
        console.error('Failed to update session metadata:', e);
    }
};

// --- PROXY HELPER (Backend Execution Only) ---
async function applyProxy(config: any) {
    if (!client) return;
    try {
        // First disable existing
        await client.invoke({ _: 'disableProxy' }).catch(() => {});
        
        if (!config.enabled && !config.host) return;

        let typeClass: any;
        if (config.type === 'socks5') {
            typeClass = { _: 'proxyTypeSocks5', username: config.username || '', password: config.password || '' };
        } else if (config.type === 'http') {
            typeClass = { _: 'proxyTypeHttp', username: config.username || '', password: config.password || '', http_only: false };
        } else if (config.type === 'mtproto') {
            typeClass = { _: 'proxyTypeMtproto', secret: config.secret || '' };
        }
        
        console.log(`🛡️ Applying Proxy: ${config.type}://${config.host}:${config.port}`);
        await client.invoke({ _: 'addProxy', server: config.host, port: config.port, enable: true, type: typeClass });
    } catch (e) {
        console.error('❌ Failed to apply proxy:', e);
    }
}

// --- CLIENT INITIALIZATION ---
async function initializeClient(sessionId: string) {
    if (client) {
        console.log('🔄 Closing previous client...');
        try { await client.close(); } catch (e) { }
        client = null;
        activeDownloads.clear();
    }

    currentSessionId = sessionId;
    const dbDir = path.join(SESSIONS_DIR, sessionId);

    console.log(`🚀 Initializing Client for Session: ${sessionId}`);

    client = new Client(new TDLib(libPath), {
        apiId: API_ID,
        apiHash: API_HASH,
        databaseDirectory: dbDir,
        filesDirectory: FILES_DIR, 
    });
    
    try {
        await client.invoke({ _: 'setLogVerbosityLevel', new_verbosity_level: 1 });
    } catch (e) { console.error('Client setup error', e); }

    client.on('error', (err: any) => console.error('TDLib Client Error:', err));

    client.on('update', (update: any) => {
        if (update._ === 'updateAuthorizationState') {
            const state = update.authorization_state;
            let frontendState = 'LOGGED_OUT';
            let qrLink = undefined;

            switch (state._) {
                case 'authorizationStateWaitPhoneNumber': frontendState = 'LOGGED_OUT'; break;
                case 'authorizationStateWaitOtherDeviceConfirmation': 
                    frontendState = 'QR_CODE'; 
                    qrLink = state.link; 
                    break;
                case 'authorizationStateWaitCode': frontendState = 'AWAITING_CODE'; break;
                case 'authorizationStateWaitPassword': frontendState = 'AWAITING_PASSWORD'; break;
                case 'authorizationStateReady': 
                    frontendState = 'READY'; 
                    updateCurrentSessionMetadata(); 
                    break;
            }
            io.emit('auth_update', { state: frontendState, qrLink });
        }

        if (update._ === 'updateConnectionState') {
             const state = update.state;
             let simpleState = 'unknown';
             switch (state._) {
                case 'connectionStateWaitingForNetwork': simpleState = 'waiting_for_network'; break;
                case 'connectionStateConnectingToProxy': simpleState = 'connecting_to_proxy'; break;
                case 'connectionStateConnecting': simpleState = 'connecting'; break;
                case 'connectionStateUpdating': simpleState = 'updating'; break;
                case 'connectionStateReady': simpleState = 'ready'; break;
             }
             io.emit('connection_state_update', { state: simpleState });
        }
        
        if (update._ === 'updateFile') {
            handleFileUpdate(update.file);
        }
    });

    try {
        await client.connect();
    } catch (e) {
        console.error("❌ TDLib connect error:", e);
    }
}

// --- File Handling Helper ---
function handleFileUpdate(file: any) {
    if (!file || !file.local) return; 

    let downloadInfo = activeDownloads.get(file.id);

    if (downloadInfo) {
       // Update logic for status
       if (!file.local.is_downloading_active && !file.local.is_downloading_completed) {
           // If TDLib says not active, and we haven't explicitly cancelled, mark as paused
           if (downloadInfo.status !== 'cancelled' && downloadInfo.status !== 'paused') {
              downloadInfo.status = 'paused';
              downloadInfo.speed = 0;
           }
       } else if (file.local.is_downloading_active) {
           downloadInfo.status = 'downloading';
       }

       if (downloadInfo.status === 'downloading') {
         const now = Date.now();
         const timeDiff = now - downloadInfo.lastUpdateTime;
         if (timeDiff > 800) {
           const bytesDiff = file.local.downloaded_size - downloadInfo.lastDownloadedSize;
           const speed = bytesDiff > 0 ? (bytesDiff / timeDiff) * 1000 : 0; 
           downloadInfo.speed = speed;
           downloadInfo.lastDownloadedSize = file.local.downloaded_size;
           downloadInfo.lastUpdateTime = now;
           activeDownloads.set(file.id, downloadInfo);
         }
       }

       let progress = file.expected_size > 0 ? Math.round((file.local.downloaded_size / file.expected_size) * 100) : 0;
       
       io.emit('download_progress', {
         id: file.id,
         fileName: downloadInfo.fileName,
         totalSize: file.expected_size,
         downloadedSize: file.local.downloaded_size,
         progress: progress,
         speed: downloadInfo.speed,
         status: file.local.is_downloading_completed ? 'completed' : downloadInfo.status
       });

       if (file.local.is_downloading_completed) {
         const finalPath = path.join(appConfig.downloadPath, downloadInfo.fileName);
         try {
            if (!fs.existsSync(appConfig.downloadPath)) fs.mkdirSync(appConfig.downloadPath, { recursive: true });
            let targetPath = finalPath;
            
            // Basic collision handling
            if (fs.existsSync(targetPath)) {
              const ext = path.extname(downloadInfo.fileName);
              const name = path.basename(downloadInfo.fileName, ext);
              targetPath = path.join(appConfig.downloadPath, `${name}_${Date.now()}${ext}`);
            }
            
            if (file.local.path !== targetPath) {
                fs.copyFileSync(file.local.path, targetPath);
            }
            io.emit('download_complete', { id: file.id, path: targetPath });
            activeDownloads.delete(file.id);
         } catch (err) {
           console.error('Error moving file:', err);
           activeDownloads.delete(file.id);
         }
       }
    }

    if (file.local.is_downloading_completed && !downloadInfo) {
        if (file.size < 20 * 1024 * 1024) { 
            try {
                if (fs.existsSync(file.local.path)) {
                    const data = fs.readFileSync(file.local.path).toString('base64');
                    io.emit('thumbnail_ready', { fileId: file.id, data: data });
                }
            } catch (e) { }
        }
    }
}

// --- Helper Functions (Mappings) ---
// Exported for testing
export function mapChat(chat: any): any {
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

export function mapMessageToFile(message: any): any | null {
  try {
      if (!message || !message.content) return null;
      const content = message.content;
      
      let fileData: any = null;
      let fileType: any = 'Document';
      let thumbnail: string | null = null; // Base64
      let thumbnailFileId: number | undefined = undefined;
      let text = '';
      
      // Generate a date string for filename fallback: YYYYMMDD_HHMMSS
      const dateDate = new Date(message.date * 1000);
      const dateStr = dateDate.toISOString().replace(/[:T-]/g, '').split('.')[0]; 

      if (content.caption && content.caption.text) {
          text = content.caption.text;
      }

      if (content._ === 'messagePhoto') {
          const sizes = content.photo?.sizes;
          if (Array.isArray(sizes) && sizes.length > 0) {
              const largest = sizes[sizes.length - 1];
              fileData = largest?.photo; 
              fileType = 'Image';
              if (content.photo.minithumbnail?.data) thumbnail = content.photo.minithumbnail.data;
              const preview = sizes.find((s: any) => s.type === 'x') || sizes.find((s: any) => s.type === 'm') || sizes.find((s: any) => s.type === 's');
              if (preview && preview.photo && preview.photo.id) thumbnailFileId = preview.photo.id;
          }
      }
      else if (content._ === 'messageVideo') {
          fileData = content.video?.video; 
          fileType = 'Video';
          if (content.video?.minithumbnail?.data) thumbnail = content.video.minithumbnail.data;
          const thumbObj = content.video?.thumbnail;
          if (thumbObj) {
              if (thumbObj.file && thumbObj.file.id) thumbnailFileId = thumbObj.file.id;
              else if (thumbObj.photo && thumbObj.photo.id) thumbnailFileId = thumbObj.photo.id;
          }
      }
      else if (content._ === 'messageDocument') {
          fileData = content.document?.document;
          fileType = 'Document';
          if (content.document?.minithumbnail?.data) thumbnail = content.document.minithumbnail.data;
          const thumbObj = content.document?.thumbnail;
          if (thumbObj) {
              if (thumbObj.file && thumbObj.file.id) thumbnailFileId = thumbObj.file.id;
              else if (thumbObj.photo && thumbObj.photo.id) thumbnailFileId = thumbObj.photo.id;
          }
      }
      else if (content._ === 'messageAudio') {
          fileData = content.audio?.audio;
          fileType = 'Music';
          if (content.audio?.minithumbnail?.data) thumbnail = content.audio.minithumbnail.data;
          const thumbObj = content.audio?.album_cover_thumbnail;
          if (thumbObj) {
              if (thumbObj.file && thumbObj.file.id) thumbnailFileId = thumbObj.file.id;
              else if (thumbObj.photo && thumbObj.photo.id) thumbnailFileId = thumbObj.photo.id;
          }
      }

      if (!fileData || !fileData.id) return null; 

      // --- IMPROVED NAME GENERATION LOGIC ---
      let fileName = content.document?.file_name || content.video?.file_name || content.audio?.file_name;
      
      if (!fileName) {
          if (fileType === 'Image') {
              fileName = `Photo_${dateStr}.jpg`;
          } else if (fileType === 'Video') {
              fileName = `Video_${dateStr}.mp4`;
          } else if (fileType === 'Music') {
              fileName = `Audio_${dateStr}.mp3`;
          } else {
              fileName = `File_${dateStr}.dat`;
          }
          // Append partial ID to avoid collision in same second
          fileName = fileName.replace('.', `_${fileData.id}.`); 
      }
      // ---------------------------------------

      let localPath = '';
      let isDownloaded = false;
      let isDownloading = false;

      if (fileData.local) {
          localPath = fileData.local.path || '';
          isDownloading = !!fileData.local.is_downloading_active;
          if (fileData.local.is_downloading_completed && localPath) {
               try { isDownloaded = fs.existsSync(localPath); } catch { isDownloaded = false; }
          }
      }

      return {
        id: fileData.id,
        messageId: message.id,
        groupId: message.media_album_id || '0', 
        uniqueId: fileData.remote?.unique_id || '',
        name: fileName,
        text: text, 
        size: fileData.expected_size || 0,
        date: message.date || 0,
        type: fileType,
        thumbnail: thumbnail, 
        thumbnailFileId: thumbnailFileId, 
        path: localPath, 
        isDownloading: isDownloading,
        isDownloaded: isDownloaded
      };

  } catch (e) {
      console.error(`Error mapping message ${message?.id}:`, e);
      return null;
  }
}

// TDLib Search Filter Helper
function getTdlibFilter(type: string) {
    switch (type) {
      case 'Image': return { _: 'searchMessagesFilterPhoto' };
      case 'Video': return { _: 'searchMessagesFilterVideo' };
      case 'Document': return { _: 'searchMessagesFilterDocument' };
      case 'Music': return { _: 'searchMessagesFilterAudio' };
      default: return { _: 'searchMessagesFilterEmpty' };
    }
}

function openFolder(targetPath: string) {
   let p = targetPath;
   if (!fs.existsSync(p)) p = appConfig.downloadPath; 
   let command = '';
    switch (os.platform()) {
      case 'win32': command = `explorer "${p}"`; break;
      case 'darwin': command = `open "${p}"`; break;
      default: command = `xdg-open "${p}"`; break;
    }
    exec(command, (error) => { if (error) console.error('Error opening folder:', error); });
}

// --- SOCKET HANDLERS ---

io.on('connection', (socket) => {
    socket.emit('sessions_list_update', loadSessionsMetadata());
    if (client) { }

    socket.on('get_saved_accounts', () => {
        socket.emit('sessions_list_update', loadSessionsMetadata());
    });

    socket.on('create_new_session', async () => {
        const newId = `session_${Date.now()}`;
        await initializeClient(newId);
    });

    socket.on('login_session', async (sessionId: string) => {
        await initializeClient(sessionId);
    });
    
    socket.on('remove_session', async (sessionId: string) => {
        if (currentSessionId === sessionId && client) {
             try { await client.invoke({ _: 'logOut' }); } catch {} 
             await client.close();
             client = null;
             currentSessionId = null;
        } else {
             const dbDir = path.join(SESSIONS_DIR, sessionId);
             fs.rmSync(dbDir, { recursive: true, force: true });
        }
        const sessions = loadSessionsMetadata().filter(s => s.id !== sessionId);
        saveSessionsMetadata(sessions);
        socket.emit('sessions_list_update', sessions);
    });
    
    socket.on('switch_account_disconnect', async () => {
        if (client) {
            await client.close();
            client = null;
            currentSessionId = null;
            socket.emit('auth_update', { state: 'LOGGED_OUT' }); 
        }
    });

    socket.on('get_auth_state', async () => {
        if (!client) {
             socket.emit('auth_update', { state: 'LOGGED_OUT' }); 
             return;
        }
        try { await client.invoke({ _: 'getAuthorizationState' }); } catch {}
    });
    
    socket.on('request_qr', async () => {
        if (!client) return;
        try {
            await client.invoke({ _: 'requestQrCodeAuthentication', other_user_ids: [] });
        } catch (e: any) {
            if (e?.code === 400) return;
            console.error('QR Request Error:', e);
        }
    });
    
    socket.on('login_phone', async (p) => client?.invoke({ _: 'setAuthenticationPhoneNumber', phone_number: p }));
    socket.on('login_code', async (c) => client?.invoke({ _: 'checkAuthenticationCode', code: c }));
    socket.on('login_password', async (p) => client?.invoke({ _: 'checkAuthenticationPassword', password: p }));

    socket.on('get_chats', async () => {
        if (!client) return;
        try {
            const authState = await client.invoke({ _: 'getAuthorizationState' });
            if (authState._ !== 'authorizationStateReady') return;

            await client.invoke({ _: 'loadChats', chat_list: { _: 'chatListMain' }, limit: 20 });
            const result = await client.invoke({ _: 'getChats', chat_list: { _: 'chatListMain' }, limit: 50 });
            const chatsPromises = result.chat_ids.map((id: number) => client.invoke({ _: 'getChat', chat_id: id }));
            const chatsRaw = await Promise.all(chatsPromises);
            socket.emit('chats_update', chatsRaw.map(mapChat));
        } catch (e: any) { 
            if (e?.code === 404 || e?.message === 'Not Found') return;
            console.error('Failed to load chats:', e?.message || e);
        }
    });

    socket.on('get_files', async (params) => {
        if (!client) return;
        currentScanRequestId++;
        const thisRequestId = currentScanRequestId;
        
        // Extract parameters
        const chatId = typeof params === 'object' ? params.chatId : params;
        const startDate = typeof params === 'object' ? params.startDate : undefined; 
        const endDate = typeof params === 'object' ? params.endDate : undefined; 
        const limit = (typeof params === 'object' && params.limit) ? params.limit : 0;
        const rawQuery = (typeof params === 'object' && params.query) ? params.query : '';
        const query = rawQuery.trim(); // TRIMMED
        const type = (typeof params === 'object' && params.type) ? params.type : 'All';

        try {
             let lastMessageId = 0; 
             let totalFetched = 0;
             let totalFoundFiles = 0;
             const BATCH_SIZE = 100;

             socket.emit('scan_progress', { scanned: 0, found: 0, active: true });
             
             // --- BRANCHING LOGIC ---
             // If we have a query OR a specific type filter, use SEARCH
             // Otherwise use HISTORY (Better for "All" browsing)
             const useSearch = (query && query.length > 0) || (type && type !== 'All');

             if (!useSearch && endDate) {
                 try {
                     const seekMsg = await client.invoke({ _: 'getMessageByDate', chat_id: chatId, date: endDate });
                     if (seekMsg && seekMsg.id) lastMessageId = seekMsg.id;
                 } catch {}
             }

             while (true) {
                 if (thisRequestId !== currentScanRequestId) break;
                 if (limit > 0 && totalFoundFiles >= limit) break;
                 
                 let rawMessages = [];
                 let messagesToProcess = [];

                 if (useSearch) {
                     // SERVER-SIDE SEARCH
                     const result = await client.invoke({
                         _: 'searchChatMessages',
                         chat_id: chatId,
                         query: query || "",
                         limit: BATCH_SIZE,
                         from_message_id: lastMessageId,
                         offset: 0,
                         filter: getTdlibFilter(type)
                     });
                     rawMessages = result.messages || [];
                     
                     if (rawMessages.length > 0) {
                        lastMessageId = rawMessages[rawMessages.length - 1].id;
                        
                        // GROUP EXPANSION LOGIC
                        const groupIdsToFetch = new Set<string>();
                        
                        // 1. Identify all albums in this batch
                        for(const msg of rawMessages) {
                            if(msg.media_album_id && msg.media_album_id !== "0") {
                                groupIdsToFetch.add(msg.media_album_id);
                            }
                        }
                        
                        // 2. Fetch full groups (siblings) ROBUSTLY
                        const groupPromises = Array.from(groupIdsToFetch).map(async (gid) => {
                            const representative = rawMessages.find((m: any) => m.media_album_id === gid);
                            if (!representative) return [];

                            try {
                                // Strategy: Use getChatHistory Context Window
                                // getMessageGroup is NOT supported by some TDLib versions/schemas.
                                // We use getChatHistory to fetch messages AROUND the representative message.
                                // offset -9 means: start 9 messages NEWER than the target, and fetch 20 messages OLDER from there.
                                // This effectively creates a window [target+9 ... target ... target-10]
                                const historyRes = await client.invoke({
                                    _: 'getChatHistory',
                                    chat_id: chatId,
                                    from_message_id: representative.id,
                                    offset: -9, 
                                    limit: 20 
                                });

                                if (historyRes && historyRes.messages) {
                                    // Filter the history chunk for just the album we care about
                                    return historyRes.messages.filter((m: any) => m.media_album_id === gid);
                                }
                                
                                return [];
                            } catch (e: any) {
                                console.warn(`Failed to expand group ${gid}:`, e.message || e);
                                return [];
                            }
                        });
                        
                        const groupResults = await Promise.all(groupPromises);
                        const allGroupMessages = groupResults.flat();
                        
                        // 3. Merge: Original Search Results + Expanded Group Files
                        const uniqueMap = new Map();
                        
                        // First add ALL raw search results (ensures nothing is lost if group fetch fails)
                        rawMessages.forEach((m: any) => uniqueMap.set(m.id, m));
                        
                        // Then add/overwrite with complete group info
                        allGroupMessages.forEach((m: any) => uniqueMap.set(m.id, m));
                        
                        messagesToProcess = Array.from(uniqueMap.values());
                        
                        // Sort by date descending (UI also sorts, but good for consistency)
                        messagesToProcess.sort((a: any, b: any) => b.date - a.date);
                     } else {
                        messagesToProcess = [];
                     }
                 } else {
                     // STANDARD HISTORY
                     const history = await client.invoke({
                        _: 'getChatHistory',
                        chat_id: chatId,
                        limit: BATCH_SIZE,
                        from_message_id: lastMessageId,
                        offset: 0,
                        only_local: false
                     });
                     rawMessages = history.messages || [];
                     if (rawMessages.length > 0) {
                         lastMessageId = rawMessages[rawMessages.length - 1].id;
                     }
                     messagesToProcess = rawMessages;
                 }

                 if (rawMessages.length === 0) break;

                 const oldestInBatch = rawMessages[rawMessages.length - 1];
                 const validMessages = messagesToProcess.filter((msg: any) => {
                      if (startDate && msg.date < startDate) return false;
                      if (endDate && msg.date > endDate + 86400) return false;
                      return true;
                 });
                 
                 const filesBatch = validMessages.map(mapMessageToFile).filter((f: any) => f !== null);
                 
                 if (filesBatch.length > 0) {
                      let batchToSend = filesBatch;
                      if (limit > 0 && (totalFoundFiles + filesBatch.length > limit)) {
                          batchToSend = filesBatch.slice(0, limit - totalFoundFiles);
                      }
                      totalFoundFiles += batchToSend.length;
                      socket.emit('files_batch', batchToSend);
                 }
                 
                 totalFetched += rawMessages.length;
                 socket.emit('scan_progress', { scanned: totalFetched, found: totalFoundFiles, active: true });
                 
                 // Break conditions
                 if (startDate && oldestInBatch.date < startDate) break;
                 if (limit > 0 && totalFoundFiles >= limit) break;
                 if (rawMessages.length < BATCH_SIZE) break; // End of history/results

                 await new Promise(r => setTimeout(r, 50));
             }
             if (thisRequestId === currentScanRequestId) {
                  socket.emit('scan_progress', { scanned: totalFetched, found: totalFoundFiles, active: false });
                  socket.emit('files_end');
             }
        } catch (e) {
            console.error('Scan error', e);
            socket.emit('files_end');
        }
    });

    socket.on('request_thumbnail', async (fileId) => {
        if (!client || !fileId) return;
        try {
            const fileInfo = await client.invoke({ _: 'getFile', file_id: fileId });
            if (fileInfo.local.is_downloading_completed && fs.existsSync(fileInfo.local.path)) {
                 const data = fs.readFileSync(fileInfo.local.path).toString('base64');
                 socket.emit('thumbnail_ready', { fileId: fileId, data: data });
                 return;
            }
            await client.invoke({ 
                _: 'downloadFile', 
                file_id: fileId, 
                priority: 1, 
                offset: 0, 
                limit: 0, 
                synchronous: false 
            });
        } catch (e) { console.error('Error fetching thumbnail:', e); }
    });

    socket.on('download_file', async (p) => { 
        if(client) {
            activeDownloads.set(p.fileId, { fileName: p.fileName, totalSize: p.totalSize, startTime: Date.now(), lastDownloadedSize: 0, lastUpdateTime: Date.now(), speed: 0, status: 'pending' });
            client.invoke({ _: 'downloadFile', file_id: p.fileId, priority: 1, offset: 0, limit: 0, synchronous: false })
            .catch((e: any) => console.error('Download start error:', e?.message || e));
        }
    });

    // --- NEW / FIXED SOCKET HANDLERS ---
    
    // 1. Pause (Cancel download in TDLib terms)
    socket.on('pause_download', async (fileId) => {
        if (client) {
            try { 
                await client.invoke({ _: 'cancelDownloadFile', file_id: fileId, only_if_pending: false }); 
                // Manually update status in our map for immediate UI feedback
                const task = activeDownloads.get(fileId);
                if (task) {
                    task.status = 'paused';
                    task.speed = 0;
                    activeDownloads.set(fileId, task);
                }
            } catch (e) { console.error('Pause error', e); }
        }
    });

    // 2. Resume (Download again)
    socket.on('resume_download', async (fileId) => {
        if (client) {
            try { 
                await client.invoke({ _: 'downloadFile', file_id: fileId, priority: 1, offset: 0, limit: 0, synchronous: false });
                const task = activeDownloads.get(fileId);
                if (task) {
                    task.status = 'downloading';
                    activeDownloads.set(fileId, task);
                }
            } catch (e) { console.error('Resume error', e); }
        }
    });

    // 3. Cancel (Cancel + Delete File)
    socket.on('cancel_download', async (fileId) => {
        if(client) {
             try { await client.invoke({ _: 'cancelDownloadFile', file_id: fileId, only_if_pending: false }); } catch {}
             try { await client.invoke({ _: 'deleteFile', file_id: fileId }); } catch {}
             activeDownloads.delete(fileId);
             // Notify frontend immediately to remove the item
             io.emit('download_progress', { id: fileId, status: 'cancelled' } as any);
        }
    });
    
    // 4. Pause All
    socket.on('pause_all_downloads', async () => {
        if (!client) return;
        for (const [id, task] of activeDownloads.entries()) {
            if (task.status === 'downloading' || task.status === 'pending') {
                try {
                    client.invoke({ _: 'cancelDownloadFile', file_id: id, only_if_pending: false });
                    task.status = 'paused';
                    task.speed = 0;
                    activeDownloads.set(id, task);
                } catch {}
            }
        }
    });

    // 5. Resume All
    socket.on('resume_all_downloads', async () => {
        if (!client) return;
        for (const [id, task] of activeDownloads.entries()) {
            if (task.status === 'paused') {
                try {
                    client.invoke({ _: 'downloadFile', file_id: id, priority: 1, offset: 0, limit: 0, synchronous: false });
                    task.status = 'downloading';
                    activeDownloads.set(id, task);
                } catch {}
            }
        }
    });

    // 6. Cancel All
    socket.on('cancel_all_downloads', async () => {
        if (!client) return;
        for (const [id, task] of activeDownloads.entries()) {
            try {
                await client.invoke({ _: 'cancelDownloadFile', file_id: id, only_if_pending: false });
                await client.invoke({ _: 'deleteFile', file_id: id });
            } catch {}
            // Send explicit cancelled event for each
             io.emit('download_progress', { id, status: 'cancelled' } as any);
        }
        activeDownloads.clear();
    });
    
    socket.on('clear_completed_downloads', () => {
        // This is mostly a frontend state thing, but if backend kept history we'd clear it here.
        // For now, we iterate map and remove completed ones.
        for (const [id, task] of activeDownloads.entries()) {
            if (task.status === 'completed') {
                activeDownloads.delete(id);
            }
        }
    });
    // -----------------------------------

    socket.on('get_config', () => socket.emit('config_update', appConfig));
    socket.on('update_config', (c) => { if (c.downloadPath) appConfig.downloadPath = c.downloadPath; socket.emit('config_update', appConfig); });
    socket.on('open_file_folder', ({path}) => openFolder(path));
    socket.on('select_directory', () => {  }); 
    
    // UI Override (Manual set from settings)
    socket.on('set_proxy', async (config) => {
        await applyProxy(config);
    });
});

const sessions = loadSessionsMetadata();
if (sessions.length > 0) {
    sessions.sort((a, b) => b.lastActive - a.lastActive);
    initializeClient(sessions[0].id);
} else {
    initializeClient('default_session');
}

// Ensure the server listens on all interfaces (0.0.0.0) for Docker
httpServer.listen(3001, '0.0.0.0', () => {
  console.log('✅ Backend server running on http://0.0.0.0:3001');
});