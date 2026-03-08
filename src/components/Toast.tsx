import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '../utils';

interface ToastProps {
  message: string;
  type: 'error' | 'success' | 'info';
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  const icons = {
    error: <AlertCircle className="text-rose-500" size={18} />,
    success: <CheckCircle2 className="text-emerald-500" size={18} />,
    info: <Info className="text-blue-500" size={18} />,
  };

  const colors = {
    error: 'bg-rose-500/10 border-rose-500/20 text-rose-200',
    success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200',
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-200',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "pointer-events-auto flex items-center justify-between p-4 rounded-2xl border backdrop-blur-xl shadow-2xl",
        colors[type]
      )}
    >
      <div className="flex items-center space-x-3">
        {icons[type]}
        <p className="text-xs font-bold uppercase tracking-wider leading-tight">{message}</p>
      </div>
      <button 
        onClick={onClose}
        className="ml-4 p-1 hover:bg-white/5 rounded-full transition-colors"
      >
        <X size={14} className="opacity-50" />
      </button>
    </motion.div>
  );
};
