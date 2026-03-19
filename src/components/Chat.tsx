import React, { useState, useEffect, useRef } from 'react';
import { Send, Phone, Video, X, Mic, MicOff, VideoOff, PhoneOff, User as UserIcon, MessageSquare, Loader2, Play, Pause, Square, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import Peer from 'simple-peer';
import { User } from '../types';
import { cn } from '../utils';
import { collection, query, where, orderBy, onSnapshot, addDoc, Timestamp, limit, getDoc, doc } from 'firebase/firestore';
import { db, storage } from '../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface Message {
  id: string;
  text?: string;
  audioUrl?: string;
  type: 'text' | 'voice';
  senderId: string;
  senderName: string;
  createdAt: any;
}

const VoiceMessagePlayer: React.FC<{ url: string, senderId: string, currentUserId: string, formatTime: (s: number) => string }> = ({ url, senderId, currentUserId, formatTime }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onloadedmetadata = () => setDuration(audio.duration);
    audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
    audio.onended = () => setIsPlaying(false);
    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [url]);

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="flex items-center space-x-3 min-w-[200px]">
      <button 
        onClick={togglePlay}
        className={`p-2 rounded-full transition-all ${
          senderId === currentUserId ? 'bg-white/20 hover:bg-white/30' : 'bg-rose-500/20 hover:bg-rose-500/30'
        }`}
      >
        {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
      </button>
      <div className="flex-1 space-y-1">
        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden relative">
          <motion.div 
            className={`h-full ${senderId === currentUserId ? 'bg-white' : 'bg-rose-500'}`}
            initial={{ width: 0 }}
            animate={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
            transition={{ type: 'spring', bounce: 0, duration: 0.1 }}
          />
        </div>
        <div className="flex justify-between text-[10px] font-medium opacity-70">
          <span>{formatTime(currentTime)}</span>
          <span>{duration ? formatTime(duration) : '--:--'}</span>
        </div>
      </div>
    </div>
  );
};

const WaveformVisualizer: React.FC<{ data: Uint8Array }> = ({ data }) => {
  return (
    <div className="flex items-center space-x-0.5 h-8 px-2">
      {Array.from(data).map((val, i) => (
        <motion.div
          key={i}
          animate={{ height: `${Math.max(4, (val / 255) * 32)}px` }}
          transition={{ type: 'spring', bounce: 0.5, duration: 0.1 }}
          className="w-1 bg-rose-500 rounded-full"
        />
      ))}
    </div>
  );
};

export const Chat: React.FC<{ currentUser: User, onBack?: () => void, preSelectedUserId?: string }> = ({ currentUser, onBack, preSelectedUserId }) => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  
  // Call states
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'incoming' | 'connected'>('idle');
  const [callType, setCallType] = useState<'voice' | 'video'>('voice');
  const [incomingCallData, setIncomingCallData] = useState<any>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  // Voice recording state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioData, setAudioData] = useState<Uint8Array>(new Uint8Array(0));
  const [isHolding, setIsHolding] = useState(false);
  const mediaRecorderRef_voice = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const myVideo = useRef<HTMLVideoElement>(null);
  const userVideo = useRef<HTMLVideoElement>(null);
  const connectionRef = useRef<Peer.Instance | null>(null);

  useEffect(() => {
    // Fetch users to chat with
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const allUsers = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as User));
      setUsers(allUsers.filter(u => u.uid !== currentUser.uid));
    });

    // Initialize Socket
    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    const newSocket = io(socketUrl);
    setSocket(newSocket);

    if (preSelectedUserId) {
      getDoc(doc(db, 'users', preSelectedUserId)).then(docSnap => {
        if (docSnap.exists()) {
          setSelectedUser({ ...docSnap.data(), uid: docSnap.id } as User);
        }
      });
    }

    newSocket.on('connect', () => {
      newSocket.emit('join-room', currentUser.uid);
    });

    newSocket.on('incoming-call', (data) => {
      setIncomingCallData(data);
      setCallStatus('incoming');
      setCallType(data.type);
    });

    newSocket.on('call-ended', () => {
      setCallStatus('idle');
      connectionRef.current?.destroy();
      stream?.getTracks().forEach(track => track.stop());
      setStream(null);
      setRemoteStream(null);
      setIncomingCallData(null);
    });

    return () => {
      unsubscribe();
      newSocket.off('incoming-call');
      newSocket.off('call-ended');
      newSocket.disconnect();
    };
  }, [currentUser.uid]);

  useEffect(() => {
    if (!selectedUser) return;

    const roomId = [currentUser.uid, selectedUser.uid].sort().join('_');
    const q = query(
      collection(db, 'messages'),
      where('roomId', '==', roomId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Message)).reverse();
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [selectedUser, currentUser.uid]);

  const sendMessage = async (audioUrl?: string) => {
    if (!selectedUser) return;
    if (!audioUrl && !inputText.trim()) return;

    const roomId = [currentUser.uid, selectedUser.uid].sort().join('_');
    const messageData = {
      roomId,
      text: audioUrl ? '' : inputText,
      audioUrl: audioUrl || null,
      type: audioUrl ? 'voice' : 'text',
      senderId: currentUser.uid,
      senderName: currentUser.name,
      createdAt: Timestamp.now()
    };

    await addDoc(collection(db, 'messages'), messageData);
    socket?.emit('send-message', { ...messageData, roomId: selectedUser.uid });
    if (!audioUrl) setInputText('');
  };

  // WebRTC Logic
  const startCall = async (type: 'voice' | 'video') => {
    if (!selectedUser) return;
    
    setCallType(type);
    setCallStatus('calling');

    const currentStream = await navigator.mediaDevices.getUserMedia({
      video: type === 'video',
      audio: true
    });
    setStream(currentStream);
    if (myVideo.current) myVideo.current.srcObject = currentStream;

    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: currentStream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ]
      }
    });

    peer.on('signal', (data) => {
      socket?.emit('call-user', {
        userToCall: selectedUser.uid,
        signalData: data,
        from: currentUser.uid,
        name: currentUser.name,
        type
      });
    });

    peer.on('stream', (remoteStream) => {
      setRemoteStream(remoteStream);
      if (userVideo.current) userVideo.current.srcObject = remoteStream;
    });

    socket?.once('call-accepted', (signal) => {
      setCallStatus('connected');
      peer.signal(signal);
    });

    connectionRef.current = peer;
  };

  const answerCall = async () => {
    setCallStatus('connected');
    
    const currentStream = await navigator.mediaDevices.getUserMedia({
      video: callType === 'video',
      audio: true
    });
    setStream(currentStream);
    if (myVideo.current) myVideo.current.srcObject = currentStream;

    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: currentStream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ]
      }
    });

    peer.on('signal', (data) => {
      socket?.emit('answer-call', { signal: data, to: incomingCallData.from });
    });

    peer.on('stream', (remoteStream) => {
      setRemoteStream(remoteStream);
      if (userVideo.current) userVideo.current.srcObject = remoteStream;
    });

    peer.signal(incomingCallData.signal);
    connectionRef.current = peer;
  };

  const leaveCall = () => {
    const targetId = selectedUser?.uid || incomingCallData?.from;
    if (targetId) {
      socket?.emit('end-call', { to: targetId });
    }
    
    setCallStatus('idle');
    connectionRef.current?.destroy();
    stream?.getTracks().forEach(track => track.stop());
    setStream(null);
    setRemoteStream(null);
    setIncomingCallData(null);
  };

  const toggleMute = () => {
    if (stream) {
      stream.getAudioTracks()[0].enabled = isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (stream && callType === 'video') {
      stream.getVideoTracks()[0].enabled = isVideoOff;
      setIsVideoOff(!isVideoOff);
    }
  };

  const startRecordingVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Set up Audio Context for visualization
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVisualizer = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        setAudioData(new Uint8Array(dataArray));
        animationFrameRef.current = requestAnimationFrame(updateVisualizer);
      };
      updateVisualizer();

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef_voice.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioChunksRef.current.length > 0) {
          try {
            const storageRef = ref(storage, `voice_messages/${currentUser.uid}_${Date.now()}.webm`);
            await uploadBytes(storageRef, audioBlob);
            const url = await getDownloadURL(storageRef);
            sendMessage(url);
          } catch (error) {
            console.error('Error uploading voice message:', error);
          }
        }
        stream.getTracks().forEach(track => track.stop());
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        analyserRef.current = null;
        setAudioData(new Uint8Array(0));
      };

      mediaRecorder.start();
      setIsRecordingVoice(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
    }
  };

  const stopRecordingVoice = () => {
    if (mediaRecorderRef_voice.current && isRecordingVoice) {
      mediaRecorderRef_voice.current.stop();
      setIsRecordingVoice(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const cancelRecordingVoice = () => {
    if (mediaRecorderRef_voice.current && isRecordingVoice) {
      audioChunksRef.current = [];
      mediaRecorderRef_voice.current.stop();
      setIsRecordingVoice(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      analyserRef.current = null;
      setAudioData(new Uint8Array(0));
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    holdTimeoutRef.current = setTimeout(() => {
      startRecordingVoice();
      setIsHolding(true);
    }, 200);
  };

  const handlePointerUp = () => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
    }
    if (isHolding) {
      stopRecordingVoice();
      setIsHolding(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Header */}
      <div className="h-16 border-b border-white/10 flex items-center justify-between px-4 bg-zinc-900/50 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          {selectedUser ? (
            <>
              <button onClick={() => setSelectedUser(null)} className="p-2 -ml-2 text-zinc-400 hover:text-white">
                <X size={20} />
              </button>
              <img src={selectedUser.profileImage} className="w-8 h-8 rounded-full object-cover" alt="" />
              <div>
                <p className="text-sm font-bold">@{selectedUser.name}</p>
                <p className="text-[10px] text-emerald-500 font-medium">Online</p>
              </div>
            </>
          ) : (
            <>
              <MessageSquare className="text-rose-500" size={24} />
              <h1 className="text-lg font-black uppercase tracking-tighter italic">Messages</h1>
            </>
          )}
        </div>
        
        {selectedUser && (
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => startCall('voice')}
              className="p-2 bg-white/5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <Phone size={18} />
            </button>
            <button 
              onClick={() => startCall('video')}
              className="p-2 bg-white/5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <Video size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden relative">
        {!selectedUser ? (
          <div className="h-full overflow-y-auto p-4 space-y-2">
            {users.map(user => (
              <button
                key={user.uid}
                onClick={() => setSelectedUser(user)}
                className="w-full flex items-center space-x-4 p-4 bg-zinc-900/50 rounded-2xl border border-white/5 hover:bg-zinc-900 transition-all"
              >
                <img src={user.profileImage} className="w-12 h-12 rounded-full object-cover" alt="" />
                <div className="flex-1 text-left">
                  <p className="font-bold text-sm">@{user.name}</p>
                  <p className="text-xs text-zinc-500 truncate">Tap to start chatting</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col-reverse">
              {messages.slice().reverse().map(msg => (
                <div 
                  key={msg.id}
                  className={`flex ${msg.senderId === currentUser.uid ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                    msg.senderId === currentUser.uid 
                      ? 'bg-rose-500 text-white rounded-tr-none' 
                      : 'bg-zinc-800 text-zinc-100 rounded-tl-none'
                  }`}>
                    {msg.type === 'voice' ? (
                      <VoiceMessagePlayer 
                        url={msg.audioUrl!} 
                        senderId={msg.senderId} 
                        currentUserId={currentUser.uid} 
                        formatTime={formatTime}
                      />
                    ) : (
                      msg.text
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-4 bg-zinc-900/50 border-t border-white/10">
              {isRecordingVoice ? (
                <div className="flex items-center justify-between bg-black border border-rose-500/50 rounded-3xl px-4 py-3">
                  <div className="flex items-center space-x-3 flex-1">
                    <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                    <span className="text-sm font-mono text-rose-500 min-w-[40px]">{formatTime(recordingTime)}</span>
                    <WaveformVisualizer data={audioData} />
                  </div>
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={cancelRecordingVoice}
                      className="p-2 text-zinc-500 hover:text-rose-500 transition-all bg-white/5 rounded-full"
                    >
                      <Trash2 size={20} />
                    </button>
                    <button 
                      onClick={stopRecordingVoice}
                      className="p-3 bg-rose-500 rounded-full text-white hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20"
                    >
                      <Send size={20} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <button 
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    className={cn(
                      "p-2 transition-all rounded-full",
                      isHolding ? "bg-rose-500 text-white scale-125" : "text-zinc-400 hover:text-rose-500"
                    )}
                  >
                    <Mic size={20} />
                  </button>
                  <input 
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 bg-black border border-white/10 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-rose-500 transition-all"
                  />
                  <button 
                    onClick={() => sendMessage()}
                    className="p-2 bg-rose-500 rounded-full text-white hover:bg-rose-600 transition-all"
                  >
                    <Send size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Call Overlay */}
        <AnimatePresence>
          {callStatus !== 'idle' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center p-8"
            >
              {callType === 'video' && (
                <div className="absolute inset-0 grid grid-rows-2 gap-2 p-2">
                  <div className="relative bg-zinc-900 rounded-2xl overflow-hidden border border-white/10">
                    <video playsInline ref={userVideo} autoPlay className="w-full h-full object-cover" />
                    <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                      {selectedUser?.name || incomingCallData?.name}
                    </div>
                  </div>
                  <div className="relative bg-zinc-900 rounded-2xl overflow-hidden border border-white/10">
                    <video playsInline muted ref={myVideo} autoPlay className="w-full h-full object-cover" />
                    <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                      You
                    </div>
                  </div>
                </div>
              )}

              {callType === 'voice' && (
                <div className="flex flex-col items-center space-y-6">
                  <div className="w-32 h-32 rounded-full bg-rose-500/20 flex items-center justify-center relative">
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 rounded-full border-2 border-rose-500/30"
                    />
                    <img 
                      src={selectedUser?.profileImage || incomingCallData?.profileImage || 'https://picsum.photos/seed/user/200'} 
                      className="w-24 h-24 rounded-full object-cover" 
                      alt="" 
                    />
                  </div>
                  <div className="text-center">
                    <h2 className="text-2xl font-black italic uppercase">
                      {selectedUser?.name || incomingCallData?.name}
                    </h2>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1">
                      {callStatus === 'calling' ? 'Calling...' : callStatus === 'incoming' ? 'Incoming Call' : 'Connected'}
                    </p>
                  </div>
                </div>
              )}

              <div className="absolute bottom-12 flex items-center space-x-6">
                {callStatus === 'incoming' ? (
                  <>
                    <button 
                      onClick={answerCall}
                      className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 hover:scale-110 transition-all"
                    >
                      <Phone size={28} />
                    </button>
                    <button 
                      onClick={leaveCall}
                      className="w-16 h-16 bg-rose-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-rose-500/20 hover:scale-110 transition-all"
                    >
                      <PhoneOff size={28} />
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={toggleMute}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-rose-500 text-white' : 'bg-white/10 text-white'}`}
                    >
                      {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>
                    {callType === 'video' && (
                      <button 
                        onClick={toggleVideo}
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isVideoOff ? 'bg-rose-500 text-white' : 'bg-white/10 text-white'}`}
                      >
                        {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
                      </button>
                    )}
                    <button 
                      onClick={leaveCall}
                      className="w-16 h-16 bg-rose-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-rose-500/20 hover:scale-110 transition-all"
                    >
                      <PhoneOff size={28} />
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
