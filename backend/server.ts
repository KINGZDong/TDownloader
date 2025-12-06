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

let appConfig = {
  downloadPath: path.join(os.homedir(), 'Downloads', 'TDownloader')
};

// 确保初始目录存在
if (!fs.existsSync(appConfig.downloadPath)) {
  fs.mkdirSync(appConfig.downloadPath, { recursive: true });
}

// --- 状态管理 ---
let currentAuthState = 'LOGGED_OUT';
let currentConnectionState = 'unknown';
let currentScanRequestId = 0; // 全局扫描ID，用于终止旧的扫描进程

// 扩展 activeDownloads 结构以支持速度计算
interface DownloadState {
  fileName: string;
  totalSize: number;
  startTime: number;
  lastDownloadedSize: number;
  lastUpdateTime: number;
  speed: number;
  status: 'pending' | 'downloading' | 'paused' | 'completed' | 'error' | 'cancelled';
}
let activeDownloads = new Map<number, DownloadState>(); 

// --- 辅助函数 ---

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

function mapMessageToFile(message: any): any | null {
  if (!message.content) return null;
  
  const content = message.content;
  let fileData = null;
  let fileType = 'Document';
  let thumbnail = null;
  let text = '';

  if (content.caption && content.caption.text) {
      text = content.caption.text;
  }

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

  const isDownloaded = fileData.local.is_downloading_completed && fs.existsSync(fileData.local.path);

  return {
    id: fileData.id,
    messageId: message.id,
    groupId: message.media_album_id || '0', 
    uniqueId: fileData.remote.unique_id,
    name: content.document?.file_name || content.video?.file_name || content.audio?.file_name || `file_${fileData.id}.${fileType === 'Image' ? 'jpg' : 'dat'}`,
    text: text, 
    size: fileData.expected_size,
    date: message.date,
    type: fileType,
    thumbnail: thumbnail, 
    path: fileData.local.path, 
    isDownloading: fileData.local.is_downloading_active,
    isDownloaded: isDownloaded
  };
}

function openFolder(targetPath: string) {
  let p = targetPath;
  if (!fs.existsSync(p)) {
      if (fs.existsSync(appConfig.downloadPath)) {
          p = appConfig.downloadPath;
      } else {
          p = os.homedir();
      }
  }

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
      case 'authorizationStateReady': frontendState = 'READY'; break;
    }

    currentAuthState = frontendState;
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

    currentConnectionState = simpleState;
    console.log(`📡 Network Status: ${simpleState}`);
    io.emit('connection_state_update', { state: simpleState });
  }

  if (update._ === 'updateFile') {
    const file = update.file;
    let downloadInfo = activeDownloads.get(file.id);

    if (downloadInfo || file.local.is_downloading_active) {
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

       if (!file.local.is_downloading_active && !file.local.is_downloading_completed) {
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
  }
});

// --- Socket.IO Handlers ---

io.on('connection', (socket) => {
  socket.emit('auth_update', { state: currentAuthState });
  socket.emit('connection_state_update', { state: currentConnectionState });

  socket.on('get_auth_state', () => {
    socket.emit('auth_update', { state: currentAuthState });
    socket.emit('connection_state_update', { state: currentConnectionState });
  });

  socket.on('request_qr', async () => {
    try { await client.invoke({ _: 'requestQrCodeAuthentication', other_user_ids: [] }); } catch (e: any) {}
  });

  socket.on('login_phone', async (phone) => { try { await client.invoke({ _: 'setAuthenticationPhoneNumber', phone_number: phone }); } catch (e) { socket.emit('error', e.message); } });
  socket.on('login_code', async (code) => { try { await client.invoke({ _: 'checkAuthenticationCode', code: code }); } catch (e) { socket.emit('error', e.message); } });
  socket.on('login_password', async (password) => { try { await client.invoke({ _: 'checkAuthenticationPassword', password: password }); } catch (e) { socket.emit('error', e.message); } });
  socket.on('logout', async () => { try { await client.invoke({ _: 'logOut' }); } catch (e) {} });

  socket.on('get_chats', async () => {
    try {
      await client.invoke({ _: 'loadChats', chat_list: { _: 'chatListMain' }, limit: 20 });
      const result = await client.invoke({ _: 'getChats', chat_list: { _: 'chatListMain' }, limit: 50 });
      const chatsPromises = result.chat_ids.map(id => client.invoke({ _: 'getChat', chat_id: id }));
      const chatsRaw = await Promise.all(chatsPromises);
      socket.emit('chats_update', chatsRaw.map(mapChat));
    } catch (e) { console.error('Get chats error', e); }
  });

  // --- 核心：get_files (支持终止扫描、Limit限制、日期范围) ---
  socket.on('get_files', async (params) => {
    // 1. 生成新的 Request ID，这会立即使任何旧的扫描循环终止
    currentScanRequestId++;
    const thisRequestId = currentScanRequestId;

    const chatId = typeof params === 'object' ? params.chatId : params;
    const startDate = typeof params === 'object' ? params.startDate : undefined; 
    const endDate = typeof params === 'object' ? params.endDate : undefined; 
    // Limit: 如果前端传了 limit 参数（例如 500），则使用它。如果是 0 或 undefined，则视为无限。
    const limit = (typeof params === 'object' && params.limit) ? params.limit : 0;

    try {
      let lastMessageId = 0; 
      let totalFetched = 0;
      let totalFoundFiles = 0;
      const BATCH_SIZE = 100;

      console.log(`🚀 Scan [${thisRequestId}] started for chat ${chatId}. Range: ${startDate ? new Date(startDate * 1000).toISOString() : 'Start'} -> ${endDate ? new Date(endDate * 1000).toISOString() : 'Now'}. Limit: ${limit || 'Unlimited'}`);
      
      // 只有是最新的请求才发消息
      socket.emit('scan_progress', { scanned: 0, found: 0, active: true });

      if (endDate) {
          try {
             const seekMsg = await client.invoke({ _: 'getMessageByDate', chat_id: chatId, date: endDate });
             if (seekMsg && seekMsg.id) lastMessageId = seekMsg.id;
          } catch (e) { console.warn('Seek failed', e); }
      }

      while (true) {
          // 2. 检查是否被新的请求中断
          if (thisRequestId !== currentScanRequestId) {
              console.log(`🛑 Scan [${thisRequestId}] aborted by new request.`);
              break;
          }

          // 3. 检查是否达到 Limit (仅当 limit > 0 时)
          if (limit > 0 && totalFoundFiles >= limit) {
              console.log(`✅ Scan [${thisRequestId}] limit reached (${limit}). Stopping.`);
              break;
          }

          const history = await client.invoke({
            _: 'getChatHistory',
            chat_id: chatId,
            limit: BATCH_SIZE,
            from_message_id: lastMessageId,
            offset: 0,
            only_local: false
          });

          if (!history.messages || history.messages.length === 0) break;

          const oldestInBatch = history.messages[history.messages.length - 1];
          
          const validMessages = history.messages.filter((msg: any) => {
              if (startDate && msg.date < startDate) return false;
              if (endDate && msg.date > endDate + 86400) return false;
              return true;
          });

          const filesBatch = validMessages.map(mapMessageToFile).filter((f: any) => f !== null);
          
          if (filesBatch.length > 0) {
              // 4. 精确截断，确保不超过 limit
              let batchToSend = filesBatch;
              if (limit > 0 && (totalFoundFiles + filesBatch.length > limit)) {
                  const needed = limit - totalFoundFiles;
                  batchToSend = filesBatch.slice(0, needed);
              }

              totalFoundFiles += batchToSend.length;
              socket.emit('files_batch', batchToSend);
          }
          
          lastMessageId = history.messages[history.messages.length - 1].id;
          totalFetched += history.messages.length;

          socket.emit('scan_progress', { scanned: totalFetched, found: totalFoundFiles, active: true });
          
          // 如果消息时间已经早于开始时间，终止
          if (startDate && oldestInBatch.date < startDate) break;

          // 处理完这一批后再次检查 limit，立即跳出
          if (limit > 0 && totalFoundFiles >= limit) break;

          await new Promise(resolve => setTimeout(resolve, 50)); 
      }
      
      // 只有当这是最新的请求完成时，才发送结束信号
      if (thisRequestId === currentScanRequestId) {
          socket.emit('scan_progress', { scanned: totalFetched, found: totalFoundFiles, active: false });
          socket.emit('files_end');
      }
      
    } catch (e) { 
        console.error('Get files error', e); 
        socket.emit('error', 'Error scanning chat history');
        socket.emit('files_end'); 
    }
  });

  socket.on('download_file', async ({ fileId, fileName, totalSize }) => {
    try {
      activeDownloads.set(fileId, { fileName, totalSize, startTime: Date.now(), lastDownloadedSize: 0, lastUpdateTime: Date.now(), speed: 0, status: 'pending' });
      await client.invoke({ _: 'downloadFile', file_id: fileId, priority: 1, offset: 0, limit: 0, synchronous: false });
    } catch (e) { console.error('Download error', e); }
  });

  socket.on('pause_download', async (fileId) => {
    try {
      await client.invoke({ _: 'cancelDownloadFile', file_id: fileId, only_if_pending: false });
      const task = activeDownloads.get(fileId);
      if (task) {
          task.status = 'paused'; task.speed = 0; activeDownloads.set(fileId, task);
          io.emit('download_progress', { ...task, id: fileId, downloadedSize: task.lastDownloadedSize, progress: task.totalSize ? Math.round((task.lastDownloadedSize/task.totalSize)*100) : 0 });
      }
    } catch (e) {}
  });

  socket.on('resume_download', async (fileId) => {
    try {
      await client.invoke({ _: 'downloadFile', file_id: fileId, priority: 1, offset: 0, limit: 0, synchronous: false });
      const task = activeDownloads.get(fileId);
      if (task) { task.status = 'downloading'; task.lastUpdateTime = Date.now(); activeDownloads.set(fileId, task); }
    } catch (e) {}
  });

  socket.on('cancel_download', async (fileId) => {
    try {
      await client.invoke({ _: 'cancelDownloadFile', file_id: fileId, only_if_pending: false });
      try { await client.invoke({ _: 'deleteFile', file_id: fileId }); } catch (e) {}
      const task = activeDownloads.get(fileId);
      if (task) { io.emit('download_progress', { id: fileId, fileName: task.fileName, totalSize: task.totalSize, downloadedSize: 0, progress: 0, speed: 0, status: 'cancelled' }); }
      activeDownloads.delete(fileId);
    } catch (e) {}
  });
  
  socket.on('cancel_all_downloads', async () => {
      for (const [fileId, task] of activeDownloads.entries()) {
          if (['downloading', 'paused', 'pending'].includes(task.status)) {
              try {
                  await client.invoke({ _: 'cancelDownloadFile', file_id: fileId, only_if_pending: false });
                  try { await client.invoke({ _: 'deleteFile', file_id: fileId }); } catch(e) {}
                  io.emit('download_progress', { id: fileId, fileName: task.fileName, totalSize: task.totalSize, downloadedSize: 0, progress: 0, speed: 0, status: 'cancelled' });
              } catch (e) {}
          }
      }
      activeDownloads.clear();
  });

  socket.on('pause_all_downloads', async () => {
      for (const [fileId, task] of activeDownloads.entries()) {
          if (['downloading', 'pending'].includes(task.status)) {
              try {
                  await client.invoke({ _: 'cancelDownloadFile', file_id: fileId, only_if_pending: false });
                  task.status = 'paused'; task.speed = 0; activeDownloads.set(fileId, task);
                  io.emit('download_progress', { id: fileId, fileName: task.fileName, totalSize: task.totalSize, downloadedSize: task.lastDownloadedSize, progress: task.totalSize ? Math.round((task.lastDownloadedSize/task.totalSize)*100) : 0, speed: 0, status: 'paused' });
              } catch (e) {}
          }
      }
  });
  
  socket.on('resume_all_downloads', async () => {
      for (const [fileId, task] of activeDownloads.entries()) {
          if (task.status === 'paused') {
              try {
                  await client.invoke({ _: 'downloadFile', file_id: fileId, priority: 1, offset: 0, limit: 0, synchronous: false });
                  task.status = 'downloading'; task.lastUpdateTime = Date.now(); activeDownloads.set(fileId, task);
              } catch (e) {}
          }
      }
  });

  socket.on('open_file_folder', ({ path }) => openFolder(path));

  socket.on('select_directory', () => {
    let cmd = '';
    if (os.platform() === 'win32') cmd = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.FolderBrowserDialog; if ($d.ShowDialog() -eq 'OK') { $d.SelectedPath }"`;
    else if (os.platform() === 'darwin') cmd = `osascript -e 'POSIX path of (choose folder)'`;
    else cmd = `zenity --file-selection --directory`;

    if (cmd) {
      exec(cmd, (error, stdout) => {
        if (!error && stdout && stdout.trim()) socket.emit('directory_selected', stdout.trim());
      });
    }
  });

  socket.on('get_config', () => {
    socket.emit('config_update', appConfig);
  });

  socket.on('update_config', (newConfig) => {
    if (newConfig.downloadPath) appConfig.downloadPath = newConfig.downloadPath;
    socket.emit('config_update', appConfig);
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

httpServer.listen(3001, () => {
  console.log('✅ Backend server running on http://localhost:3001');
  console.log('🔄 Connecting to Telegram Network...');
  client.connect();
});
