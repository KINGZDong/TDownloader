import React, { useState } from 'react';
import { DownloadTask } from '../types';
import { ChevronUp, ChevronDown, X, Play, Pause, Trash2, FolderOpen, Download } from 'lucide-react';
import { api } from '../services/api';

interface DownloadManagerProps {
  tasks: DownloadTask[];
}

const DownloadManager: React.FC<DownloadManagerProps> = ({ tasks }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (tasks.length === 0) return null;

  const activeCount = tasks.filter(t => t.status === 'downloading' || t.status === 'pending').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;

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
    <div className={`fixed bottom-0 right-8 left-8 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.1)] rounded-t-xl transition-all duration-300 z-40 border border-slate-200 ${isExpanded ? 'h-96' : 'h-14'}`}>
      {/* Header */}
      <div 
        className="h-14 bg-slate-800 text-white rounded-t-xl flex items-center justify-between px-6 cursor-pointer hover:bg-slate-700 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          <Download size={20} className="text-blue-400" />
          <h3 className="font-semibold">Downloads</h3>
          <span className="text-xs bg-blue-600 px-2 py-0.5 rounded-full">
            {activeCount} Active / {completedCount} Done
          </span>
        </div>
        <div className="flex items-center gap-2">
           {isExpanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
        </div>
      </div>

      {/* Content */}
      <div className="h-[calc(100%-3.5rem)] overflow-y-auto p-4 bg-slate-50">
        <div className="flex justify-end mb-4">
           {completedCount > 0 && (
             <button 
               onClick={(e) => { e.stopPropagation(); api.clearCompleted(); }}
               className="text-xs flex items-center gap-1 text-slate-500 hover:text-red-500 transition-colors"
             >
               <Trash2 size={14} /> Clear Completed
             </button>
           )}
        </div>

        <div className="space-y-3">
          {tasks.map(task => (
            <div key={task.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3 overflow-hidden">
                   <div className={`p-2 rounded-lg ${task.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                      {task.status === 'completed' ? <FolderOpen size={20} /> : <Download size={20} />}
                   </div>
                   <div className="min-w-0">
                      <p className="font-medium text-sm text-slate-800 truncate" title={task.fileName}>{task.fileName}</p>
                      <p className="text-xs text-slate-500">
                        {formatSize(task.totalSize)} • {task.status === 'downloading' ? formatSpeed(task.speed) : task.status}
                      </p>
                   </div>
                </div>
                
                <div className="flex items-center gap-1">
                  {task.status === 'downloading' && (
                    <button onClick={() => api.pauseDownload(task.id)} className="p-1.5 hover:bg-slate-100 rounded text-slate-600">
                      <Pause size={16} />
                    </button>
                  )}
                  {task.status === 'paused' && (
                    <button onClick={() => api.resumeDownload(task.id)} className="p-1.5 hover:bg-slate-100 rounded text-slate-600">
                      <Play size={16} />
                    </button>
                  )}
                  {task.status !== 'completed' && (
                    <button onClick={() => api.cancelDownload(task.id)} className="p-1.5 hover:bg-red-50 rounded text-red-500">
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              {(task.status === 'downloading' || task.status === 'paused') && (
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${task.status === 'paused' ? 'bg-amber-400' : 'bg-blue-500'}`}
                    style={{ width: `${task.progress}%` }}
                  ></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DownloadManager;