import React, { useState, useEffect } from 'react';
import { TdFile, FileType, Chat } from '../types';
import { Search, Filter, Calendar, FileIcon, Music, Video, Image as ImageIcon, DownloadCloud, CheckSquare, Square, HardDrive } from 'lucide-react';
import { api } from '../services/api';

interface FileBrowserProps {
  chatId: number | null;
  chats: Chat[];
}

const FileBrowser: React.FC<FileBrowserProps> = ({ chatId, chats }) => {
  const [files, setFiles] = useState<TdFile[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [filterType, setFilterType] = useState<FileType>(FileType.ALL);
  const [searchQuery, setSearchQuery] = useState('');
  const [minSize, setMinSize] = useState(0); // in MB
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);

  const activeChat = chats.find(c => c.id === chatId);

  useEffect(() => {
    if (chatId) {
      setLoading(true);
      setFiles([]); 
      setSelectedFiles([]);
      
      // Request files from backend
      api.getFiles(chatId);
      
      // Setup temporary listener for file results
      const handleFilesUpdate = (newFiles: TdFile[]) => {
        setFiles(newFiles);
        setLoading(false);
      };

      api.on('files_update', handleFilesUpdate);

      return () => {
        api.off('files_update', handleFilesUpdate);
      };
    }
  }, [chatId]);

  // Filtering Logic
  const filteredFiles = files.filter(file => {
    const matchesType = filterType === FileType.ALL || file.type === filterType;
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSize = (file.size / 1024 / 1024) >= minSize;
    return matchesType && matchesSearch && matchesSize;
  });

  const toggleSelection = (id: number) => {
    if (selectedFiles.includes(id)) {
      setSelectedFiles(selectedFiles.filter(fid => fid !== id));
    } else {
      setSelectedFiles([...selectedFiles, id]);
    }
  };

  const handleSelectAll = () => {
    if (selectedFiles.length === filteredFiles.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(filteredFiles.map(f => f.id));
    }
  };

  const handleDownloadSelected = () => {
    selectedFiles.forEach(id => {
      const file = files.find(f => f.id === id);
      if (file) {
        api.startDownload(file.id, file.name, file.size);
      }
    });
    setSelectedFiles([]);
  };

  const formatSize = (bytes: number) => {
    const mb = bytes / 1024 / 1024;
    return mb < 1 ? `${(bytes/1024).toFixed(1)} KB` : `${mb.toFixed(1)} MB`;
  };

  const getFileIcon = (type: FileType) => {
    switch(type) {
      case FileType.IMAGE: return <ImageIcon size={24} className="text-purple-500" />;
      case FileType.VIDEO: return <Video size={24} className="text-red-500" />;
      case FileType.MUSIC: return <Music size={24} className="text-blue-500" />;
      default: return <FileIcon size={24} className="text-slate-500" />;
    }
  };

  if (!chatId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-slate-400">
        <DownloadCloud size={64} className="mb-4 opacity-50" />
        <h2 className="text-xl font-medium">Select a chat to view files</h2>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen bg-slate-50">
      {/* Top Bar: Chat Info & Filters */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm z-10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-slate-800">{activeChat?.title}</h2>
          <div className="flex gap-2 text-sm text-slate-500">
            <span>{filteredFiles.length} files found</span>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap gap-4 items-center">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Filter by name..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64"
            />
          </div>

          {/* Type Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-lg">
            {Object.values(FileType).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${filterType === type ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Size Filter */}
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-lg text-sm text-slate-600">
            <HardDrive size={16} />
            <span>Min: {minSize} MB</span>
            <input 
              type="range" 
              min="0" 
              max="50" 
              value={minSize} 
              onChange={e => setMinSize(parseInt(e.target.value))}
              className="w-24 h-1 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>
        </div>
        
        {/* Bulk Actions */}
        <div className="mt-4 flex items-center justify-between border-t pt-4 border-slate-100">
          <div className="flex items-center gap-3">
             <button 
               onClick={handleSelectAll}
               className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600"
             >
               {selectedFiles.length === filteredFiles.length && filteredFiles.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}
               Select All
             </button>
             {selectedFiles.length > 0 && (
               <span className="text-sm font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                 {selectedFiles.length} selected
               </span>
             )}
          </div>
          <button 
            onClick={handleDownloadSelected}
            disabled={selectedFiles.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedFiles.length > 0 ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
          >
            <DownloadCloud size={18} />
            Download Selected
          </button>
        </div>
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar pb-24">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Filter size={48} className="mb-4 opacity-30" />
            <p>No files match your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredFiles.map(file => (
              <div 
                key={file.id} 
                onClick={() => toggleSelection(file.id)}
                className={`group relative bg-white rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden ${selectedFiles.includes(file.id) ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 hover:border-blue-300 hover:shadow-md'}`}
              >
                {/* Thumbnail / Icon Area */}
                <div className="h-32 bg-slate-100 flex items-center justify-center relative">
                  {file.thumbnail ? (
                    <img src={`data:image/jpeg;base64,${file.thumbnail}`} alt={file.name} className="w-full h-full object-cover" />
                  ) : (
                    getFileIcon(file.type)
                  )}
                  {/* Overlay Checkbox */}
                  <div className={`absolute top-2 left-2 transition-opacity ${selectedFiles.includes(file.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <div className={`w-5 h-5 rounded border bg-white flex items-center justify-center ${selectedFiles.includes(file.id) ? 'border-blue-600' : 'border-slate-300'}`}>
                      {selectedFiles.includes(file.id) && <div className="w-3 h-3 bg-blue-600 rounded-sm" />}
                    </div>
                  </div>
                </div>

                {/* File Details */}
                <div className="p-3">
                   <div className="flex justify-between items-start mb-1">
                      <h3 className="text-sm font-medium text-slate-700 truncate w-full" title={file.name}>{file.name}</h3>
                   </div>
                   <div className="flex justify-between items-center text-xs text-slate-500">
                     <span>{formatSize(file.size)}</span>
                     <span>{new Date(file.date * 1000).toLocaleDateString()}</span>
                   </div>
                </div>
                
                {/* Hover Download Button */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  {!selectedFiles.includes(file.id) && (
                     <button 
                       onClick={(e) => { e.stopPropagation(); api.startDownload(file.id, file.name, file.size); }}
                       className="pointer-events-auto bg-white text-blue-600 p-2 rounded-full shadow-lg hover:scale-110 transition-transform"
                     >
                       <DownloadCloud size={20} />
                     </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileBrowser;