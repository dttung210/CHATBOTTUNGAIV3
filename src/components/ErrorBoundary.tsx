import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F7FFFD] flex items-center justify-center p-6 font-sans">
          <div className="bg-white border border-teal-100 rounded-3xl p-8 max-w-md w-full shadow-lg text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-[#DC5A5A]">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Đã xảy ra lỗi hệ thống</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Trang web gặp sự cố nhỏ khi hiển thị. Em đừng lo lắng nhé, hãy thử tải lại trang bằng nút bên dưới hoặc làm mới phiên học.
            </p>
            {this.state.error && (
              <pre className="text-left text-[11px] bg-slate-50 border border-slate-200 rounded-xl p-3 overflow-x-auto text-slate-500 font-mono">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReset}
              className="flex items-center justify-center gap-1.5 w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition-all shadow-md active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Tải lại ứng dụng</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
