import React, { useState, useEffect } from 'react';
import { ProxyConfig } from '../types';
import { X, Save, Server, Folder, ExternalLink, MousePointerClick, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // We no longer need onSave passed from parent, we handle it internally per mode
  mode: 'proxy' | 'general';
}

// --- INTERNAL COMPONENT: PROXY SETTINGS ---
const ProxySettings: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [proxyConfig, setProxyConfig] = useState<ProxyConfig>({
    enabled: true,
    type: 'socks5',
    host: '127.0.0.1',
    port: 7890,
    username: '',
    password: '',
  });

  const handleSave = () => {
    api.setProxy(proxyConfig);
    onClose();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-slate-800 p-4 flex justify-between items-center text-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-300">
            <Server size={20} />
          </div>
          <h2 className="font-semibold text-lg">Network Connection</h2>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg">
          <X size={20} />
        </button>
      </div>

      <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white">
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-indigo-50 p-4 rounded-xl border border-indigo-100">
            <div>
               <span className="text-slate-800 font-bold block">Enable Proxy</span>
               <span className="text-xs text-slate-500">Use for connecting to Telegram in restricted regions</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={proxyConfig.enabled} 
                onChange={e => setProxyConfig({...proxyConfig, enabled: e.target.checked})} 
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div className={`space-y-4 transition-all duration-300 ${proxyConfig.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none grayscale'}`}>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Protocol</label>
              <div className="grid grid-cols-3 gap-2">
                 {['socks5', 'http', 'mtproto'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setProxyConfig({...proxyConfig, type: type as any})}
                      className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${proxyConfig.type === type ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                    >
                      {type.toUpperCase()}
                    </button>
                 ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-xs uppercase font-bold text-slate-500 mb-1.5 ml-1">Host / IP</label>
                <input 
                  type="text" 
                  value={proxyConfig.host}
                  onChange={e => setProxyConfig({...proxyConfig, host: e.target.value})}
                  className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
                  placeholder="127.0.0.1"
                />
              </div>
              <div>
                <label className="block text-xs uppercase font-bold text-slate-500 mb-1.5 ml-1">Port</label>
                <input 
                  type="number" 
                  value={proxyConfig.port}
                  onChange={e => setProxyConfig({...proxyConfig, port: parseInt(e.target.value)})}
                  className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
                  placeholder="1080"
                />
              </div>
            </div>

            {proxyConfig.type !== 'mtproto' ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase font-bold text-slate-500 mb-1.5 ml-1">Username</label>
                  <input 
                    type="text" 
                    value={proxyConfig.username || ''}
                    onChange={e => setProxyConfig({...proxyConfig, username: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase font-bold text-slate-500 mb-1.5 ml-1">Password</label>
                  <input 
                    type="password" 
                    value={proxyConfig.password || ''}
                    onChange={e => setProxyConfig({...proxyConfig, password: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    placeholder="Optional"
                  />
                </div>
              </div>
            ) : (
               <div>
                  <label className="block text-xs uppercase font-bold text-slate-500 mb-1.5 ml-1">Secret</label>
                  <input 
                    type="text" 
                    value={proxyConfig.secret || ''}
                    onChange={e => setProxyConfig({...proxyConfig, secret: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
                    placeholder="MTProto Secret"
                  />
                </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 bg-slate-50 border-t flex justify-end gap-3 shrink-0">
        <button onClick={onClose} className="px-5 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors text-sm font-medium">
          Cancel
        </button>
        <button 
          onClick={handleSave}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 transition-colors font-medium shadow-lg shadow-indigo-500/20 text-sm"
        >
          <CheckCircle2 size={18} />
          Apply Settings
        </button>
      </div>
    </div>
  );
};


// --- INTERNAL COMPONENT: GENERAL SETTINGS ---
const GeneralSettings: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [downloadPath, setDownloadPath] = useState('');

  useEffect(() => {
    // 1. Fetch initial config
    api.getAppConfig();

    // 2. Set up listeners
    const handleConfig = (cfg: { downloadPath: string }) => {
      if (cfg?.downloadPath) setDownloadPath(cfg.downloadPath);
    };
    
    const handleDirectorySelected = (path: string) => {
      setDownloadPath(path);
    };

    api.on('config_update', handleConfig);
    api.on('directory_selected', handleDirectorySelected);

    return () => { 
      api.off('config_update', handleConfig);
      api.off('directory_selected', handleDirectorySelected);
    };
  }, []);

  const handleSave = () => {
    api.updateAppConfig({ downloadPath });
    onClose();
  };

  const handleSelectFolder = () => {
      api.selectDirectory();
  };

  const handleOpenCurrentFolder = () => {
      api.openFileFolder(downloadPath);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-slate-800 p-4 flex justify-between items-center text-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg text-blue-300">
            <Folder size={20} />
          </div>
          <h2 className="font-semibold text-lg">App Preferences</h2>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg">
          <X size={20} />
        </button>
      </div>

      <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white">
         <div className="space-y-6">
            <div>
               <label className="block text-sm font-bold text-slate-700 mb-2">
                 Download Location
               </label>
               <div className="flex flex-col gap-3">
                   <div className="relative group">
                       <input 
                         type="text" 
                         value={downloadPath}
                         onChange={(e) => setDownloadPath(e.target.value)}
                         className="w-full border border-slate-300 rounded-lg pl-3 pr-10 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-600 font-mono bg-slate-50 transition-colors"
                         placeholder="/path/to/downloads"
                       />
                       <Folder className="absolute right-3 top-3 text-slate-400 group-focus-within:text-blue-500" size={16} />
                   </div>
                   
                   <div className="flex gap-3">
                       <button 
                         onClick={handleSelectFolder}
                         className="flex-1 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-blue-700 transition-colors flex items-center justify-center gap-2 font-semibold text-sm"
                       >
                           <MousePointerClick size={18} />
                           Browse System
                       </button>
                       <button 
                         onClick={handleOpenCurrentFolder}
                         className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-slate-600 transition-colors flex items-center justify-center gap-2"
                         title="Open in Explorer"
                       >
                           <ExternalLink size={18} />
                       </button>
                   </div>
               </div>
               <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100 text-xs text-blue-700 leading-relaxed">
                  Files downloaded from Telegram will be saved to this folder automatically.
               </div>
            </div>
         </div>
      </div>

      <div className="p-4 bg-slate-50 border-t flex justify-end gap-3 shrink-0">
        <button onClick={onClose} className="px-5 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors text-sm font-medium">
          Cancel
        </button>
        <button 
          onClick={handleSave}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors font-medium shadow-lg shadow-blue-500/20 text-sm"
        >
          <Save size={18} />
          Save Changes
        </button>
      </div>
    </div>
  );
};


// --- MAIN WRAPPER COMPONENT ---
const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, mode }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col h-auto max-h-[90vh]">
          {mode === 'proxy' ? (
              <ProxySettings onClose={onClose} />
          ) : (
              <GeneralSettings onClose={onClose} />
          )}
      </div>
    </div>
  );
};

export default SettingsModal;