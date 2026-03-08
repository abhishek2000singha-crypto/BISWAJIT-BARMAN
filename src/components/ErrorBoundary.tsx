import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-full bg-black flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500 mb-6 border border-rose-500/20">
            <AlertTriangle size={40} />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tighter italic mb-2">Something went wrong</h2>
          <p className="text-zinc-500 text-sm mb-8 max-w-xs mx-auto">
            An unexpected error occurred. We've been notified and are working on it.
          </p>
          
          <div className="flex flex-col space-y-3 w-full max-w-xs">
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-white text-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center space-x-2 hover:bg-zinc-200 transition-all"
            >
              <RefreshCcw size={14} />
              <span>Reload App</span>
            </button>
            <button 
              onClick={this.handleReset}
              className="w-full bg-zinc-900 text-white border border-white/5 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center space-x-2 hover:bg-zinc-800 transition-all"
            >
              <Home size={14} />
              <span>Back to Home</span>
            </button>
          </div>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <div className="mt-12 p-4 bg-zinc-900 rounded-xl border border-white/5 text-left w-full max-w-md overflow-auto">
              <p className="text-rose-500 font-mono text-[10px] mb-2">Error Details:</p>
              <pre className="text-zinc-500 font-mono text-[10px] whitespace-pre-wrap">
                {this.state.error.stack}
              </pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
