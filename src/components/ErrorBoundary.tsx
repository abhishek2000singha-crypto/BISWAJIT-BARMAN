import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      let errorDetail = "";

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error) {
            errorMessage = "Firestore Permission Denied or Configuration Error";
            errorDetail = `Operation: ${parsed.operationType} on ${parsed.path}`;
          }
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="h-screen w-full bg-black flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500 mb-6">
            <AlertCircle size={40} />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tighter italic mb-2">Something went wrong</h2>
          <p className="text-zinc-500 text-sm mb-4">{errorMessage}</p>
          {errorDetail && (
            <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest mb-8">{errorDetail}</p>
          )}
          <button 
            onClick={this.handleReset}
            className="bg-rose-500 text-white px-8 py-3 rounded-2xl font-bold text-sm hover:bg-rose-600 transition-colors flex items-center space-x-2"
          >
            <RefreshCw size={18} />
            <span>Try Again</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
