import React, { useState } from 'react';
import { DownloadTask } from '../types';
import { ChevronUp, ChevronDown, X, Play, Pause, Trash2, FolderOpen, Download, Activity, Settings as SettingsIcon } from 'lucide-react';
import { api } from '../services/api';
import SettingsModal from './SettingsModal';

interface DownloadManagerProps {
  tasks: DownloadTask[];
}

const DownloadManager: React.FC<DownloadManagerProps> = ({ tasks }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // Always show manager if there are active tasks, or if tasks list is not empty
  if (tasks.length === 0) return null;

  const activeCount = tasks.filter(t => t.status === 'downloading' || t.status === 'pending').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;

  const totalSpeed = tasks.reduce((acc, task) => {
    return acc + (task.status === 'downloading' && task.speed ? task.speed : 0);
  }, 0);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSec: number) => {
    return `${formatSize(bytesPerSec)}/s`;
  };

  return (
    <>
    <div className={`fixed bottom-6 right-6 w-96 bg-[#151e32]/95 backdrop-blur-xl shadow-2xl rounded-2xl border border-slate-700/50 transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1) z-50 overflow-hidden flex flex-col ${isExpanded ? 'h-[500px]' : 'h-16'}`}>
      
      {/* Header */}
      <div 
        className="h-16 bg-gradient-to-r from-slate-900 to-[#1e293b] text-white flex items-center justify-between px-5 cursor-pointer shrink-0 relative overflow-hidden group border-b border-slate-800"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        
        <div className="flex items-center gap-3 relative z-10">
          <div className="p-2 bg-white/10 rounded-lg">
             <Activity size={18} className={`${activeCount > 0 ? 'text-blue-400 animate-pulse' : 'text-slate-400'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm leading-tight text-slate-100">Downloads</h3>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
              {activeCount > 0 ? `${activeCount} in progress` : 'All tasks completed'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 relative z-10">
            {/* Total Speed Indicator */}
            {totalSpeed > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/20 border border-blue-500/30 rounded-md mr-1 shadow-sm">
                    <Activity size={12} className="text-blue-400 animate-pulse" />
                    <span className="text-xs font-mono font-semibold text-blue-300">
                        {formatSpeed(totalSpeed)}
                    </span>
                </div>
            )}

            <button 
              onClick={(e) => { e.stopPropagation(); setShowSettings(true); }}
              className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title="Settings"
            >
               <SettingsIcon size={16} />
            </button>
            <button className="p-1 rounded-full hover:bg-white/10 transition-colors">
               {isExpanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
            </button>
        </div>
      </div>

      {/* Content Area */}
      <div className={`flex-1 overflow-y-auto custom-scrollbar bg-[#0f172a]/50 p-4 space-y-3 transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
        
        {/* Toolbar */}
        {completedCount > 0 && (
           <div className="flex justify-between items-center px-1 mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Queue</span>
              <button 
                onClick={(e) => { e.stopPropagation(); api.clearCompleted(); }}
                className="text-xs flex items-center gap-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2 py-1 rounded transition-colors font-medium"
              >
                <Trash2 size={12} /> Clear Done
              </button>
           </div>
        )}

        {tasks.map(task => (
          <div key={task.id} className="bg-[#1e293b] p-4 rounded-xl shadow-sm border border-slate-700/50 group hover:border-slate-600 transition-all">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3 min-w-0">
                 <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${task.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                    {task.status === 'completed' ? <FolderOpen size={18} /> : <Download size={18} />}
                 </div>
                 <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-200 truncate pr-2" title={task.fileName}>{task.fileName}</p>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {task.status === 'downloading' 
                        ? <span className="text-blue-400">{formatSpeed(task.speed)}</span> 
                        : <span className="capitalize">{task.status}</span>
                      } • {formatSize(task.totalSize)}
                    </p>
                 </div>
              </div>
              
              {/* Controls */}
              <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                   <button 
                     onClick={() => api.openFileFolder(task.fileName)} 
                     className={`p-1.5 rounded-lg transition-colors ${task.status === 'completed' ? 'hover:bg-emerald-500/10 text-emerald-400' : 'hidden'}`}
                     title="Show in Folder"
                   >
                     <FolderOpen size={14} />
                   </button>


                {task.status === 'downloading' && (
                  <button onClick={() => api.pauseDownload(task.id)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors">
                    <Pause size={14} />
                  </button>
                )}
                {task.status === 'paused' && (
                  <button onClick={() => api.resumeDownload(task.id)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors">
                    <Play size={14} />
                  </button>
                )}
                {task.status !== 'completed' && (
                  <button onClick={() => api.cancelDownload(task.id)} className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-400 hover:text-red-300 transition-colors">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            {(task.status === 'downloading' || task.status === 'paused') && (
              <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden relative">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ease-out relative ${task.status === 'paused' ? 'bg-amber-400' : 'bg-blue-500'}`}
                  style={{ width: `${task.progress}%` }}
                >
                  {task.status === 'downloading' && <div className="absolute inset-0 download-stripe opacity-30"></div>}
                </div>
              </div>
            )}
            
            {task.status === 'completed' && (
              <div className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div> Downloaded successfully
              </div>
            )}
          </div>
        ))}
        
        {tasks.length === 0 && (
           <div className="text-center py-8 text-slate-600">
             <p className="text-sm">No active downloads</p>
           </div>
        )}
      </div>
    </div>

    {/* Settings Modal triggered from Download Manager - General Mode */}
    <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
        mode="general"
    />
    </>
  );
};

export default DownloadManager;