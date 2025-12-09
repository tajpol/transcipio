import React, { useState, useEffect } from 'react';
import { Upload, FileVideo, Download, Loader2, CheckCircle, AlertCircle, Sparkles, Home, CreditCard, Coins } from 'lucide-react';

export default function Transcipio() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle');
  const [transcript, setTranscript] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState('');
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [language, setLanguage] = useState('en');
  const [videoDuration, setVideoDuration] = useState(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setStatus('idle');
      setTranscript(null);
      setError(null);
      
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        setVideoDuration(video.duration);
      };
      video.src = URL.createObjectURL(selectedFile);
    }
  };

  const handleChangeFile = () => {
    document.getElementById('video-upload').click();
  };

  const resetToHome = () => {
    setFile(null);
    setStatus('idle');
    setTranscript(null);
    setError(null);
    setVideoDuration(null);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTranscribe = async () => {
    if (!file) return;
    setStatus('uploading');
    setError(null);
    setProgress('Uploading video...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'transcipio_uploads');
      
      setProgress('Uploading to cloud storage...');
      const cloudinaryResponse = await fetch(
        'https://api.cloudinary.com/v1_1/dso0luj36/video/upload',
        { method: 'POST', body: formData }
      );

      if (!cloudinaryResponse.ok) {
        throw new Error('Upload failed. Please check your file and try again.');
      }

      const cloudinaryData = await cloudinaryResponse.json();
      const videoUrl = cloudinaryData.secure_url;

      setStatus('transcribing');
      setProgress('Starting transcription...');

      const transcribeResponse = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_url: videoUrl, language_code: language }),
      });

      if (!transcribeResponse.ok) {
        throw new Error('Failed to start transcription. Please try again.');
      }

      const transcribeData = await transcribeResponse.json();
      const transcriptId = transcribeData.id;

      setProgress('Transcribing... This may take a few minutes.');
      while (true) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const pollingResponse = await fetch(`/api/transcribe?id=${transcriptId}`);
        
        if (!pollingResponse.ok) {
          throw new Error('Failed to check transcription status.');
        }

        const transcriptResult = await pollingResponse.json();
        
        if (transcriptResult.status === 'completed') {
          setStatus('completed');
          setTranscript(transcriptResult);
          setProgress('');
          break;
        } else if (transcriptResult.status === 'error') {
          throw new Error(transcriptResult.error || 'Transcription failed');
        }
      }
    } catch (err) {
      setStatus('error');
      setError(err.message);
      setProgress('');
    }
  };

  const formatTranscriptWithTimestamps = () => {
    if (!transcript || !transcript.words) return '';
    
    let result = '';
    let currentLine = '';
    let lineStartTime = 0;
    let wordCount = 0;
    
    transcript.words.forEach((word, index) => {
      if (wordCount === 0) {
        lineStartTime = word.start;
      }
      
      currentLine += word.text + ' ';
      wordCount++;
      
      const timeSinceStart = (word.end - lineStartTime) / 1000;
      
      if (timeSinceStart >= 2 || index === transcript.words.length - 1) {
        const startFormatted = formatTimestamp(lineStartTime);
        const endFormatted = formatTimestamp(word.end);
        result += `[${startFormatted} - ${endFormatted}] ${currentLine.trim()}\n\n`;
        currentLine = '';
        wordCount = 0;
      }
    });
    
    return result;
  };

  const formatTimestamp = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const downloadTranscript = (format) => {
    if (!transcript) return;
    let content = '';
    let filename = '';

    if (format === 'txt') {
      content = formatTranscriptWithTimestamps();
      filename = 'transcript.txt';
    } else if (format === 'srt') {
      content = transcript.words.reduce((acc, word, i) => {
        const start = formatTimeSRT(word.start);
        const end = formatTimeSRT(word.end);
        return acc + `${i + 1}\n${start} --> ${end}\n${word.text}\n\n`;
      }, '');
      filename = 'transcript.srt';
    } else if (format === 'json') {
      content = JSON.stringify(transcript, null, 2);
      filename = 'transcript.json';
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
const formatTimeSRT = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = ms % 1000;
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(milliseconds, 3)}`;
  };

  const pad = (num, size = 2) => String(num).padStart(size, '0');

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      <div 
        className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-300"
        style={{
          background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(16, 185, 129, 0.15), transparent 40%)`
        }}
      />
      <div 
        className="fixed inset-0 opacity-30"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(16, 185, 129, 0.4) 1px, transparent 1px)`,
          backgroundSize: '20px 20px'
        }}
      />
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-emerald-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }}></div>
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-teal-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-3/4 h-3/4 bg-cyan-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {(file || status !== 'idle') && (
          <button
            onClick={resetToHome}
            className="mb-6 inline-flex items-center gap-2 bg-slate-800/50 hover:bg-slate-800 text-emerald-400 font-semibold py-3 px-6 rounded-xl transition-all duration-300 border border-slate-700/50 hover:border-emerald-500/30"
          >
            <Home className="w-5 h-5" />
            Home
          </button>
        )}

        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-3 mb-6 group">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-400 rounded-xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity duration-300"></div>
              <div className="relative w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center transform group-hover:scale-110 transition-transform duration-300">
                <FileVideo className="w-8 h-8 text-slate-950" />
              </div>
            </div>
            <h1 className="text-7xl font-bold bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent tracking-tight">
              Transcipio
            </h1>
            <Sparkles className="w-6 h-6 text-emerald-400 animate-pulse" />
          </div>
          <p className="text-emerald-300 text-2xl font-light max-w-2xl mx-auto leading-relaxed mb-2">
            The modern transcription platform
          </p>
          <p className="text-slate-400 text-base">
            Eliminating friction, connecting creators to accurate results
          </p>
        </div>

        <div className="group relative mb-8">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-3xl opacity-20 group-hover:opacity-40 blur transition-opacity duration-500"></div>
          <div className="relative bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-800/50 p-8 hover:border-emerald-500/30 transition-all duration-500">
            <div className="relative border-2 border-dashed border-slate-700/50 rounded-2xl p-12 text-center hover:border-emerald-500/50 transition-all duration-500 bg-slate-950/50 group/upload overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover/upload:opacity-100 transition-opacity duration-500"></div>
              <input type="file" accept="video/*" onChange={handleFileChange} className="hidden" id="video-upload" />
              <label htmlFor="video-upload" className="cursor-pointer relative z-10">
                <div className="flex flex-col items-center gap-5">
                  {file ? (
                    <>
                      <div className="relative">
                        <div className="absolute inset-0 bg-emerald-400 rounded-2xl blur-2xl opacity-30 animate-pulse"></div>
                        <div className="relative w-24 h-24 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-2xl flex items-center justify-center border border-emerald-500/30 transform hover:scale-110 transition-transform duration-300">
                          <FileVideo className="w-12 h-12 text-emerald-400" />
                        </div>
                      </div>
                      <div>
                        <p className="text-2xl font-semibold text-white mb-1">{file.name}</p>
                        <p className="text-emerald-400/70 text-lg">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        {videoDuration && (
                          <div className="mt-3">
                            <p className="text-slate-400 text-sm mb-2">Duration: {formatDuration(videoDuration)}</p>
                            <div className="w-64 mx-auto h-2 bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full" style={{ width: '100%' }}></div>
                            </div>
                          </div>
                        )}
</div>
                      <button type="button" onClick={handleChangeFile} className="text-emerald-400 hover:text-emerald-300 font-medium transition-all duration-300 hover:scale-105 bg-slate-800/50 px-4 py-2 rounded-lg">
                        Change file
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="relative">
                        <div className="absolute inset-0 bg-emerald-400 rounded-2xl blur-2xl opacity-20 group-hover/upload:opacity-40 transition-opacity duration-500"></div>
                        <div className="relative w-24 h-24 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl flex items-center justify-center border border-slate-700 group-hover/upload:border-emerald-500/50 transition-all duration-500 transform group-hover/upload:scale-110">
                          <Upload className="w-12 h-12 text-emerald-400 group-hover/upload:animate-bounce" />
                        </div>
                      </div>
                      <div>
                        <p className="text-2xl font-semibold text-white mb-2 group-hover/upload:text-emerald-400 transition-colors duration-300">
                          Upload your video
                        </p>
                        <p className="text-slate-400 text-base mb-4">MP4, WebM, MOV</p>
                        <div className="flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); setLanguage('en'); }}
                            className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                              language === 'en'
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                          >
                            English
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); setLanguage('es'); }}
                            className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                              language === 'es'
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                          >
                            Español
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </label>
            </div>

            {file && status === 'idle' && (
              <button onClick={handleTranscribe} className="group/btn relative w-full mt-8 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold py-5 px-8 rounded-2xl transition-all duration-300 text-lg shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/50 transform hover:scale-[1.02] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-1000"></div>
                <span className="relative flex items-center justify-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Start Transcription
                </span>
              </button>
            )}
          </div>
        </div>

        {(status === 'uploading' || status === 'transcribing') && (
          <div className="relative group mb-8">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl opacity-20 blur"></div>
            <div className="relative bg-slate-900/80 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-800/50 p-8">
              <div className="flex items-center gap-5">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-400 rounded-full blur-xl opacity-50 animate-pulse"></div>
                  <Loader2 className="relative w-10 h-10 text-emerald-400 animate-spin" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-white text-xl mb-1">{progress}</p>
                  <p className="text-slate-400">Please wait, this may take a few minutes...</p>
                  <div className="mt-3 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full animate-pulse" style={{ width: status === 'uploading' ? '30%' : '70%', transition: 'width 1s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="relative group mb-8">
            <div className="absolute -inset-0.5 bg-red-500 rounded-2xl opacity-20 blur"></div>
            <div className="relative bg-slate-900/80 backdrop-blur-xl border border-red-500/30 rounded-2xl p-6 flex items-start gap-4">
              <AlertCircle className="w-7 h-7 text-red-400 flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold text-red-300 text-lg mb-1">Error</p>
                <p className="text-red-200/80">{error}</p>
              </div>
            </div>
          </div>
        )}

        {status === 'completed' && transcript && (
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl opacity-20 blur"></div>
            <div className="relative bg-slate-900/80 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-800/50 p-8 hover:border-emerald-500/30 transition-all duration-500">
              <div className="flex items-center gap-4 mb-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-400 rounded-full blur-xl opacity-50"></div>
                  <CheckCircle className="relative w-10 h-10 text-emerald-400" />
                </div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  Transcription Complete
                </h2>
              </div>

              <div className="bg-slate-950/70 rounded-xl p-6 mb-6 max-h-96 overflow-y-auto border border-slate-800/50 hover:border-emerald-500/20 transition-colors duration-300">
                <p className="text-slate-200 leading-relaxed whitespace-pre-wrap text-base font-mono">
                  {formatTranscriptWithTimestamps()}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <button onClick={() => downloadTranscript('txt')} className="group/download relative bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg transform hover:scale-105 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover/download:translate-x-[100%] transition-transform duration-700"></div>
                  <Download className="relative w-5 h-5" />
                  <span className="relative">TXT</span>
                </button>
                <button onClick={() => downloadTranscript('srt')} className="group/download relative bg-gradient-to-r from-teal-500 to-cyan-500 hover:opacity-90 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg transform hover:scale-105 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover/download:translate-x-[100%] transition-transform duration-700"></div>
                  <Download className="relative w-5 h-5" />
                  <span className="relative">SRT</span>
                </button>
                <button onClick={() => downloadTranscript('json')} className="group/download relative bg-gradient-to-r from-cyan-500 to-blue-500 hover:opacity-90 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg transform hover:scale-105 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover/download:translate-x-[100%] transition-transform duration-700"></div>
                  <Download className="relative w-5 h-5" />
                  <span className="relative">JSON</span>
                </button>
              </div>

              <button onClick={resetToHome} className="w-full bg-slate-800/50 hover:bg-slate-800 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 border border-slate-700/50 hover:border-emerald-500/30 transform hover:scale-[1.01]">
                Transcribe Another Video
              </button>
            </div>
          </div>
        )}

        <div className="mt-16 text-center space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="https://donate.stripe.com/6oUcN531PgI59DM4Xs9sk02"
              target="_blank"
              rel="noopener noreferrer"
              className="group/stripe relative inline-flex items-center gap-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 hover:from-indigo-400 hover:via-purple-400 hover:to-indigo-500 text-white font-semibold py-5 px-10 rounded-2xl transition-all duration-300 shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/50 transform hover:scale-105 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover/stripe:translate-x-[100%] transition-transform duration-1000"></div>
              <div className="relative">
                <div className="absolute inset-0 bg-white rounded-xl blur-lg opacity-30 group-hover/stripe:opacity-50 transition-opacity"></div>
                <CreditCard className="relative w-7 h-7" />
              </div>
              <div className="relative text-left">
                <div className="text-base font-bold">Donate Securely with Stripe</div>
                <div className="text-sm opacity-90 font-normal">Support this project</div>
              </div>
            </a>

            <a
              href="https://nowpayments.io/donation/tpbs"
              target="_blank"
              rel="noopener noreferrer"
              className="group/crypto relative inline-flex items-center gap-4 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-400 hover:via-amber-400 hover:to-orange-500 text-white font-semibold py-5 px-10 rounded-2xl transition-all duration-300 shadow-xl shadow-orange-500/25 hover:shadow-orange-500/50 transform hover:scale-105 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover/crypto:translate-x-[100%] transition-transform duration-1000"></div>
              <div className="relative">
                <div className="absolute inset-0 bg-white rounded-xl blur-lg opacity-30 group-hover/crypto:opacity-50 transition-opacity"></div>
                <Coins className="relative w-7 h-7" />
              </div>
              <div className="relative text-left">
                <div className="text-base font-bold">Donate Crypto</div>
                <div className="text-sm opacity-90 font-normal">Ethereum & Monero accepted</div>
              </div>
            </a>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-slate-800/50 text-center space-y-4">
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-8 text-slate-500 text-sm">
            <a href="/privacy" className="hover:text-emerald-400 transition-colors">Privacy Policy</a>
            <span className="hidden sm:inline">•</span>
            <p>© 2025 TP Business Solutions. All Rights Reserved.</p>
          </div>
          <p className="text-slate-500 text-sm font-light">Faster. Smarter. More accurate.</p>
        </div>
      </div>
    </div>
  );
}