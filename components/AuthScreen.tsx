import React, { useState, useEffect, useRef } from 'react';
import { Settings, Phone, QrCode, ArrowRight, RefreshCw, Smartphone, Download, Lock, Wifi, WifiOff } from 'lucide-react';
import { AuthState } from '../types';
import { api } from '../services/api';

interface AuthScreenProps {
  initialState: AuthState;
  qrLink?: string;
  onOpenSettings: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ initialState, qrLink, onOpenSettings }) => {
  const [method, setMethod] = useState<'qr' | 'phone'>('qr');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentQr, setCurrentQr] = useState<string | undefined>(qrLink);
  const [connectionState, setConnectionState] = useState<string>('unknown');
  
  // Ref to track if QR code has been requested to prevent duplicate calls in Strict Mode
  const qrRequestSent = useRef(false);

  useEffect(() => {
    setCurrentQr(qrLink);
  }, [qrLink]);

  // Listen for connection status updates
  useEffect(() => {
    const handleConnectionState = (state: string) => {
        setConnectionState(state);
    };
    api.on('connection_state_update', handleConnectionState);
    return () => {
        api.off('connection_state_update', handleConnectionState);
    };
  }, []);

  useEffect(() => {
    // Only request QR if we are in QR mode, logged out, and haven't sent a request yet
    if (method === 'qr' && initialState === AuthState.LOGGED_OUT) {
      if (!qrRequestSent.current) {
        api.requestQrCode();
        qrRequestSent.current = true;
      }
    } else {
        // Reset the ref if we switch methods or state changes (e.g. to QR_CODE state)
        // Check strict inequality to avoid flapping
        if (method !== 'qr') {
            qrRequestSent.current = false;
        }
    }
  }, [method, initialState]);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await api.sendPhoneNumber(phone);
    setLoading(false);
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await api.verifyCode(code);
    setLoading(false);
  };
  
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await api.verifyPassword(password);
    setLoading(false);
  };

  const isAwaitingCode = initialState === AuthState.AWAITING_CODE;
  const isAwaitingPassword = initialState === AuthState.AWAITING_PASSWORD;
  const showQr = method === 'qr' && !isAwaitingCode && !isAwaitingPassword;
  const showPhoneInput = method === 'phone' && !isAwaitingCode && !isAwaitingPassword;

  // Connection Badge helper
  const getConnectionBadge = () => {
    switch (connectionState) {
        case 'ready':
            return (
                <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                    <Wifi size={14} className="text-emerald-500" />
                    <span className="text-xs font-medium text-emerald-400">Connected to Telegram</span>
                </div>
            );
        case 'connecting':
        case 'connecting_to_proxy':
        case 'updating':
            return (
                <div className="flex items-center gap-2 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                    <RefreshCw size={14} className="text-amber-500 animate-spin" />
                    <span className="text-xs font-medium text-amber-400">
                        {connectionState === 'connecting_to_proxy' ? 'Connecting to Proxy...' : 'Connecting...'}
                    </span>
                </div>
            );
        case 'waiting_for_network':
            return (
                <div className="flex items-center gap-2 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
                    <WifiOff size={14} className="text-rose-500" />
                    <span className="text-xs font-medium text-rose-400">Waiting for Network</span>
                </div>
            );
        default:
            return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
          <div className="absolute top-[10%] left-[20%] w-[30%] h-[30%] bg-blue-600/10 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-[10%] right-[20%] w-[30%] h-[30%] bg-indigo-600/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="w-full max-w-md bg-[#151e32] border border-slate-800/50 rounded-3xl shadow-2xl relative z-10 animate-fade-in overflow-hidden flex flex-col">
        
        {/* Settings Button */}
        <button 
          onClick={onOpenSettings}
          className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all"
          title="Network Settings"
        >
          <Settings size={20} />
        </button>

        <div className="p-8 flex flex-col items-center flex-1">
          {/* Header Icon */}
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-600/20 ring-4 ring-blue-600/10">
             <Download size={32} className="text-white" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-2 text-center">Welcome to TDownloader</h1>
          <p className="text-slate-400 text-sm mb-6 text-center max-w-[260px]">
             Secure local Telegram file manager & high-speed downloader
          </p>

          {/* Connection Status Indicator */}
          <div className="mb-6 h-8 flex justify-center">
             {getConnectionBadge()}
          </div>

          {/* Toggle Switch */}
          {!isAwaitingCode && !isAwaitingPassword && (
            <div className="flex bg-slate-900/50 p-1 rounded-xl w-full mb-8 border border-slate-800">
              <button 
                onClick={() => setMethod('qr')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${method === 'qr' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-400'}`}
              >
                <QrCode size={16} /> QR Code
              </button>
              <button 
                onClick={() => setMethod('phone')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${method === 'phone' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-400'}`}
              >
                <Smartphone size={16} /> Phone
              </button>
            </div>
          )}

          <div className="w-full">
            {/* QR Mode */}
            {showQr && (
              <div className="flex flex-col items-center animate-fade-in">
                <div className="bg-white p-2 rounded-xl mb-6 shadow-lg">
                   {currentQr ? (
                     <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(currentQr)}`} 
                        alt="Telegram Login QR" 
                        className="w-48 h-48 object-contain rounded-lg"
                     />
                   ) : (
                     <div className="w-48 h-48 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-lg">
                       <div className="animate-spin mb-3 text-blue-500"><RefreshCw size={24}/></div>
                       <span className="text-xs font-medium">Generating...</span>
                     </div>
                   )}
                </div>
                <p className="text-xs text-slate-500 text-center">
                  Settings &gt; Devices &gt; Link Desktop Device
                </p>
              </div>
            )}

            {/* Phone Mode */}
            {showPhoneInput && (
              <form onSubmit={handlePhoneSubmit} className="space-y-4 animate-fade-in">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">Phone Number</label>
                  <div className="relative">
                     <Phone className="absolute left-4 top-3.5 text-slate-500" size={18} />
                     <input 
                      type="tel" 
                      placeholder="+1 234 567 8900"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-700 bg-slate-900 text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-medium text-sm"
                      required
                    />
                  </div>
                </div>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 text-sm mt-2"
                >
                  {loading ? 'Sending...' : <>Next <ArrowRight size={16} /></>}
                </button>
              </form>
            )}

            {/* Verification Code */}
            {isAwaitingCode && (
              <form onSubmit={handleCodeSubmit} className="space-y-6 animate-fade-in">
                <div className="text-center">
                  <h3 className="text-white font-medium mb-1">Enter Code</h3>
                  <p className="text-xs text-slate-500">Sent to your Telegram app</p>
                </div>
                <input 
                  type="text" 
                  placeholder="XXXXX"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  className="w-full px-4 py-4 rounded-xl border border-slate-700 bg-slate-900 text-white focus:border-blue-500 outline-none transition-all text-center tracking-[0.5em] text-2xl font-bold"
                  required
                  autoFocus
                />
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 text-sm"
                >
                  {loading ? 'Verifying...' : 'Log In'}
                </button>
              </form>
            )}
            
            {/* 2FA Password */}
            {isAwaitingPassword && (
              <form onSubmit={handlePasswordSubmit} className="space-y-4 animate-fade-in">
                <div className="text-center mb-2">
                   <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-500">
                      <Lock size={20} />
                   </div>
                   <h3 className="text-white font-medium">Two-Step Verification</h3>
                </div>
                <div>
                  <input 
                    type="password" 
                    placeholder="Cloud Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-900 text-white focus:border-blue-500 outline-none transition-all text-sm"
                    required
                    autoFocus
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 text-sm"
                >
                  {loading ? 'Unlocking...' : 'Unlock Account'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
