import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import FileBrowser from './components/FileBrowser';
import DownloadManager from './components/DownloadManager';
import AuthScreen from './components/AuthScreen';
import SettingsModal from './components/SettingsModal';
import { AuthState, Chat, DownloadTask, TdFile } from './types';
import { api } from './services/api';

const App: React.FC = () => {
  const [authState, setAuthState] = useState<AuthState>(AuthState.LOGGED_OUT);
  const [qrLink, setQrLink] = useState<string | undefined>();
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [downloads, setDownloads] = useState<DownloadTask[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Initialize
  useEffect(() => {
    // Listener Setup
    api.on('connection_status', (connected: boolean) => {
      console.log('Backend connection:', connected);
      if (connected) {
         api.checkAuthStatus();
      }
    });

    api.on('auth_update', (data: { state: AuthState, qrLink?: string }) => {
      console.log('Auth update:', data);
      setAuthState(data.state);
      if (data.qrLink) {
        setQrLink(data.qrLink);
      }
      setLoading(false);
    });

    api.on('chats_update', (newChats: Chat[]) => {
      setChats(newChats);
    });

    api.on('download_progress', (updatedTask: DownloadTask) => {
      setDownloads(prev => {
        const existing = prev.find(t => t.id === updatedTask.id);
        if (existing) {
          return prev.map(t => t.id === updatedTask.id ? updatedTask : t);
        } else {
          return [...prev, updatedTask];
        }
      });
    });

    api.on('download_complete', (data: { id: number }) => {
       // Optional: Notify user
    });

    // Initial check
    api.checkAuthStatus();
    
    // Cleanup
    return () => {
       // listeners cleanup if needed
    };
  }, []);

  // Fetch chats once logged in
  useEffect(() => {
    if (authState === AuthState.READY) {
      api.getChats();
    }
  }, [authState]);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-slate-900 flex items-center justify-center text-white flex-col gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <p>Connecting to TDLib backend...</p>
      </div>
    );
  }

  if (authState !== AuthState.READY) {
    return (
      <>
        <AuthScreen 
          initialState={authState}
          qrLink={qrLink}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
        <SettingsModal 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)} 
          mode="proxy"
        />
      </>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden font-sans">
      <Sidebar 
        chats={chats} 
        activeChatId={activeChatId} 
        onSelectChat={setActiveChatId}
        currentUser="User"
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      
      <FileBrowser 
        chatId={activeChatId} 
        chats={chats}
      />
      
      <DownloadManager tasks={downloads} />

      {/* Main Settings Modal (General) */}
      <SettingsModal 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)} 
          mode="general"
      />
    </div>
  );
};

export default App;
