import React, { useState, useEffect } from 'react';
import { Settings, Phone, QrCode, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
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

  useEffect(() => {
    setCurrentQr(qrLink);
  }, [qrLink]);

  useEffect(() => {
    if (method === 'qr' && initialState === AuthState.LOGGED_OUT) {
      api.requestQrCode();
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

  // Determine active view based on global auth state
  const isAwaitingCode = initialState === AuthState.AWAITING_CODE;
  const isAwaitingPassword = initialState === AuthState.AWAITING_PASSWORD;
  const showQr = method === 'qr' && !isAwaitingCode && !isAwaitingPassword;
  const showPhoneInput = method === 'phone' && !isAwaitingCode && !isAwaitingPassword;

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid md:grid-cols-2 bg-white rounded-2xl overflow-hidden shadow-2xl">
        
        {/* Left Side: Branding */}
        <div className="bg-blue-600 p-12 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10">
             <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mb-6">
                <ShieldCheck size={32} className="text-white" />
             </div>
             <h1 className="text-4xl font-bold mb-4">TDownloader</h1>
             <p className="text-blue-100 text-lg">
               Secure, local file management for your Telegram account. 
               Advanced filtering and download management.
             </p>
          </div>
          
          <div className="relative z-10 space-y-4">
             <div className="flex items-center gap-3 text-blue-100">
               <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">1</div>
               <span>Connect via TDLib</span>
             </div>
             <div className="flex items-center gap-3 text-blue-100">
               <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">2</div>
               <span>Scan local files</span>
             </div>
             <div className="flex items-center gap-3 text-blue-100">
               <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">3</div>
               <span>Batch download</span>
             </div>
          </div>

          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-blue-500 rounded-full opacity-50 blur-3xl"></div>
          <div className="absolute top-12 -left-12 w-32 h-32 bg-indigo-500 rounded-full opacity-50 blur-2xl"></div>
        </div>

        {/* Right Side: Form */}
        <div className="p-12 flex flex-col justify-center relative">
          <button 
            onClick={onOpenSettings}
            className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Proxy Settings"
          >
            <Settings size={20} />
          </button>

          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome Back</h2>
            <p className="text-slate-500">Connect your Telegram account to start.</p>
          </div>

          {/* Method Toggle */}
          {!isAwaitingCode && !isAwaitingPassword && (
            <div className="flex bg-slate-100 p-1 rounded-lg mb-8">
              <button 
                onClick={() => setMethod('qr')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${method === 'qr' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
              >
                <QrCode size={18} /> QR Code
              </button>
              <button 
                onClick={() => setMethod('phone')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${method === 'phone' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
              >
                <Phone size={18} /> Phone
              </button>
            </div>
          )}

          {/* QR Mode */}
          {showQr && (
            <div className="flex flex-col items-center animate-fade-in">
              <div className="w-52 h-52 bg-white border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center mb-4 overflow-hidden relative">
                 {currentQr ? (
                   <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(currentQr)}`} 
                      alt="Telegram Login QR" 
                      className="w-full h-full object-contain"
                   />
                 ) : (
                   <div className="flex flex-col items-center text-slate-400">
                     <div className="animate-spin mb-2"><RefreshCw size={24}/></div>
                     <span className="text-xs">Generating QR...</span>
                   </div>
                 )}
              </div>
              <p className="text-sm text-slate-500 text-center">
                Open Telegram on your phone <br/> Go to Settings {'>'} Devices {'>'} Link Desktop Device
              </p>
            </div>
          )}

          {/* Phone Mode - Step 1 */}
          {showPhoneInput && (
            <form onSubmit={handlePhoneSubmit} className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                <input 
                  type="tel" 
                  placeholder="+1 234 567 8900"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {loading ? 'Sending...' : <>Next <ArrowRight size={18} /></>}
              </button>
            </form>
          )}

          {/* Phone Mode - Step 2 (Code) */}
          {isAwaitingCode && (
            <form onSubmit={handleCodeSubmit} className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Enter Code</label>
                <input 
                  type="text" 
                  placeholder="12345"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-center tracking-widest text-lg"
                  required
                />
                <p className="text-xs text-slate-500 mt-2 text-center">
                  We've sent a code to your Telegram app.
                </p>
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {loading ? 'Verifying...' : 'Log In'}
              </button>
            </form>
          )}
          
          {/* Phone Mode - Step 3 (2FA) */}
          {isAwaitingPassword && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Two-Step Verification Password</label>
                <input 
                  type="password" 
                  placeholder="Your 2FA Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {loading ? 'Unlocking...' : 'Unlock'}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};

export default AuthScreen;