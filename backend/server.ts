import { Client } from 'tdl';
import { TDLib } from 'tdl-tdlib-addon';
import { Server } from 'socket.io';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';

// --- 配置区域 ---
// 1. 获取 API ID 和 Hash: https://my.telegram.org
const API_ID = 20293998; // 替换为你自己的 API_ID
const API_HASH = 'c02157796d88835821d3f25c739d2906'; // 替换为你自己的 API_HASH

// 2. 自动检测系统平台以加载对应的库文件
const platform = os.platform();
let libName = '';
if (platform === 'win32') libName = 'tdjson.dll';
else if (platform === 'darwin') libName = 'libtdjson.dylib';
else libName = 'libtdjson.so';

// 检查库文件是否存在于当前目录
const libPath = path.resolve(__dirname, libName);
if (!fs.existsSync(libPath)) {
  console.error('\n==================================================');
  console.error(`❌ 错误: 未找到 TDLib 库文件: ${libName}`);
  console.error(`请下载对应你系统的 ${libName} 文件并放入 backend 文件夹中。`);
  console.error('下载地址参考: https://github.com/tdlib/td/releases');
  console.error('==================================================\n');
  process.exit(1);
}

// --- 初始化 ---
const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// 初始化 TDL 客户端
const client = new Client(new TDLib(libPath), {
  apiId: API_ID,
  apiHash: API_HASH,
  databaseDirectory: path.join(__dirname, '_td_database'),
  filesDirectory: path.join(__dirname, '_td_files'),
});

// 下载目录设置
const DOWNLOAD_DIR = path.join(os.homedir(), 'Downloads', 'TDownloader');
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// 状态管理
let currentAuthState = 'LOGGED_OUT';
let activeDownloads = new Map(); // fileId -> { fileName, size, startTime }

// --- 辅助函数 ---

// 映射聊天对象
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

// 映射消息文件
function mapMessageToFile(message: any): any | null {
  if (!message.content) return null;
  
  const content = message.content;
  let fileData = null;
  let fileType = 'Document';
  let thumbnail = null;

  if (content._ === 'messagePhoto') {
    const photo = content.photo.sizes[content.photo.sizes.length - 1];
    fileData = photo.photo;
    fileType = 'Image';
    if (content.photo.minithumbnail) thumbnail = content.photo.minithumbnail.data;
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
    thumbnail: thumbnail,
    path: fileData.local.path,
    isDownloading: fileData.local.is_downloading_active
  };
}

// --- TDL 事件监听 ---

client.on('error', console.error);

client.on('update', (update) => {
  // 1. 认证状态更新
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

  // 2. 文件下载进度更新
  if (update._ === 'updateFile') {
    const file = update.file;
    const downloadInfo = activeDownloads.get(file.id);

    if (downloadInfo || file.local.is_downloading_active) {
       const progress = file.expected_size ? Math.round((file.local.downloaded_size / file.expected_size) * 100) : 0;
       
       io.emit('download_progress', {
         id: file.id,
         fileName: downloadInfo?.fileName || 'Unknown File',
         totalSize: file.expected_size,
         downloadedSize: file.local.downloaded_size,
         progress: progress,
         speed: 0,
         status: file.local.is_downloading_completed ? 'completed' : 'downloading'
       });

       if (file.local.is_downloading_completed) {
         const task = activeDownloads.get(file.id);
         if (task) {
            const finalPath = path.join(DOWNLOAD_DIR, task.fileName);
            try {
              // 简单去重重命名
              let targetPath = finalPath;
              if (fs.existsSync(targetPath)) {
                const ext = path.extname(task.fileName);
                const name = path.basename(task.fileName, ext);
                targetPath = path.join(DOWNLOAD_DIR, `${name}_${Date.now()}${ext}`);
              }
              
              fs.copyFileSync(file.local.path, targetPath);
              console.log(`File saved to ${targetPath}`);
              io.emit('download_complete', { id: file.id, path: targetPath });
              activeDownloads.delete(file.id);
            } catch (err) {
              console.error('Error moving file:', err);
            }
         }
       }
    }
  }
});

// --- Socket.IO 事件处理 ---

io.on('connection', (socket) => {
  console.log('Client connected');
  socket.emit('auth_update', { state: currentAuthState });

  socket.on('get_auth_state', () => {
    socket.emit('auth_update', { state: currentAuthState });
  });

  socket.on('request_qr', async () => {
    try { await client.invoke({ _: 'requestQrCodeAuthentication', other_user_ids: [] }); } catch (e) { console.error(e); }
  });

  socket.on('login_phone', async (phone) => {
    try { await client.invoke({ _: 'setAuthenticationPhoneNumber', phone_number: phone }); } catch (e) { socket.emit('error', e.message); }
  });

  socket.on('login_code', async (code) => {
    try { await client.invoke({ _: 'checkAuthenticationCode', code: code }); } catch (e) { socket.emit('error', e.message); }
  });
  
  socket.on('login_password', async (password) => {
    try { await client.invoke({ _: 'checkAuthenticationPassword', password: password }); } catch (e) { socket.emit('error', e.message); }
  });

  socket.on('logout', async () => {
    try { await client.invoke({ _: 'logOut' }); } catch (e) { console.error(e); }
  });

  socket.on('get_chats', async () => {
    try {
      await client.invoke({ _: 'loadChats', chat_list: { _: 'chatListMain' }, limit: 20 });
      const result = await client.invoke({ _: 'getChats', chat_list: { _: 'chatListMain' }, limit: 50 });
      const chatsPromises = result.chat_ids.map(id => client.invoke({ _: 'getChat', chat_id: id }));
      const chatsRaw = await Promise.all(chatsPromises);
      socket.emit('chats_update', chatsRaw.map(mapChat));
    } catch (e) { console.error('Get chats error', e); }
  });

  socket.on('get_files', async (chatId) => {
    try {
      const history = await client.invoke({
        _: 'getChatHistory',
        chat_id: chatId,
        limit: 50,
        from_message_id: 0,
        offset: 0,
        only_local: false
      });
      const files = history.messages.map(mapMessageToFile).filter(f => f !== null);
      socket.emit('files_update', files);
    } catch (e) { console.error('Get files error', e); }
  });

  socket.on('download_file', async ({ fileId, fileName, totalSize }) => {
    try {
      activeDownloads.set(fileId, { fileName, totalSize, startTime: Date.now() });
      await client.invoke({
        _: 'downloadFile',
        file_id: fileId,
        priority: 32,
        offset: 0,
        limit: 0,
        synchronous: false
      });
    } catch (e) { console.error('Download error', e); }
  });

  socket.on('cancel_download', async (fileId) => {
    try {
      await client.invoke({ _: 'cancelDownloadFile', file_id: fileId, only_if_pending: false });
      activeDownloads.delete(fileId);
    } catch (e) { console.error(e); }
  });

  socket.on('set_proxy', async (config) => {
    if (!config.enabled) {
      await client.invoke({ _: 'disableProxy' });
      return;
    }
    let typeClass = {};
    if (config.type === 'socks5') typeClass = { _: 'proxyTypeSocks5', username: config.username || '', password: config.password || '' };
    else if (config.type === 'http') typeClass = { _: 'proxyTypeHttp', username: config.username || '', password: config.password || '', http_only: false };
    else if (config.type === 'mtproto') typeClass = { _: 'proxyTypeMtproto', secret: config.secret };
    
    try {
      await client.invoke({ _: 'addProxy', server: config.host, port: config.port, enable: true, type: typeClass });
    } catch (e) { socket.emit('error', 'Proxy Error: ' + e.message); }
  });
});

// 启动服务器
httpServer.listen(3001, () => {
  console.log('✅ Backend server running on http://localhost:3001');
  console.log('🔄 Connecting to Telegram Network...');
  client.connect();
});