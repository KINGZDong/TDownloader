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

// Shim for __dirname in ESM environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);
const { Client } = require('tdl');

// --- 配置区域 ---
const API_ID = 20293998; 
const API_HASH = 'c02157796d88835821d3f25c739d2906';

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
  console.error('==================================================\n');
  process.exit(1);
}

// --- 初始化 Server ---
// 移除 HTTP 文件服务逻辑，只保留 Socket.IO
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

// 默认配置
let appConfig = {
  downloadPath: path.join(os.homedir(), 'Downloads', 'TDownloader')
};

// 确保初始目录存在
if (!fs.existsSync(appConfig.downloadPath)) {
  fs.mkdirSync(appConfig.downloadPath, { recursive: true });
}

// 状态管理
let currentAuthState = 'LOGGED_OUT';
let currentConnectionState = 'unknown';

// 扩展 activeDownloads 结构以支持速度计算
interface DownloadState {
  fileName: string;
  totalSize: number;
  startTime: number;
  lastDownloadedSize: number;
  lastUpdateTime: number;
  speed: number;
  status: 'pending' | 'downloading' | 'paused' | 'completed' | 'error';
}
let activeDownloads = new Map<number, DownloadState>(); 

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

  // Check if main file is downloaded locally
  const isDownloaded = fileData.local.is_downloading_completed && fs.existsSync(fileData.local.path);

  return {
    id: fileData.id,
    uniqueId: fileData.remote.unique_id,
    name: content.document?.file_name || content.video?.file_name || content.audio?.file_name || `file_${fileData.id}.${fileType === 'Image' ? 'jpg' : 'dat'}`,
    size: fileData.expected_size,
    date: message.date,
    type: fileType,
    thumbnail: thumbnail, // Base64 blurhash
    path: fileData.local.path, // Local path to main file
    isDownloading: fileData.local.is_downloading_active,
    isDownloaded: isDownloaded
  };
}

// 打开文件夹逻辑
function openFolder(targetPath: string) {
  // 如果路径不存在，尝试打开上一级目录，或者配置的下载目录
  let p = targetPath;
  if (!fs.existsSync(p)) {
      if (fs.existsSync(appConfig.downloadPath)) {
          p = appConfig.downloadPath;
      } else {
          p = os.homedir();
      }
  }

  // 如果是文件，获取其目录
  try {
    const stat = fs.statSync(p);
    if (stat.isFile()) {
        p = path.dirname(p);
    }
  } catch (e) {
      // ignore
  }

  let command = '';
  switch (os.platform()) {
    case 'win32':
      command = `explorer "${p}"`;
      break;
    case 'darwin':
      command = `open "${p}"`;
      break;
    default:
      command = `xdg-open "${p}"`;
      break;
  }
  
  exec(command, (error) => {
    if (error) console.error('Error opening folder:', error);
  });
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
  
  // 2. 连接状态更新 (Connection State)
  if (update._ === 'updateConnectionState') {
    const state = update.state;
    let simpleState = 'unknown';

    // Map TDLib states to simplified frontend states
    switch (state._) {
      case 'connectionStateWaitingForNetwork':
        simpleState = 'waiting_for_network';
        break;
      case 'connectionStateConnectingToProxy':
        simpleState = 'connecting_to_proxy';
        break;
      case 'connectionStateConnecting':
        simpleState = 'connecting';
        break;
      case 'connectionStateUpdating':
        simpleState = 'updating';
        break;
      case 'connectionStateReady':
        simpleState = 'ready';
        break;
    }

    currentConnectionState = simpleState;
    console.log(`📡 Network Status: ${simpleState}`);
    io.emit('connection_state_update', { state: simpleState });
  }

  // 3. 文件下载进度更新
  if (update._ === 'updateFile') {
    const file = update.file;
    let downloadInfo = activeDownloads.get(file.id);

    // 如果是正在下载的文件，或者是我们正在追踪的文件
    if (downloadInfo || file.local.is_downloading_active) {
       
       // 如果没有追踪信息但实际上正在下载（可能是重启后恢复的），初始化追踪
       if (!downloadInfo) {
         downloadInfo = {
           fileName: 'Unknown File', 
           totalSize: file.expected_size,
           startTime: Date.now(),
           lastDownloadedSize: file.local.downloaded_size,
           lastUpdateTime: Date.now(),
           speed: 0,
           status: 'downloading'
         };
         activeDownloads.set(file.id, downloadInfo);
       }

       // 更新状态
       if (!file.local.is_downloading_active && !file.local.is_downloading_completed) {
           downloadInfo.status = 'paused';
           downloadInfo.speed = 0;
       } else if (file.local.is_downloading_active) {
           downloadInfo.status = 'downloading';
       }

       if (downloadInfo.status === 'downloading') {
         // 计算速度
         const now = Date.now();
         const timeDiff = now - downloadInfo.lastUpdateTime;
         
         // 每 800ms 更新一次速度计算，使显示更稳定
         if (timeDiff > 800) {
           const bytesDiff = file.local.downloaded_size - downloadInfo.lastDownloadedSize;
           const speed = bytesDiff > 0 ? (bytesDiff / timeDiff) * 1000 : 0; // bytes per second
           
           downloadInfo.speed = speed;
           downloadInfo.lastDownloadedSize = file.local.downloaded_size;
           downloadInfo.lastUpdateTime = now;
           activeDownloads.set(file.id, downloadInfo);
         }
       }

       // 计算进度
       let progress = 0;
       if (file.expected_size > 0) {
           progress = Math.round((file.local.downloaded_size / file.expected_size) * 100);
       } else {
           // 如果 totalSize 是 0，但我们下载了一些，进度可以设为 0 或者做一个假进度，避免除以0
           progress = 0;
       }
       
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
            // 确保目录存在
            if (!fs.existsSync(appConfig.downloadPath)) {
              fs.mkdirSync(appConfig.downloadPath, { recursive: true });
            }

            // 简单去重重命名
            let targetPath = finalPath;
            if (fs.existsSync(targetPath)) {
              const ext = path.extname(downloadInfo.fileName);
              const name = path.basename(downloadInfo.fileName, ext);
              targetPath = path.join(appConfig.downloadPath, `${name}_${Date.now()}${ext}`);
            }
            
            // 只有当文件不在目标路径时才复制（TDLib 默认下载到内部缓存目录）
            if (file.local.path !== targetPath) {
                fs.copyFileSync(file.local.path, targetPath);
            }
            
            console.log(`File saved to ${targetPath}`);
            
            io.emit('download_complete', { id: file.id, path: targetPath });
            activeDownloads.delete(file.id);
         } catch (err) {
           console.error('Error moving file:', err);
           activeDownloads.delete(file.id);
         }
       }
    }
  }
});

// --- Socket.IO 事件处理 ---

io.on('connection', (socket) => {
  // console.log('Client connected');
  socket.emit('auth_update', { state: currentAuthState });
  socket.emit('connection_state_update', { state: currentConnectionState });

  socket.on('get_auth_state', () => {
    socket.emit('auth_update', { state: currentAuthState });
    socket.emit('connection_state_update', { state: currentConnectionState });
  });

  socket.on('request_qr', async () => {
    try { 
        await client.invoke({ _: 'requestQrCodeAuthentication', other_user_ids: [] }); 
    } catch (e: any) { 
        const msg = e?.message || '';
        if (!msg.includes('Another authorization query has started')) {
            console.error('Request QR Error:', e);
        }
    }
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

  // --- REWRITTEN GET_FILES WITH INFINITE LOOP AND PROGRESS ---
  socket.on('get_files', async (chatId) => {
    try {
      let lastMessageId = 0;
      let totalFetched = 0;
      let totalFoundFiles = 0;
      const BATCH_SIZE = 100; // Telegram API limit per request

      console.log(`🚀 Starting full scan for chat ${chatId}`);
      // Notify client scan is starting
      socket.emit('scan_progress', { scanned: 0, found: 0, active: true });

      while (true) {
          const history = await client.invoke({
            _: 'getChatHistory',
            chat_id: chatId,
            limit: BATCH_SIZE,
            from_message_id: lastMessageId,
            offset: 0,
            only_local: false
          });

          if (!history.messages || history.messages.length === 0) {
              console.log(`✅ Scan finished for chat ${chatId}. Total messages processed: ${totalFetched}`);
              break; // No more messages
          }

          const filesBatch = history.messages.map(mapMessageToFile).filter(f => f !== null);
          
          if (filesBatch.length > 0) {
              totalFoundFiles += filesBatch.length;
              // Emit batch to frontend immediately
              socket.emit('files_batch', filesBatch);
          }
          
          lastMessageId = history.messages[history.messages.length - 1].id;
          totalFetched += history.messages.length;

          // Emit progress
          socket.emit('scan_progress', { scanned: totalFetched, found: totalFoundFiles, active: true });
          
          // Small delay to prevent hitting TDLib rate limits/locks and ensure UI can update
          await new Promise(resolve => setTimeout(resolve, 50)); 
      }
      
      // Notify frontend that scanning is done
      socket.emit('scan_progress', { scanned: totalFetched, found: totalFoundFiles, active: false });
      socket.emit('files_end');
      
    } catch (e) { 
        console.error('Get files error', e); 
        socket.emit('error', 'Error scanning chat history');
        socket.emit('files_end'); // Ensure UI stops spinner
    }
  });

  socket.on('download_file', async ({ fileId, fileName, totalSize }) => {
    try {
      activeDownloads.set(fileId, { 
        fileName, 
        totalSize, 
        startTime: Date.now(),
        lastDownloadedSize: 0,
        lastUpdateTime: Date.now(),
        speed: 0,
        status: 'pending'
      });

      await client.invoke({
        _: 'downloadFile',
        file_id: fileId,
        priority: 1, 
        offset: 0,
        limit: 0,
        synchronous: false
      });
    } catch (e) { console.error('Download error', e); }
  });

  socket.on('pause_download', async (fileId) => {
    try {
      await client.invoke({ _: 'cancelDownloadFile', file_id: fileId, only_if_pending: false });
      
      const task = activeDownloads.get(fileId);
      if (task) {
          task.status = 'paused';
          task.speed = 0;
          activeDownloads.set(fileId, task);
          io.emit('download_progress', {
             id: fileId,
             fileName: task.fileName,
             totalSize: task.totalSize,
             downloadedSize: task.lastDownloadedSize,
             progress: task.totalSize ? Math.round((task.lastDownloadedSize / task.totalSize) * 100) : 0,
             speed: 0,
             status: 'paused'
          });
      }
    } catch (e) { console.error('Pause error', e); }
  });

  socket.on('resume_download', async (fileId) => {
    try {
      await client.invoke({
        _: 'downloadFile',
        file_id: fileId,
        priority: 1, 
        offset: 0,
        limit: 0,
        synchronous: false
      });
      
      const task = activeDownloads.get(fileId);
      if (task) {
          task.status = 'downloading';
          task.lastUpdateTime = Date.now();
          activeDownloads.set(fileId, task);
      }
    } catch (e) { console.error('Resume error', e); }
  });

  socket.on('cancel_download', async (fileId) => {
    try {
      await client.invoke({ _: 'cancelDownloadFile', file_id: fileId, only_if_pending: false });
      activeDownloads.delete(fileId);
    } catch (e) { console.error(e); }
  });

  socket.on('open_file_folder', ({ path }) => {
    openFolder(path);
  });

  socket.on('select_directory', () => {
    let cmd = '';
    switch (os.platform()) {
      case 'win32':
        cmd = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.FolderBrowserDialog; if ($d.ShowDialog() -eq 'OK') { $d.SelectedPath }"`;
        break;
      case 'darwin':
        cmd = `osascript -e 'POSIX path of (choose folder)'`;
        break;
      case 'linux':
          cmd = `zenity --file-selection --directory`;
          break;
    }

    if (cmd) {
      exec(cmd, (error, stdout, stderr) => {
        if (!error && stdout) {
          const selectedPath = stdout.trim();
          if (selectedPath) {
            socket.emit('directory_selected', selectedPath);
          }
        }
      });
    }
  });

  socket.on('get_config', () => {
    socket.emit('config_update', appConfig);
  });

  socket.on('update_config', (newConfig) => {
    if (newConfig.downloadPath) {
      appConfig.downloadPath = newConfig.downloadPath;
      socket.emit('config_update', appConfig);
    }
  });

  socket.on('set_proxy', async (config) => {
    console.log('🔄 Received set_proxy request:', config);

    try {
        await client.invoke({ _: 'disableProxy' });
    } catch (e) {
        console.warn('⚠️ Failed to disable previous proxy (might be none):', e.message);
    }

    if (!config.enabled) {
      console.log('✅ Proxy disabled by user.');
      return;
    }

    let cleanHost = config.host.replace(/^https?:\/\//, '').replace(/^socks5:\/\//, '').trim();
    const port = Number(config.port);

    if (isNaN(port)) {
        console.error('❌ Invalid port number:', config.port);
        socket.emit('error', 'Invalid Port Number');
        return;
    }

    let typeClass = {};
    if (config.type === 'socks5') {
        typeClass = { 
            _: 'proxyTypeSocks5', 
            username: config.username || '', 
            password: config.password || '' 
        };
    } else if (config.type === 'http') {
        typeClass = { 
            _: 'proxyTypeHttp', 
            username: config.username || '', 
            password: config.password || '', 
            http_only: false 
        };
    } else if (config.type === 'mtproto') {
        typeClass = { 
            _: 'proxyTypeMtproto', 
            secret: config.secret || '' 
        };
    }
    
    try {
      console.log(`🔌 Applying Proxy: ${config.type.toUpperCase()}://${cleanHost}:${port}`);
      await client.invoke({ 
          _: 'addProxy', 
          server: cleanHost, 
          port: port, 
          enable: true, 
          type: typeClass 
      });
      console.log('✅ Proxy applied successfully!');
    } catch (e) { 
        console.error('❌ Proxy Error:', e);
        socket.emit('error', 'Proxy Error: ' + e.message); 
    }
  });
});

// 启动服务器
httpServer.listen(3001, () => {
  console.log('✅ Backend server running on http://localhost:3001');
  console.log('🔄 Connecting to Telegram Network...');
  client.connect();
});
