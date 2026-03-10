import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Scissors, Sparkles, Type, Check, Play, Pause, RotateCcw, Trash2, Move } from 'lucide-react';
import { cn, formatDuration } from '../utils';

interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
}

interface VideoEditorProps {
  videoUrl: string;
  duration: number;
  onSave: (data: {
    trimStart: number;
    trimEnd: number;
    filter: string;
    textOverlays: TextOverlay[];
  }) => void;
  onCancel: () => void;
  initialData?: {
    trimStart: number;
    trimEnd: number;
    filter: string;
    textOverlays: TextOverlay[];
  };
}

const FILTERS = [
  { name: 'None', class: '' },
  { name: 'Grayscale', class: 'grayscale' },
  { name: 'Sepia', class: 'sepia' },
  { name: 'Invert', class: 'invert' },
  { name: 'Warm', class: 'sepia(0.5) brightness(1.1) saturate(1.2)' },
  { name: 'Cool', class: 'hue-rotate(180deg) brightness(1.1) saturate(1.1)' },
  { name: 'Dramatic', class: 'contrast(1.5) grayscale(0.5)' },
  { name: 'Vibrant', class: 'saturate(2) contrast(1.1)' },
  { name: 'Vintage', class: 'sepia(0.3) contrast(0.8) brightness(0.9)' },
];

export const VideoEditor: React.FC<VideoEditorProps> = ({
  videoUrl,
  duration,
  onSave,
  onCancel,
  initialData
}) => {
  const [activeTab, setActiveTab] = useState<'trim' | 'filter' | 'text'>('trim');
  const [trimStart, setTrimStart] = useState(initialData?.trimStart || 0);
  const [trimEnd, setTrimEnd] = useState(initialData?.trimEnd || duration);
  const [selectedFilter, setSelectedFilter] = useState(initialData?.filter || '');
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>(initialData?.textOverlays || []);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = trimStart;
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.currentTime >= trimEnd) {
        video.currentTime = trimStart;
      }
      if (video.currentTime < trimStart) {
        video.currentTime = trimStart;
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [trimStart, trimEnd]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const addTextOverlay = () => {
    const newText: TextOverlay = {
      id: Math.random().toString(36).substr(2, 9),
      text: 'Double tap to edit',
      x: 50,
      y: 50,
      color: '#ffffff',
      fontSize: 24
    };
    setTextOverlays([...textOverlays, newText]);
    setEditingTextId(newText.id);
  };

  const updateTextOverlay = (id: string, updates: Partial<TextOverlay>) => {
    setTextOverlays(textOverlays.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const removeTextOverlay = (id: string) => {
    setTextOverlays(textOverlays.filter(t => t.id !== id));
    setEditingTextId(null);
  };

  const handleDrag = (id: string, e: React.MouseEvent | React.TouchEvent) => {
    if (editingTextId && editingTextId !== id) return;
    
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const moveHandler = (moveEvent: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const clientY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      
      updateTextOverlay(id, { 
        x: Math.max(0, Math.min(100, x)), 
        y: Math.max(0, Math.min(100, y)) 
      });
    };

    const upHandler = () => {
      window.removeEventListener('mousemove', moveHandler);
      window.removeEventListener('mouseup', upHandler);
      window.removeEventListener('touchmove', moveHandler);
      window.removeEventListener('touchend', upHandler);
    };

    window.addEventListener('mousemove', moveHandler);
    window.addEventListener('mouseup', upHandler);
    window.addEventListener('touchmove', moveHandler);
    window.addEventListener('touchend', upHandler);
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black flex flex-col">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-white/10">
        <button onClick={onCancel} className="p-2 text-zinc-400 hover:text-white">
          <X size={24} />
        </button>
        <h2 className="text-lg font-bold">Edit Video</h2>
        <button 
          onClick={() => onSave({ trimStart, trimEnd, filter: selectedFilter, textOverlays })}
          className="bg-rose-500 text-white px-6 py-2 rounded-full font-bold text-sm"
        >
          Save
        </button>
      </div>

      {/* Preview Area */}
      <div className="flex-1 relative flex items-center justify-center p-4 bg-zinc-950">
        <div 
          ref={containerRef}
          className="relative aspect-[9/16] h-full max-h-[70vh] rounded-3xl overflow-hidden shadow-2xl bg-black"
        >
          <video
            ref={videoRef}
            src={videoUrl}
            autoPlay
            loop
            muted
            playsInline
            style={{ filter: selectedFilter.includes('(') ? selectedFilter : undefined }}
            className={cn("w-full h-full object-cover", !selectedFilter.includes('(') && selectedFilter)}
          />

          {/* Text Overlays */}
          {textOverlays.map((overlay) => (
            <div
              key={overlay.id}
              style={{ 
                left: `${overlay.x}%`, 
                top: `${overlay.y}%`, 
                color: overlay.color,
                fontSize: `${overlay.fontSize}px`,
                transform: 'translate(-50%, -50%)',
                textShadow: '0 2px 4px rgba(0,0,0,0.5)'
              }}
              className={cn(
                "absolute cursor-move select-none whitespace-nowrap font-bold px-2 py-1 rounded",
                editingTextId === overlay.id && "ring-2 ring-rose-500 bg-black/20"
              )}
              onMouseDown={(e) => handleDrag(overlay.id, e)}
              onTouchStart={(e) => handleDrag(overlay.id, e)}
              onDoubleClick={() => setEditingTextId(overlay.id)}
            >
              {editingTextId === overlay.id ? (
                <input
                  autoFocus
                  value={overlay.text}
                  onChange={(e) => updateTextOverlay(overlay.id, { text: e.target.value })}
                  onBlur={() => setEditingTextId(null)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingTextId(null)}
                  className="bg-transparent border-none outline-none text-center min-w-[50px]"
                />
              ) : (
                overlay.text
              )}
            </div>
          ))}

          {/* Play/Pause Overlay */}
          <button 
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20"
          >
            {isPlaying ? <Pause size={48} /> : <Play size={48} />}
          </button>
        </div>
      </div>

      {/* Controls Area */}
      <div className="bg-zinc-900 rounded-t-[40px] p-6 pb-10 space-y-6">
        {/* Tabs */}
        <div className="flex items-center justify-center space-x-8">
          <button 
            onClick={() => setActiveTab('trim')}
            className={cn("flex flex-col items-center space-y-1 transition-colors", activeTab === 'trim' ? "text-rose-500" : "text-zinc-500")}
          >
            <Scissors size={20} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Trim</span>
          </button>
          <button 
            onClick={() => setActiveTab('filter')}
            className={cn("flex flex-col items-center space-y-1 transition-colors", activeTab === 'filter' ? "text-rose-500" : "text-zinc-500")}
          >
            <Sparkles size={20} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Filters</span>
          </button>
          <button 
            onClick={() => setActiveTab('text')}
            className={cn("flex flex-col items-center space-y-1 transition-colors", activeTab === 'text' ? "text-rose-500" : "text-zinc-500")}
          >
            <Type size={20} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Text</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="h-32">
          {activeTab === 'trim' && (
            <div className="space-y-4">
              <div className="flex justify-between text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                <span>{formatDuration(trimStart)}</span>
                <span>{formatDuration(trimEnd - trimStart)} selected</span>
                <span>{formatDuration(trimEnd)}</span>
              </div>
              <div className="relative h-12 bg-zinc-800 rounded-xl overflow-hidden flex items-center px-4">
                {/* Simple Trim Slider */}
                <input 
                  type="range"
                  min={0}
                  max={duration}
                  step={0.1}
                  value={trimStart}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (val < trimEnd - 1) setTrimStart(val);
                  }}
                  className="absolute inset-x-4 h-1 bg-transparent appearance-none pointer-events-auto z-10"
                />
                <input 
                  type="range"
                  min={0}
                  max={duration}
                  step={0.1}
                  value={trimEnd}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (val > trimStart + 1) setTrimEnd(val);
                  }}
                  className="absolute inset-x-4 h-1 bg-transparent appearance-none pointer-events-auto z-10"
                />
                <div className="absolute inset-x-4 h-8 border-x-4 border-rose-500 bg-rose-500/20 rounded-sm pointer-events-none" style={{
                  left: `${(trimStart / duration) * 100}%`,
                  right: `${100 - (trimEnd / duration) * 100}%`
                }} />
              </div>
            </div>
          )}

          {activeTab === 'filter' && (
            <div className="flex space-x-4 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
              {FILTERS.map((filter) => (
                <button
                  key={filter.name}
                  onClick={() => setSelectedFilter(filter.class)}
                  className="flex flex-col items-center space-y-2 flex-shrink-0"
                >
                  <div 
                    className={cn(
                      "w-16 h-16 rounded-xl bg-zinc-800 overflow-hidden border-2 transition-all",
                      selectedFilter === filter.class ? "border-rose-500 scale-110" : "border-transparent"
                    )}
                  >
                    <div 
                      className={cn("w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-900", filter.class.includes('(') ? undefined : filter.class)}
                      style={{ filter: filter.class.includes('(') ? filter.class : undefined }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-zinc-500">{filter.name}</span>
                </button>
              ))}
            </div>
          )}

          {activeTab === 'text' && (
            <div className="flex flex-col items-center space-y-4">
              <button 
                onClick={addTextOverlay}
                className="flex items-center space-x-2 bg-zinc-800 hover:bg-zinc-700 px-6 py-3 rounded-2xl transition-colors"
              >
                <Type size={18} />
                <span className="text-xs font-bold">Add Text Overlay</span>
              </button>
              
              {textOverlays.length > 0 && (
                <div className="flex space-x-2">
                  <button 
                    onClick={() => {
                      if (editingTextId) removeTextOverlay(editingTextId);
                      else removeTextOverlay(textOverlays[textOverlays.length - 1].id);
                    }}
                    className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                    title="Delete selected text"
                  >
                    <Trash2 size={16} />
                  </button>
                  <div className="flex flex-col space-y-2">
                    <div className="flex space-x-1">
                      {['#ffffff', '#000000', '#f43f5e', '#3b82f6', '#10b981', '#f59e0b'].map(color => (
                        <button
                          key={color}
                          onClick={() => {
                            const targetId = editingTextId || textOverlays[textOverlays.length - 1].id;
                            if (targetId) updateTextOverlay(targetId, { color });
                          }}
                          className="w-6 h-6 rounded-full border border-white/10"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <div className="flex space-x-1">
                      {[16, 24, 32, 48, 64].map(size => (
                        <button
                          key={size}
                          onClick={() => {
                            const targetId = editingTextId || textOverlays[textOverlays.length - 1].id;
                            if (targetId) updateTextOverlay(targetId, { fontSize: size });
                          }}
                          className="w-8 h-8 rounded bg-zinc-800 text-[10px] font-bold flex items-center justify-center border border-white/10"
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
