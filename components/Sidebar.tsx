import React, { useState } from 'react';
import { Chat } from '../types';
import { Search, LogOut, User, Users, Megaphone, Hash } from 'lucide-react';
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
      case 'group': case 'basic_group': case 'supergroup': return <Users size={14} />;
      case 'channel': return <Megaphone size={14} />;
      default: return <User size={14} />;
    }
  };

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getAvatarColor = (id: number) => {
    const colors = [
      'from-blue-400 to-blue-600',
      'from-emerald-400 to-emerald-600',
      'from-purple-400 to-purple-600',
      'from-amber-400 to-amber-600',
      'from-rose-400 to-rose-600',
      'from-cyan-400 to-cyan-600',
    ];
    return colors[Math.abs(id) % colors.length];
  };

  return (
    <div className="w-80 h-screen bg-[#0f172a] text-slate-300 flex flex-col border-r border-slate-800 shadow-xl z-20 relative">
      {/* Brand Header */}
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
              T
            </div>
            <span className="font-bold text-white text-lg tracking-tight">Downloader</span>
          </div>
          <button 
            onClick={() => api.logout()} 
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-red-400 transition-all duration-200"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
        
        {/* Search Bar */}
        <div className="relative group">
          <Search className="absolute left-3 top-2.5 text-slate-500 transition-colors group-focus-within:text-blue-400" size={16} />
          <input 
            type="text"
            placeholder="Search chats..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-700 text-sm text-white pl-10 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-blue-500/50 focus:bg-slate-900 transition-all placeholder-slate-600"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-1 pb-4">
        {filteredChats.map(chat => (
          <div 
            key={chat.id}
            onClick={() => onSelectChat(chat.id)}
            className={`group p-3 cursor-pointer rounded-xl transition-all duration-200 flex gap-3 items-center relative overflow-hidden ${
              activeChatId === chat.id 
                ? 'bg-gradient-to-r from-blue-600/20 to-blue-600/5 ring-1 ring-blue-500/30' 
                : 'hover:bg-slate-800/50 hover:translate-x-1'
            }`}
          >
            {/* Active Indicator Line */}
            {activeChatId === chat.id && (
              <div className="absolute left-0 top-3 bottom-3 w-1 bg-blue-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
            )}

            {/* Avatar */}
            <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getAvatarColor(chat.id)} flex items-center justify-center text-white font-bold shrink-0 shadow-lg relative`}>
              {chat.title.substring(0, 1).toUpperCase()}
              {chat.type !== 'private' && (
                 <div className="absolute -bottom-1 -right-1 bg-slate-900 rounded-full p-0.5 border border-slate-800">
                    <div className="bg-slate-700 rounded-full p-1 text-slate-300">
                       {getIcon(chat.type)}
                    </div>
                 </div>
              )}
            </div>

            <div className="flex-1 min-w-0 ml-1">
              <div className="flex justify-between items-baseline mb-1">
                <h4 className={`text-sm font-medium truncate pr-2 ${activeChatId === chat.id ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>
                  {chat.title}
                </h4>
                <span className={`text-[10px] shrink-0 ${activeChatId === chat.id ? 'text-blue-300' : 'text-slate-500'}`}>
                  {formatTime(chat.timestamp)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-500 truncate max-w-[140px] group-hover:text-slate-400 transition-colors">
                  {chat.lastMessage || <span className="italic opacity-50">No messages</span>}
                </p>
                {chat.unreadCount > 0 && (
                  <span className="bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center shadow-lg shadow-blue-900/50">
                    {chat.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Footer User Info */}
      <div className="p-4 bg-[#0B1120] text-xs text-slate-500 border-t border-slate-800 flex justify-between items-center">
        <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span>Connected</span>
        </div>
        <span className="opacity-50">v1.0.0</span>
      </div>
    </div>
  );
};

export default Sidebar;