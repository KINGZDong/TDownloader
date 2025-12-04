import React, { useState } from 'react';
import { ProxyConfig } from '../types';
import { X, Save, Server } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: ProxyConfig) => void;
  currentConfig?: ProxyConfig;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave, currentConfig }) => {
  const [config, setConfig] = useState<ProxyConfig>(currentConfig || {
    enabled: false,
    type: 'socks5',
    host: '127.0.0.1',
    port: 1080,
    username: '',
    password: '',
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-slate-800 p-4 flex justify-between items-center text-white">
          <div className="flex items-center gap-2">
            <Server size={20} />
            <h2 className="font-semibold text-lg">Network Settings</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-700 font-medium">Enable Proxy</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={config.enabled} 
                onChange={e => setConfig({...config, enabled: e.target.checked})} 
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className={`space-y-4 transition-opacity ${config.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Proxy Type</label>
              <select 
                value={config.type}
                onChange={e => setConfig({...config, type: e.target.value as any})}
                className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="socks5">SOCKS5</option>
                <option value="http">HTTP</option>
                <option value="mtproto">MTProto</option>
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-600 mb-1">Server Host</label>
                <input 
                  type="text" 
                  value={config.host}
                  onChange={e => setConfig({...config, host: e.target.value})}
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="127.0.0.1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Port</label>
                <input 
                  type="number" 
                  value={config.port}
                  onChange={e => setConfig({...config, port: parseInt(e.target.value)})}
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="1080"
                />
              </div>
            </div>

            {config.type !== 'mtproto' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Username (Optional)</label>
                  <input 
                    type="text" 
                    value={config.username || ''}
                    onChange={e => setConfig({...config, username: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Password (Optional)</label>
                  <input 
                    type="password" 
                    value={config.password || ''}
                    onChange={e => setConfig({...config, password: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            ) : (
               <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Secret</label>
                  <input 
                    type="text" 
                    value={config.secret || ''}
                    onChange={e => setConfig({...config, secret: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="MTProto Secret"
                  />
                </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
            Cancel
          </button>
          <button 
            onClick={() => { onSave(config); onClose(); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
          >
            <Save size={18} />
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;