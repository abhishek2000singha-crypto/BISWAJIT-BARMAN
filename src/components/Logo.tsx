import React from 'react';
import { Crown } from 'lucide-react';

export const Logo: React.FC<{ className?: string }> = ({ className = "w-12 h-12" }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-600 rounded-full opacity-20 blur-xl animate-pulse" />
      <div className="relative bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-600 p-[2px] rounded-full shadow-[0_0_20px_rgba(245,158,11,0.3)]">
        <div className="bg-zinc-950 rounded-full p-2 flex items-center justify-center">
          <Crown className="text-amber-500" size={24} />
        </div>
      </div>
    </div>
  );
};

export const LogoText: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <div className={`flex items-center font-impact tracking-tight text-3xl uppercase ${className}`}>
      <div className="mr-2 text-amber-500">
        <Crown size={32} className="fill-amber-500/20 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
      </div>
      <span className="text-gradient">REELS</span>
      <span className="ml-1.5 text-white drop-shadow-lg">KING</span>
    </div>
  );
};
