import React, { useState, useEffect, useRef } from 'react';
import { TdFile, FileType, Chat } from '../types';
import { Search, Filter, Music, Video, Image as ImageIcon, DownloadCloud, CheckSquare, Square, HardDrive, FileText, ArrowDownToLine, Calendar, RefreshCw, Loader2 } from 'lucide-react';
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

const FileBrowser: React.FC<FileBrowserProps> = ({ chatId, chats }) => {
  const [files, setFiles] = useState<TdFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanStatus, setScanStatus] = useState({ scanned: 0, found: 0, active: false });
  
  // Filters
  const [filterType, setFilterType] = useState<FileType>(FileType.ALL);
  const [searchQuery, setSearchQuery] = useState('');
  const [minSize, setMinSize] = useState(0); // in MB
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);
  
  // Custom Date State
  const [startD, setStartD] = useState({y: '', m: '', d: ''});
  const [endD, setEndD] = useState({y: '', m: '', d: ''});

  const activeChat = chats.find(c => c.id === chatId);

  useEffect(() => {
    if (chatId) {
      setLoading(true);
      setFiles([]); 
      setSelectedFiles([]);
      setScanStatus({ scanned: 0, found: 0, active: true });
      
      api.getFiles(chatId);
      
      // Handle legacy single-update event (backup)
      const handleFilesUpdate = (newFiles: TdFile[]) => {
        setFiles(newFiles);
        setLoading(false);
      };

      // Handle batched updates for infinite loading
      const handleFilesBatch = (newBatch: TdFile[]) => {
        setFiles(prev => [...prev, ...newBatch]);
      };

      // Handle scan progress
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
    }
  }, [chatId]);

  // Filtering Logic
  const filteredFiles = files.filter(file => {
    const matchesType = filterType === FileType.ALL || file.type === filterType;
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSize = (file.size / 1024 / 1024) >= minSize;
    
    // Date Filtering
    let matchesDate = true;
    const fileDate = new Date(file.date * 1000);
    fileDate.setHours(0,0,0,0);

    if (startD.y && startD.m && startD.d) {
        const start = new Date(parseInt(startD.y), parseInt(startD.m) - 1, parseInt(startD.d));
        if (fileDate.getTime() < start.getTime()) matchesDate = false;
    }
    
    if (endD.y && endD.m && endD.d) {
        const end = new Date(parseInt(endD.y), parseInt(endD.m) - 1, parseInt(endD.d));
        if (fileDate.getTime() > end.getTime()) matchesDate = false;
    }

    return matchesType && matchesSearch && matchesSize && matchesDate;
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
      case FileType.IMAGE: return <ImageIcon size={28} className="text-purple-400" />;
      case FileType.VIDEO: return <Video size={28} className="text-rose-400" />;
      case FileType.MUSIC: return <Music size={28} className="text-amber-400" />;
      default: return <FileText size={28} className="text-blue-400" />;
    }
  };

  const getImageUrl = (file: TdFile) => {
    if (file.thumbnail) {
        return `data:image/jpeg;base64,${file.thumbnail}`;
    }
    return null;
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
                <h2 className="text-2xl font-bold text-slate-100 tracking-tight">{activeChat?.title}</h2>
                <div className="flex gap-2 text-sm text-slate-500 mt-1 items-center">
                    <span className="font-medium text-slate-400">{filteredFiles.length}</span> results found
                    {scanStatus.active && (
                        <div className="flex items-center gap-1.5 ml-2 text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full animate-pulse">
                            <Loader2 size={10} className="animate-spin" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Scanning History...</span>
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
                placeholder="Search files..." 
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
            
            {/* Custom Manual Date Picker */}
            <div className="flex items-center gap-2">
                <DateInput label="Start" value={startD} onChange={setStartD} />
                <span className="text-slate-600">-</span>
                <DateInput label="End" value={endD} onChange={setEndD} />
            </div>
          </div>

          <div className="flex gap-4 items-center">
             {/* Select All */}
             <button 
               onClick={handleSelectAll}
               className="flex items-center gap-2 text-sm text-slate-500 hover:text-blue-400 transition-colors px-2 py-1 rounded-lg hover:bg-slate-900"
             >
               {selectedFiles.length === filteredFiles.length && filteredFiles.length > 0 ? <CheckSquare size={18} className="text-blue-500" /> : <Square size={18} />}
               <span className="font-medium">Select All</span>
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

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar pb-32">
        {files.length === 0 && loading ? (
          <div className="flex flex-col justify-center items-center h-64 animate-fade-in">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-800 border-t-blue-600 mb-4"></div>
            <p className="text-slate-500 font-medium">Starting chat scan...</p>
          </div>
        ) : filteredFiles.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-96 text-slate-500 animate-fade-in">
            <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mb-4 border border-slate-800">
               <Filter size={32} className="opacity-40" />
            </div>
            <p className="text-lg font-medium text-slate-400">No matching files found</p>
            <p className="text-sm opacity-60">Try adjusting your filters or search query.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
            {filteredFiles.map((file, index) => {
              const imageUrl = getImageUrl(file);
              
              return (
              <div 
                key={file.id} 
                onClick={() => toggleSelection(file.id)}
                className={`group animate-fade-in relative bg-[#151e32] rounded-2xl transition-all duration-300 cursor-pointer overflow-hidden border ${selectedFiles.includes(file.id) ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20 translate-y-[-4px] border-blue-500' : 'border-slate-800/60 hover:shadow-xl hover:shadow-black/20 hover:translate-y-[-4px] hover:border-slate-700'}`}
              >
                {/* Thumbnail Area */}
                <div className={`h-40 flex items-center justify-center relative overflow-hidden ${imageUrl ? 'bg-black' : 'bg-slate-900/50'}`}>
                  {imageUrl ? (
                    <>
                       {/* Background Blur */}
                       <div className="absolute inset-0 bg-cover bg-center blur-xl opacity-50 scale-110" style={{ backgroundImage: `url(${imageUrl})` }}></div>
                       {/* Actual Image */}
                       <img 
                          src={imageUrl} 
                          alt={file.name} 
                          className="relative h-full w-full object-contain z-10 transition-transform duration-500 group-hover:scale-105" 
                          loading="lazy"
                        />
                    </>
                  ) : (
                    <div className="transform transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                       {getFileIcon(file.type)}
                    </div>
                  )}
                  
                  {/* Overlay Gradient */}
                  <div className={`absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 transition-opacity duration-300 ${selectedFiles.includes(file.id) ? 'opacity-100' : 'group-hover:opacity-100'}`}></div>

                  {/* Checkbox */}
                  <div className={`absolute top-3 left-3 transition-all duration-200 z-20 ${selectedFiles.includes(file.id) ? 'opacity-100 scale-100' : 'opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100'}`}>
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${selectedFiles.includes(file.id) ? 'bg-blue-600 border-blue-600' : 'bg-slate-900/90 border-slate-500 hover:border-blue-400'}`}>
                      {selectedFiles.includes(file.id) && <CheckSquare size={14} className="text-white" />}
                    </div>
                  </div>
                  
                  {/* Download Action (Hover) */}
                  <div className="absolute bottom-3 right-3 z-20 translate-y-10 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                     <button 
                       onClick={(e) => { e.stopPropagation(); api.startDownload(file.id, file.name, file.size); }}
                       className="bg-blue-600 text-white p-2.5 rounded-full shadow-lg hover:bg-blue-500 transition-colors"
                       title="Download Now"
                     >
                       <DownloadCloud size={18} />
                     </button>
                  </div>
                </div>

                {/* File Details */}
                <div className="p-4 relative z-10">
                   <div className="flex justify-between items-start mb-1.5">
                      <h3 className="text-sm font-semibold text-slate-200 truncate w-full pr-2" title={file.name}>{file.name}</h3>
                   </div>
                   <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                     <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-400 border border-slate-700/50">{formatSize(file.size)}</span>
                     <span>{new Date(file.date * 1000).toLocaleDateString()}</span>
                   </div>
                </div>
              </div>
            )})}
            
            {/* Loading Indicator at end of list */}
            {loading && (
                <div className="col-span-full py-8 flex justify-center items-center gap-3 text-slate-500 animate-pulse">
                    <RefreshCw size={18} className="animate-spin" />
                    <span className="text-sm font-medium">Scanning for more files...</span>
                </div>
            )}
          </div>
        )}
      </div>
      
      {/* Floating Scan Progress Bar (Fixed Bottom Center) */}
      {scanStatus.active && (
         <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900/90 backdrop-blur-md border border-slate-700 text-slate-200 px-6 py-3 rounded-full shadow-2xl z-30 flex items-center gap-4 animate-fade-in">
             <div className="flex items-center gap-2">
                 <Loader2 size={16} className="text-blue-400 animate-spin" />
                 <span className="text-sm font-semibold">Scanning History</span>
             </div>
             <div className="h-4 w-px bg-slate-700"></div>
             <div className="text-xs space-x-3">
                 <span><span className="text-blue-400 font-bold">{scanStatus.scanned}</span> msgs analyzed</span>
                 <span className="text-slate-600">•</span>
                 <span><span className="text-emerald-400 font-bold">{scanStatus.found}</span> files found</span>
             </div>
         </div>
      )}
    </div>
  );
};

export default FileBrowser;
