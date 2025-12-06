import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TdFile, FileType, Chat } from '../types';
import { Search, Filter, Music, Video, Image as ImageIcon, DownloadCloud, CheckSquare, Square, HardDrive, FileText, ArrowDownToLine, Calendar, RefreshCw, Loader2, Save, MoreHorizontal, Layers, AlertCircle, X, ArrowRight, ArrowDown } from 'lucide-react';
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

// Internal Component: Thumbnail Handler
const FileThumbnail: React.FC<{ file: TdFile }> = ({ file }) => {
    const [hqThumbnail, setHqThumbnail] = useState<string | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        // Reset state when file ID changes
        setHqThumbnail(null);
        setIsLoaded(false);

        // If we have a thumbnail ID, request it
        if (file.thumbnailFileId) {
            api.requestThumbnail(file.thumbnailFileId);
        }

        // Listener for specific file
        const handleThumb = (data: { fileId: number, data: string }) => {
            if (data.fileId === file.thumbnailFileId) {
                setHqThumbnail(data.data);
                // We don't set isLoaded=true here, we wait for the img onLoad event
                // to ensures the browser has actually decoded the base64 data.
            }
        };

        api.on('thumbnail_ready', handleThumb);
        return () => api.off('thumbnail_ready', handleThumb);
    }, [file.id, file.thumbnailFileId]);

    const getFileIcon = (type: FileType) => {
        switch(type) {
          case FileType.IMAGE: return <ImageIcon size={24} className="text-purple-400" />;
          case FileType.VIDEO: return <Video size={24} className="text-rose-400" />;
          case FileType.MUSIC: return <Music size={24} className="text-amber-400" />;
          default: return <FileText size={24} className="text-blue-400" />;
        }
    };
    
    const hasMiniThumb = !!file.thumbnail;
    const hasHqThumb = !!hqThumbnail;

    // If no thumbnails at all (and no ID to request), show Icon
    if (!hasMiniThumb && !hasHqThumb && !file.thumbnailFileId) {
         return (
            <div className="w-full h-full flex items-center justify-center bg-slate-800">
                {getFileIcon(file.type)}
            </div>
        );
    }
    
    // Layered Rendering for Smooth Transition
    return (
        <div className="w-full h-full relative bg-slate-800 overflow-hidden">
             {/* Layer 1: Placeholder (Blurry Mini Thumbnail) - Fade out when HQ loaded */}
             {hasMiniThumb && (
                 <img 
                    src={`data:image/jpeg;base64,${file.thumbnail}`}
                    className={`absolute inset-0 w-full h-full object-cover blur-xl scale-110 transition-opacity duration-700 ${isLoaded ? 'opacity-0' : 'opacity-70'}`}
                    alt=""
                 />
             )}
             
             {/* Layer 2: Icon Fallback (while waiting for HQ if no mini thumb) */}
             {!hasMiniThumb && !hasHqThumb && (
                 <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-pulse opacity-50">
                        {getFileIcon(file.type)}
                    </div>
                 </div>
             )}

             {/* Layer 3: HQ Thumbnail (Fades in on top) */}
             {hasHqThumb && (
                 <img 
                    src={`data:image/jpeg;base64,${hqThumbnail}`}
                    alt={file.name}
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ease-in-out z-10 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                    onLoad={() => setIsLoaded(true)}
                 />
             )}
             
             {/* Overlay for hover effects */}
             <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/file:opacity-100 transition-opacity z-20"></div>
             
             {/* File Type Badge */}
             {file.type !== FileType.IMAGE && (
                 <div className="absolute top-2 right-2 bg-black/60 p-1.5 rounded-lg backdrop-blur-md z-30 shadow-lg">
                     {file.type === FileType.VIDEO ? <Video size={14} className="text-white"/> : <Music size={14} className="text-white"/>}
                 </div>
             )}
        </div>
    );
};

// Message Group Card Component
const MessageCard: React.FC<{
    group: { id: string; files: TdFile[]; text?: string; date: number };
    selectedFiles: number[];
    toggleSelection: (id: number) => void;
    onDownloadFile: (id: number, name: string, size: number) => void;
    forwardRef?: React.Ref<HTMLDivElement>;
}> = ({ group, selectedFiles, toggleSelection, onDownloadFile, forwardRef }) => {
    
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

    return (
        <div ref={forwardRef} data-date={group.date} className="bg-[#151e32] border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition-colors animate-fade-in flex flex-col mb-4">
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
                        const isSelected = selectedFiles.includes(file.id);

                        return (
                            <div 
                                key={file.id} 
                                onClick={() => toggleSelection(file.id)}
                                className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer group/file border ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-700 bg-slate-800'}`}
                            >
                                {/* Thumbnail Component handles request & display */}
                                <FileThumbnail file={file} />
                                
                                {/* Selection Check */}
                                <div className={`absolute top-2 left-2 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover/file:opacity-100'} transition-opacity z-40`}>
                                     <div className={`w-5 h-5 rounded border bg-slate-900 flex items-center justify-center ${isSelected ? 'border-blue-500 text-blue-500' : 'border-slate-500 text-slate-500'}`}>
                                         {isSelected && <CheckSquare size={12} />}
                                     </div>
                                </div>

                                {/* Single DL Button */}
                                <div className="absolute bottom-2 right-2 opacity-0 group-hover/file:opacity-100 transition-opacity z-40">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); onDownloadFile(file.id, file.name, file.size); }}
                                      className="p-1.5 bg-slate-900/80 hover:bg-blue-600 text-white rounded-lg backdrop-blur-sm"
                                    >
                                        <ArrowDownToLine size={14} />
                                    </button>
                                </div>
                                
                                {/* File Info Badge */}
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6 pointer-events-none z-30">
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

// Date Badge Component
const StickyDateBadge: React.FC<{ date: number | null }> = ({ date }) => {
    if (!date) return null;
    const d = new Date(date * 1000);
    const dateString = d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
    
    return (
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-40 pointer-events-none animate-fade-in transition-all">
             <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 text-slate-300 px-4 py-1.5 rounded-full shadow-xl text-xs font-semibold flex items-center gap-2">
                 <Calendar size={12} className="text-blue-400" />
                 {dateString}
             </div>
        </div>
    );
};

const FileBrowser: React.FC<FileBrowserProps> = ({ chatId, chats }) => {
  const [files, setFiles] = useState<TdFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanStatus, setScanStatus] = useState({ scanned: 0, found: 0, active: false });
  // Used for infinite scroll cursor
  const [lastMessageId, setLastMessageId] = useState<number>(0); 
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState<FileType>(FileType.ALL);
  const [searchInputValue, setSearchInputValue] = useState(''); 
  const [activeSearchQuery, setActiveSearchQuery] = useState(''); 
  const [minSize, setMinSize] = useState(0); 
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);
  
  // Custom Date State
  const [startD, setStartD] = useState({y: '', m: '', d: ''});
  const [endD, setEndD] = useState({y: '', m: '', d: ''});
  
  // Sticky Header State
  const [visibleDate, setVisibleDate] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const activeChat = chats.find(c => c.id === chatId);

  // --- API Methods ---
  const fetchFiles = (reset: boolean = false, customStart?: number, customEnd?: number, overrideQuery?: string, overrideType?: FileType) => {
      if (!chatId) return;
      
      setLoading(true);
      if (reset) {
          setFiles([]); 
          setSelectedFiles([]);
          setLastMessageId(0);
          setHasMore(true);
          // Small batch for initial load to be snappy (e.g., 20)
      }
      
      let startTs = customStart;
      let endTs = customEnd;

      // Date Filters from State
      if (startTs === undefined && startD.y.length === 4 && startD.m && startD.d) {
           startTs = Math.floor(new Date(parseInt(startD.y), parseInt(startD.m)-1, parseInt(startD.d)).getTime() / 1000);
      }
      if (endTs === undefined && endD.y.length === 4 && endD.m && endD.d) {
           endTs = Math.floor(new Date(parseInt(endD.y), parseInt(endD.m)-1, parseInt(endD.d), 23, 59, 59).getTime() / 1000);
      }
      
      const queryToUse = overrideQuery !== undefined ? overrideQuery : activeSearchQuery;
      const typeToUse = overrideType !== undefined ? overrideType : filterType;

      const fromId = reset ? 0 : lastMessageId;
      
      // Limit 20 per batch for infinite scroll
      const limit = 20; 
      
      api.on('services/api.ts', () => {}); // dummy ref
      api.getFiles(chatId, startTs, endTs, limit, queryToUse, typeToUse, fromId);
  };
  
  const handleManualSearch = () => {
      if (!chatId) return;
      setActiveSearchQuery(searchInputValue);
      fetchFiles(true, undefined, undefined, searchInputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleManualSearch();
  };

  // --- Effects ---

  // 1. Chat ID changed or Type changed -> Reset and Fetch
  useEffect(() => {
    if (chatId) {
        // Only reset search inputs on chat change, not type change
        if (activeSearchQuery === '' && searchInputValue === '') {
             // Keep filterType as is
        } else {
             // Maybe reset search? Optional. Let's keep it clean for new chat
             if (activeChat?.id !== chatId) {
                 setSearchInputValue('');
                 setActiveSearchQuery('');
             }
        }
        
        fetchFiles(true, undefined, undefined, activeSearchQuery, filterType);
    }
  }, [chatId, filterType]);

  // 3. Auto-fetch when dates become valid
  useEffect(() => {
      const startValid = startD.y.length === 4 && startD.m.length >= 1 && startD.d.length >= 1;
      const endValid = endD.y.length === 4 && endD.m.length >= 1 && endD.d.length >= 1;
      
      if (chatId && startValid && endValid) {
          fetchFiles(true); 
      }
  }, [startD, endD]);

  // 4. Socket Listeners
  useEffect(() => {
      const handleFilesBatch = (newBatch: TdFile[]) => {
        setLoading(false);
        if (newBatch.length === 0) {
            setHasMore(false);
            return;
        }

        // Update cursor for next fetch
        const lastFile = newBatch[newBatch.length - 1];
        setLastMessageId(lastFile.messageId);

        // Deduplication & Append
        setFiles(prev => {
            const existingIds = new Set(prev.map(f => f.id));
            const unique = newBatch.filter(f => !existingIds.has(f.id));
            return [...prev, ...unique];
        });
      };
      
      const handleScanProgress = (status: { scanned: number, found: number, active: boolean }) => {
          setScanStatus(status);
          if (status.active) setLoading(true);
      };
      
      const handleFilesEnd = () => {
        setLoading(false);
        setScanStatus(prev => ({ ...prev, active: false }));
        // If we received an end signal but no files, maybe we are done
      };

      api.on('files_batch', handleFilesBatch);
      api.on('scan_progress', handleScanProgress);
      api.on('files_end', handleFilesEnd);

      return () => {
        api.off('files_batch', handleFilesBatch);
        api.off('scan_progress', handleScanProgress);
        api.off('files_end', handleFilesEnd);
      };
  }, []);

  // --- Grouping Logic ---
  const groupedMessages = useMemo(() => {
    // We only filter by SIZE here, as Type and Search are handled by backend
    const filtered = files.filter(file => {
        const matchesSize = (file.size / 1024 / 1024) >= minSize;
        return matchesSize;
    });

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
  }, [files, minSize]);


  // --- Infinite Scroll & Date Detection ---
  const handleScroll = () => {
      if (!scrollContainerRef.current) return;
      const { scrollTop, scrollHeight, clientHeight, children } = scrollContainerRef.current;
      
      // 1. Infinite Load
      // Trigger when we are 200px from bottom
      if (scrollHeight - scrollTop - clientHeight < 200) {
          if (!loading && hasMore && files.length > 0) {
              fetchFiles(false); // Fetch next page
          }
      }

      // 2. Date Detection
      // Find the message card that is currently near the top of the viewport
      // We look for elements with data-date attribute
      // Since children includes other divs, we need to be careful.
      // A simple strategy: check elements from top.
      const threshold = scrollTop + 150; // Offset for header
      let foundDate = null;
      
      // We iterate through the groupedMessages to find which one corresponds to the scroll position
      // NOTE: Direct DOM traversal is more accurate for scroll position mapping
      const cards = scrollContainerRef.current.querySelectorAll('[data-date]');
      for (let i = 0; i < cards.length; i++) {
          const card = cards[i] as HTMLElement;
          if (card.offsetTop + card.clientHeight > scrollTop + 100) {
               // This card is visible or just about to be scrolled past
               foundDate = parseInt(card.getAttribute('data-date') || '0');
               break; 
          }
      }
      
      if (foundDate) setVisibleDate(foundDate);
  };


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
      {/* Sticky Date Badge */}
      <StickyDateBadge date={visibleDate} />

      {/* Glassmorphism Header */}
      <div className="bg-[#0f172a]/90 backdrop-blur-md border-b border-slate-800 px-8 py-5 shadow-sm z-10 sticky top-0 transition-all">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
             <div>
                <h2 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-3">
                    {activeChat?.title}
                    <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                        HISTORY
                    </div>
                </h2>
                <div className="flex gap-2 text-sm text-slate-500 mt-1 items-center">
                    <span className="font-medium text-slate-400">{files.length}</span> items loaded
                    {scanStatus.active && (
                        <div className="flex items-center gap-1.5 ml-2 text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full animate-pulse">
                            <Loader2 size={10} className="animate-spin" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Loading...</span>
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
            <div className="relative group flex items-center gap-2">
              <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search query..." 
                    value={searchInputValue}
                    onChange={e => setSearchInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 focus:bg-slate-800 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none w-64 transition-all placeholder-slate-600"
                  />
              </div>
              <button 
                onClick={handleManualSearch}
                className="p-2.5 bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white rounded-xl border border-slate-700 hover:border-blue-500 transition-colors"
                title="Search (Enter)"
              >
                  <ArrowRight size={16} />
              </button>
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
            
            {/* Custom Manual Date Picker */}
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

      {/* Message Card List (SCROLL CONTAINER) */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-8 custom-scrollbar pb-32 space-y-6 scroll-smooth"
      >
        {files.length === 0 && loading ? (
          <div className="flex flex-col justify-center items-center h-64 animate-fade-in">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-800 border-t-blue-600 mb-4"></div>
            <p className="text-slate-500 font-medium">Fetching history...</p>
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
            
            {loading && hasMore && (
                <div className="py-8 flex justify-center items-center gap-3 text-slate-500">
                    <RefreshCw size={18} className="animate-spin" />
                    <span className="text-sm font-medium">Loading older messages...</span>
                </div>
            )}
            
            {!hasMore && groupedMessages.length > 0 && (
                <div className="py-8 text-center text-slate-600 text-sm border-t border-slate-800/50 mt-4">
                     End of history
                </div>
            )}
          </>
        )}
      </div>
      
      {/* Scroll Down Hint (if content exists but user is at top) */}
      {files.length > 0 && !loading && (
           <div className="absolute bottom-6 right-8 pointer-events-none opacity-50">
               {/* Just a visual balance, maybe not needed if scrollbar is obvious */}
           </div>
      )}
    </div>
  );
};

export default FileBrowser;