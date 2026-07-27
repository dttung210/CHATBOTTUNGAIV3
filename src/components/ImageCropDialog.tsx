import React, { useState, useEffect } from "react";
import { RotateCw, RotateCcw, ZoomIn, ZoomOut, Check, X, AlertTriangle } from "lucide-react";

interface ImageCropDialogProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  fileSize?: number; // bytes
  onConfirm: (modifiedBase64: string) => void;
}

export default function ImageCropDialog({
  isOpen,
  onClose,
  imageUrl,
  fileSize,
  onConfirm,
}: ImageCropDialogProps) {
  const [rotation, setRotation] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(1);
  const [isTooSmall, setIsTooSmall] = useState<boolean>(false);

  useEffect(() => {
    if (fileSize && fileSize < 5120) {
      // < 5KB is very small, might be pixelated
      setIsTooSmall(true);
    } else {
      setIsTooSmall(false);
    }
    // Reset view
    setRotation(0);
    setZoom(1);
  }, [imageUrl, fileSize]);

  const rotateLeft = () => setRotation((prev) => (prev - 90) % 360);
  const rotateRight = () => setRotation((prev) => (prev + 90) % 360);
  const zoomIn = () => setZoom((prev) => Math.min(3, prev + 0.25));
  const zoomOut = () => setZoom((prev) => Math.max(0.5, prev - 0.25));

  const handleApply = () => {
    // Generate modified image using HTML5 Canvas (applies rotation and zoom)
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Handle orientation dimensions
      const is90 = Math.abs(rotation % 180) === 90;
      const width = is90 ? img.height : img.width;
      const height = is90 ? img.width : img.height;

      canvas.width = width;
      canvas.height = height;

      // Translate to center to rotate
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      
      // Draw zoomed
      const dWidth = img.width * zoom;
      const dHeight = img.height * zoom;
      ctx.drawImage(img, -dWidth / 2, -dHeight / 2, dWidth, dHeight);

      const modifiedBase64 = canvas.toDataURL("image/jpeg", 0.85);
      onConfirm(modifiedBase64);
    };
    img.src = imageUrl;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col border border-teal-50">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-teal-50/30">
          <div>
            <h3 className="font-bold text-[#163A3A] text-base sm:text-lg">
              Điều chỉnh & Quản lý ảnh đề bài
            </h3>
            {fileSize && (
              <span className="text-xs text-slate-500">
                Kích thước tệp: {(fileSize / 1024).toFixed(1)} KB
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workspace Canvas Area */}
        <div className="flex-1 bg-slate-100 p-8 min-h-[250px] max-h-[380px] overflow-hidden flex items-center justify-center relative">
          <div
            className="transition-transform duration-200 ease-out"
            style={{
              transform: `rotate(${rotation}deg) scale(${zoom})`,
            }}
          >
            <img
              src={imageUrl}
              alt="Xem trước đề bài"
              className="max-h-[220px] max-w-full rounded-lg shadow-md object-contain"
            />
          </div>

          {isTooSmall && (
            <div className="absolute top-2 left-2 right-2 bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-start gap-2 shadow">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800 leading-tight">
                <strong>Cảnh báo:</strong> Ảnh có dung lượng rất nhỏ hoặc mờ. Chữ viết có thể khó nhận diện chính xác.
              </p>
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-3">
          <button
            onClick={rotateLeft}
            className="p-2.5 bg-white border border-slate-200 hover:border-teal-300 hover:bg-teal-50/20 text-slate-700 rounded-xl transition-all"
            title="Xoay trái"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={rotateRight}
            className="p-2.5 bg-white border border-slate-200 hover:border-teal-300 hover:bg-teal-50/20 text-slate-700 rounded-xl transition-all"
            title="Xoay phải"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <div className="w-px h-6 bg-slate-200 mx-1" />
          <button
            onClick={zoomIn}
            className="p-2.5 bg-white border border-slate-200 hover:border-teal-300 hover:bg-teal-50/20 text-slate-700 rounded-xl transition-all"
            title="Phóng to"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={zoomOut}
            className="p-2.5 bg-white border border-slate-200 hover:border-teal-300 hover:bg-teal-50/20 text-slate-700 rounded-xl transition-all"
            title="Thu nhỏ"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>

        {/* Accept Buttons */}
        <div className="p-5 border-t border-slate-100 flex items-center justify-end gap-2 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold rounded-xl transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            onClick={handleApply}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>Xác nhận ảnh này</span>
          </button>
        </div>
      </div>
    </div>
  );
}
