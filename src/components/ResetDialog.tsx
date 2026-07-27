import React from "react";
import { AlertCircle, Trash2 } from "lucide-react";

interface ResetDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ResetDialog({ isOpen, onClose, onConfirm }: ResetDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 border border-teal-50 space-y-4">
        <div className="flex items-center gap-3 text-[#DC5A5A]">
          <div className="p-3 bg-red-50 rounded-full">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-lg text-slate-900">Làm mới phiên học?</h3>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed">
          Làm mới phiên sẽ xóa toàn bộ lịch sử trò chuyện, bài đang làm, lỗi đã ghi nhớ và các bài tập tương tự. Hành động này không thể hoàn tác.
        </p>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold rounded-xl transition-all"
          >
            Giữ lại phiên
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-[#DC5A5A] hover:bg-red-600 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all active:scale-95"
          >
            <Trash2 className="w-4 h-4" />
            <span>Xóa và bắt đầu lại</span>
          </button>
        </div>
      </div>
    </div>
  );
}
