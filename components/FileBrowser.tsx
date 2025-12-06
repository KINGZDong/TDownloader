import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TdFile, FileType, Chat } from '../types';
import { Search, Filter, Music, Video, Image as ImageIcon, DownloadCloud, CheckSquare, Square, HardDrive, FileText, ArrowDownToLine, Calendar, RefreshCw, Loader2, Save, MoreHorizontal, Layers, AlertCircle, X } from 'lucide-react';
import { api } from '../services/api';

interface FileBrowserProps {
  chatId: number | null;
  chats: Chat[];
}

// Custom Date Input Component
const DateInput: React.FC<{ 
  label: string, 
  value: {y: string, m: string, d: string}, 
  onChange: (val: {y: string, m: string, d: string}) => void 
}> = ({ label, value, onChange }) => {
  const yearRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);

  const handleChange = (part: 'y'|'m'|'d', val: string) => {
    // Only numbers
    if (val && !/^\d+$/.test(val)) return;
    
    // Limits
    if (part === 'm' && parseInt(val) > 12) val = '12';
    if (part === 'd' && parseInt(val) > 31) val = '31';
    
    const newVal = { ...value, [part]: val };
    onChange(newVal);

    // Auto focus logic
    if (part === 'y' && val.length === 4 && monthRef.current) monthRef.current.focus();
    if (part === 'm' && val.length === 2 && dayRef.current) dayRef.current.focus();
  };

  return (
    <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 px-2 py-1.5 rounded-xl text-slate-400 group focus-within:border-blue-500/50">
       <span className="text-[10px] font-bold text-slate-600 uppercase mr-1">{label}</span>
       <input 
         ref={yearRef}
         type="text" 
         maxLength={4}
         placeholder="YYYY" 
         className="w-9 bg-transparent border-none text-xs text-slate-200 focus:outline-none text-center font-mono placeholder-slate-700"
         value={value.y}
         onChange={(e) => handleChange('y', e.target.value)}
       />
       <span className="text-slate-600">/</span>
       <input 
         ref={monthRef}
         type="text" 
         maxLength={2}
         placeholder="MM"
         className="w-6 bg-transparent border-none text-xs text-slate-200 focus:outline-none text-center font-mono placeholder-slate-700"
         value={value.m}
         onChange={(e) => handleChange('m', e.target.value)}
       />
       <span className="text-slate-600">/</span>
       <input 
         ref={dayRef}
         type="text" 
         maxLength={2}
         placeholder="DD"
         className="w-6 bg-transparent border-none text-xs text-slate-200 focus:outline-none text-center font-mono placeholder-slate-700"
         value={value.d}
         onChange={(e) => handleChange('d', e.target.value)}
       />
    </div>
  );
};

// Message Group Card Component
const MessageCard: React.FC<{
    group: { id: string; files: TdFile[]; text?: string; date: number };
    selectedFiles: number[];
    toggleSelection: (id: number) => void;
    onDownloadFile: (id: number, name: string, size: number) => void;
}> = ({ group, selectedFiles, toggleSelection, onDownloadFile }) => {
    
    const handleDownloadAll = () => {
        group.files.forEach(f => onDownloadFile(f.id, f.name, f.size));
    };

    const handleSaveText = () => {
        if (!group.text) return;
        const blob = new Blob([group.text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `message_${group.date}_text.txt`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const isAllSelected = group.files.every(f => selectedFiles.includes(f.id));
    
    const toggleGroupSelection = () => {
        if (isAllSelected) {
            group.files.forEach(f => {
                if (selectedFiles.includes(f.id)) toggleSelection(f.id);
            });
        } else {
             group.files.forEach(f => {
                if (!selectedFiles.includes(f.id)) toggleSelection(f.id);
            });
        }
    };

    const formatSize = (bytes: number) => {
        const mb = bytes / 1024 / 1024;
        return mb < 1 ? `${(bytes/1024).toFixed(1)} KB` : `${mb.toFixed(1)} MB`;
    };

    const getFileIcon = (type: FileType) => {
        switch(type) {
          case FileType.IMAGE: return <ImageIcon size={20} className="text-purple-400" />;
          case FileType.VIDEO: return <Video size={20} className="text-rose-400" />;
          case FileType.MUSIC: return <Music size={20} className="text-amber-400" />;
          default: return <FileText size={20} className="text-blue-400" />;
        }
    };
    
    return (
        <div className="bg-[#151e32] border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition-colors animate-fade-in flex flex-col">
            {/* Card Header */}
            <div className="bg-slate-900/50 p-3 flex justify-between items-center border-b border-slate-800/50">
                <div className="flex items-center gap-3">
                     <button onClick={toggleGroupSelection} className={`p-1 rounded hover:bg-slate-800 ${isAllSelected ? 'text-blue-500' : 'text-slate-500'}`}>
                        {isAllSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                     </button>
                     <span className="text-xs font-mono text-slate-500">
                         {new Date(group.date * 1000).toLocaleString()}
                     </span>
                </div>
                <button 
                  onClick={handleDownloadAll}
                  className="text-xs bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white px-2 py-1 rounded transition-colors flex items-center gap-1 font-medium"
                >
                    <DownloadCloud size={12} /> Download All
                </button>
            </div>

            {/* Content Body */}
            <div className="p-4 flex flex-col gap-4">
                {/* Text Section */}
                {group.text && (
                    <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 relative group/text">
                        <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto custom-scrollbar">
                            {group.text}
                        </p>
                        <button 
                          onClick={handleSaveText}
                          className="absolute top-2 right-2 p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded opacity-0 group-hover/text:opacity-100 transition-opacity"
                          title="Save Text as .txt"
                        >
                            <Save size={14} />
                        </button>
                    </div>
                )}

                {/* Media Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {group.files.map(file => {
                        const imageUrl = file.thumbnail ? `data:image/jpeg;base64,${file.thumbnail}` : null;
                        const isSelected = selectedFiles.includes(file.id);

                        return (
                            <div 
                                key={file.id} 
                                onClick={() => toggleSelection(file.id)}
                                className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer group/file border ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-700 bg-slate-800'}`}
                            >
                                {imageUrl ? (
                                    <div className="w-full h-full relative">
                                        <img src={imageUrl} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/file:opacity-100 transition-opacity"></div>
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-slate-800">
                                        {getFileIcon(file.type)}
                                    </div>
                                )}
                                
                                {/* Selection Check */}
                                <div className={`absolute top-2 left-2 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover/file:opacity-100'} transition-opacity`}>
                                     <div className={`w-5 h-5 rounded border bg-slate-900 flex items-center justify-center ${isSelected ? 'border-blue-500 text-blue-500' : 'border-slate-500 text-slate-500'}`}>
                                         {isSelected && <CheckSquare size={12} />}
                                     </div>
                                </div>

                                {/* Single DL Button */}
                                <div className="absolute bottom-2 right-2 opacity-0 group-hover/file:opacity-100 transition-opacity">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); onDownloadFile(file.id, file.name, file.size); }}
                                      className="p-1.5 bg-slate-900/80 hover:bg-blue-600 text-white rounded-lg backdrop-blur-sm"
                                    >
                                        <ArrowDownToLine size={14} />
                                    </button>
                                </div>
                                
                                {/* File Info Badge */}
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6 pointer-events-none">
                                    <p className="text-[10px] text-slate-300 truncate font-mono">{file.name}</p>
                                    <p className="text-[9px] text-slate-400">{formatSize(file.size)}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const FileBrowser: React.FC<FileBrowserProps> = ({ chatId, chats }) => {
  const [files, setFiles] = useState<TdFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanStatus, setScanStatus] = useState({ scanned: 0, found: 0, active: false });
  const [isLimited, setIsLimited] = useState(true);
  
  // Filters
  const [filterType, setFilterType] = useState<FileType>(FileType.ALL);
  const [searchQuery, setSearchQuery] = useState('');
  const [minSize, setMinSize] = useState(0); // in MB
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);
  
  // Custom Date State
  const [startD, setStartD] = useState({y: '', m: '', d: ''});
  const [endD, setEndD] = useState({y: '', m: '', d: ''});

  const activeChat = chats.find(c => c.id === chatId);

  const fetchFiles = (forceAll: boolean = false, customStart?: number, customEnd?: number) => {
      if (!chatId) return;
      
      setLoading(true);
      setFiles([]); 
      setSelectedFiles([]);
      setScanStatus({ scanned: 0, found: 0, active: true });
      
      let startTs = customStart;
      let endTs = customEnd;

      // If no custom dates passed, try to read from state
      if (startTs === undefined && startD.y && startD.m && startD.d && startD.y.length===4 && startD.m.length===2 && startD.d.length===2) {
           startTs = Math.floor(new Date(parseInt(startD.y), parseInt(startD.m)-1, parseInt(startD.d)).getTime() / 1000);
      }
      if (endTs === undefined && endD.y && endD.m && endD.d && endD.y.length===4 && endD.m.length===2 && endD.d.length===2) {
           endTs = Math.floor(new Date(parseInt(endD.y), parseInt(endD.m)-1, parseInt(endD.d), 23, 59, 59).getTime() / 1000);
      }

      // Logic:
      // 1. If forceAll is true -> Limit 0 (Unlimited)
      // 2. If dates are provided (filtered) -> Limit 0 (Unlimited)
      // 3. Default -> Limit 500
      
      const hasDateFilter = startTs !== undefined || endTs !== undefined;
      const limit = (forceAll || hasDateFilter) ? 0 : 500;
      
      setIsLimited(limit > 0);
      
      api.getFiles(chatId, startTs, endTs, limit);
  };

  useEffect(() => {
    // When Chat ID changes, we do a default fetch (Limited 500, no date filters)
    // We also want to reset the date inputs to avoid confusion, or keep them?
    // User expectation usually: switch chat -> see recent files.
    if (chatId) {
        // Reset dates visual state? Optional. Let's keep them but NOT use them unless user explicitly asks?
        // Actually, if dates are set, user probably expects them to apply to new chat.
        // But the requirement says "Limit 500 is only when clicking the group". 
        // This implies resetting to "Default View".
        
        // Let's reset dates for a fresh start in new chat
        setStartD({y: '', m: '', d: ''});
        setEndD({y: '', m: '', d: ''});
        
        // Fetch with default 500 limit
        fetchFiles(false, undefined, undefined);
    }
  }, [chatId]); 

  // Auto-fetch when dates become valid
  useEffect(() => {
      const startValid = startD.y.length===4 && startD.m.length===2 && startD.d.length===2;
      const endValid = endD.y.length===4 && endD.m.length===2 && endD.d.length===2;
      
      // Only auto-trigger if BOTH are set (range) or strictly valid dates
      if (chatId && startValid && endValid) {
          fetchFiles(false); // fetchFiles logic will see the dates and set limit to 0
      }
  }, [startD, endD]);


  useEffect(() => {
      // Setup listeners
      const handleFilesUpdate = (newFiles: TdFile[]) => {
        setFiles(newFiles);
        setLoading(false);
      };
      const handleFilesBatch = (newBatch: TdFile[]) => {
        setFiles(prev => [...prev, ...newBatch]);
      };
      const handleScanProgress = (status: { scanned: number, found: number, active: boolean }) => {
          setScanStatus(status);
          if (status.active) setLoading(true);
      };
      const handleFilesEnd = () => {
        setLoading(false);
        setScanStatus(prev => ({ ...prev, active: false }));
      };

      api.on('files_update', handleFilesUpdate);
      api.on('files_batch', handleFilesBatch);
      api.on('scan_progress', handleScanProgress);
      api.on('files_end', handleFilesEnd);

      return () => {
        api.off('files_update', handleFilesUpdate);
        api.off('files_batch', handleFilesBatch);
        api.off('scan_progress', handleScanProgress);
        api.off('files_end', handleFilesEnd);
      };
  }, []);

  // Filtering & Grouping Logic
  const groupedMessages = useMemo(() => {
    // 1. Filter
    const filtered = files.filter(file => {
        const matchesType = filterType === FileType.ALL || file.type === filterType;
        const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase()) || (file.text && file.text.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesSize = (file.size / 1024 / 1024) >= minSize;
        return matchesType && matchesSearch && matchesSize;
    });

    // 2. Group
    const groups: Record<string, { id: string, files: TdFile[], text?: string, date: number }> = {};
    
    filtered.forEach(file => {
        const key = (file.groupId && file.groupId !== '0') ? file.groupId : String(file.messageId);
        
        if (!groups[key]) {
            groups[key] = {
                id: key,
                files: [],
                text: file.text,
                date: file.date
            };
        }
        
        if (file.text && (!groups[key].text || file.text.length > groups[key].text!.length)) {
            groups[key].text = file.text;
        }

        groups[key].files.push(file);
    });

    return Object.values(groups).sort((a, b) => b.date - a.date);
  }, [files, filterType, searchQuery, minSize]);


  const toggleSelection = (id: number) => {
    if (selectedFiles.includes(id)) {
      setSelectedFiles(selectedFiles.filter(fid => fid !== id));
    } else {
      setSelectedFiles([...selectedFiles, id]);
    }
  };

  const handleSelectAll = () => {
    const allVisibleIds = groupedMessages.flatMap(g => g.files.map(f => f.id));
    
    if (selectedFiles.length === allVisibleIds.length && allVisibleIds.length > 0) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(allVisibleIds);
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

  const handleClearDates = () => {
      setStartD({y: '', m: '', d: ''});
      setEndD({y: '', m: '', d: ''});
      // Fetch default 500 when clearing dates?
      fetchFiles(false, undefined, undefined);
  };

  if (!chatId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0B1120] text-slate-400 p-8 text-center animate-fade-in">
        <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center mb-6 shadow-inner border border-slate-800">
           <DownloadCloud size={48} className="text-slate-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-200 mb-2">Ready to explore</h2>
        <p className="max-w-md text-slate-500">Select a chat from the sidebar to start browsing and downloading media files securely.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#0B1120] relative">
      {/* Glassmorphism Header */}
      <div className="bg-[#0f172a]/90 backdrop-blur-md border-b border-slate-800 px-8 py-5 shadow-sm z-10 sticky top-0 transition-all">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
             <div>
                <h2 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-3">
                    {activeChat?.title}
                    {isLimited && !loading && (
                        <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                            <AlertCircle size={10} />
                            LIMIT 500
                        </div>
                    )}
                </h2>
                <div className="flex gap-2 text-sm text-slate-500 mt-1 items-center">
                    <span className="font-medium text-slate-400">{groupedMessages.length}</span> messages shown
                    {scanStatus.active && (
                        <div className="flex items-center gap-1.5 ml-2 text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full animate-pulse">
                            <Loader2 size={10} className="animate-spin" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Scanning...</span>
                        </div>
                    )}
                </div>
             </div>
          </div>
          
          <div className="flex gap-3">
             <button 
               onClick={handleDownloadSelected}
               disabled={selectedFiles.length === 0}
               className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm transform active:scale-95 ${selectedFiles.length > 0 ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/25' : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'}`}
             >
                <ArrowDownToLine size={18} />
                Download {selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}
             </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-4 items-center flex-wrap">
            {/* Search */}
            <div className="relative group">
              <Search className="absolute left-3 top-2.5 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Search files or caption..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 focus:bg-slate-800 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none w-64 transition-all placeholder-slate-600"
              />
            </div>

            {/* Type Tabs */}
            <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl">
              {Object.values(FileType).map(type => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${filterType === type ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
                >
                  {type}
                </button>
              ))}
            </div>
            
            {/* Custom Manual Date Picker + Fetch All */}
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 relative">
                    <DateInput label="Start" value={startD} onChange={setStartD} />
                    <span className="text-slate-600">-</span>
                    <DateInput label="End" value={endD} onChange={setEndD} />
                    {(startD.y || endD.y) && (
                        <button 
                            onClick={handleClearDates}
                            className="absolute -right-6 text-slate-600 hover:text-slate-400"
                            title="Clear Dates"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
                
                <button 
                  onClick={() => fetchFiles(true)}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 p-2 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm ml-4"
                  title="Ignore limits and fetch complete history"
                >
                    <Layers size={16} />
                    <span className="text-xs font-bold px-1">Load All</span>
                </button>
            </div>
          </div>

          <div className="flex gap-4 items-center">
             {/* Select All */}
             <button 
               onClick={handleSelectAll}
               className="flex items-center gap-2 text-sm text-slate-500 hover:text-blue-400 transition-colors px-2 py-1 rounded-lg hover:bg-slate-900"
             >
               <span className="font-medium">Select All Visible</span>
             </button>

             {/* Size Filter */}
             <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-sm text-slate-400 shadow-sm">
                <HardDrive size={16} className="text-slate-600" />
                <div className="flex flex-col">
                   <span className="text-[10px] uppercase font-bold text-slate-600 tracking-wider">Min Size</span>
                   <div className="flex items-center gap-2">
                      <input 
                        type="range" 
                        min="0" 
                        max="50" 
                        value={minSize} 
                        onChange={e => setMinSize(parseInt(e.target.value))}
                        className="w-20 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                      <span className="font-mono text-xs w-10 text-right">{minSize} MB</span>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Message Card List */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar pb-32 space-y-6">
        {files.length === 0 && loading ? (
          <div className="flex flex-col justify-center items-center h-64 animate-fade-in">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-800 border-t-blue-600 mb-4"></div>
            <p className="text-slate-500 font-medium">Scanning chat history...</p>
            {isLimited && <p className="text-slate-600 text-xs mt-2">Fetching recent 500 files</p>}
          </div>
        ) : groupedMessages.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-96 text-slate-500 animate-fade-in">
            <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mb-4 border border-slate-800">
               <Filter size={32} className="opacity-40" />
            </div>
            <p className="text-lg font-medium text-slate-400">No matching messages found</p>
            <p className="text-sm opacity-60">Try adjusting your filters or search query.</p>
          </div>
        ) : (
          <>
            {groupedMessages.map(group => (
                <MessageCard 
                    key={group.id} 
                    group={group} 
                    selectedFiles={selectedFiles}
                    toggleSelection={toggleSelection}
                    onDownloadFile={(id, name, size) => api.startDownload(id, name, size)}
                />
            ))}
            
            {loading && (
                <div className="py-8 flex justify-center items-center gap-3 text-slate-500 animate-pulse">
                    <RefreshCw size={18} className="animate-spin" />
                    <span className="text-sm font-medium">Scanning for more messages...</span>
                </div>
            )}
            
            {/* Limit reached indicator at bottom */}
            {!loading && isLimited && (
                <div className="py-8 flex flex-col justify-center items-center gap-2 text-slate-500 border-t border-slate-800/50 mt-4 pt-8">
                     <AlertCircle size={24} className="text-slate-600" />
                     <p className="text-sm font-medium">Showing recent 500 files</p>
                     <button 
                        onClick={() => fetchFiles(true)}
                        className="text-blue-400 hover:text-blue-300 text-xs font-bold uppercase tracking-wider hover:underline"
                     >
                        Click here to Load All History
                     </button>
                </div>
            )}
          </>
        )}
      </div>
      
      {/* Floating Scan Progress Bar (Fixed Bottom Center) */}
      {scanStatus.active && (
         <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900/90 backdrop-blur-md border border-slate-700 text-slate-200 px-6 py-3 rounded-full shadow-2xl z-30 flex items-center gap-4 animate-fade-in">
             <div className="flex items-center gap-2">
                 <Loader2 size={16} className="text-blue-400 animate-spin" />
                 <span className="text-sm font-semibold">Scanning</span>
             </div>
             <div className="h-4 w-px bg-slate-700"></div>
             <div className="text-xs space-x-3">
                 <span><span className="text-blue-400 font-bold">{scanStatus.scanned}</span> analyzed</span>
                 <span className="text-slate-600">•</span>
                 <span><span className="text-emerald-400 font-bold">{scanStatus.found}</span> found</span>
                 {isLimited && <span className="text-amber-500/50 ml-2 text-[10px] uppercase font-bold tracking-wider">Limit: 500</span>}
             </div>
         </div>
      )}
    </div>
  );
};

export default FileBrowser;
