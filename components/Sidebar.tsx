import React, { useState } from 'react';
import { Chat } from '../types';
import { Search, LogOut, User, Users, Megaphone } from 'lucide-react';
import { api } from '../services/api';

interface SidebarProps {
  chats: Chat[];
  activeChatId: number | null;
  onSelectChat: (id: number) => void;
  currentUser?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ chats, activeChatId, onSelectChat, currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredChats = chats.filter(c => c.title.toLowerCase().includes(searchTerm.toLowerCase()));

  const getIcon = (type: Chat['type']) => {
    switch (type) {
      case 'group': return <Users size={16} />;
      case 'channel': return <Megaphone size={16} />;
      default: return <User size={16} />;
    }
  };

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="w-80 h-screen bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800">
      {/* Header */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div className="font-bold text-white text-lg tracking-tight">TDownloader</div>
          <button 
            onClick={() => api.logout()} 
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
          <input 
            type="text"
            placeholder="Search chats..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800 text-sm text-white pl-9 pr-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-500"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filteredChats.map(chat => (
          <div 
            key={chat.id}
            onClick={() => onSelectChat(chat.id)}
            className={`p-3 cursor-pointer transition-colors flex gap-3 items-center border-b border-slate-800/50 hover:bg-slate-800 ${activeChatId === chat.id ? 'bg-blue-600/10 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'}`}
          >
            {/* Avatar Placeholder */}
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shrink-0 ${['bg-indigo-500', 'bg-pink-500', 'bg-green-500', 'bg-blue-500', 'bg-orange-500'][chat.id % 5]}`}>
              {chat.title.charAt(0).toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline mb-0.5">
                <h4 className={`text-sm font-medium truncate pr-2 ${activeChatId === chat.id ? 'text-blue-400' : 'text-slate-200'}`}>
                  {chat.title}
                </h4>
                <span className="text-xs text-slate-500 shrink-0">{formatTime(chat.timestamp)}</span>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-400 truncate max-w-[140px]">
                  {chat.lastMessage}
                </p>
                {chat.unreadCount > 0 && (
                  <span className="bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                    {chat.unreadCount}
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-600">
                 {getIcon(chat.type)} 
                 <span className="capitalize">{chat.type}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Footer User Info */}
      <div className="p-3 bg-slate-950 text-xs text-slate-500 border-t border-slate-800 flex justify-between">
        <span>v1.0.0 (Beta)</span>
        <span>{currentUser || 'Offline'}</span>
      </div>
    </div>
  );
};

export default Sidebar;