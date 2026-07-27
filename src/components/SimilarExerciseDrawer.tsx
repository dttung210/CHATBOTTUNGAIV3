import React from "react";
import { SimilarExercise } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, X, ChevronRight, Bookmark, Check } from "lucide-react";
import MathRenderer from "./MathRenderer";

interface SimilarExerciseDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  exercises: SimilarExercise[];
  onSelectExercise: (exercise: SimilarExercise) => void;
}

export default function SimilarExerciseDrawer({
  isOpen,
  onClose,
  exercises,
  onSelectExercise,
}: SimilarExerciseDrawerProps) {
  // Save status map to avoid window.alert
  const [savedIds, setSavedIds] = React.useState<Record<string, boolean>>({});

  const handleSaveExercise = (exId: string) => {
    setSavedIds((prev) => ({ ...prev, [exId]: !prev[exId] }));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#163A3A] z-40 cursor-pointer"
          />

          {/* Drawer / Bottom sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 180 }}
            className="fixed bottom-0 left-0 right-0 max-h-[85vh] bg-white border-t border-[#CBEDE7]/60 rounded-t-3xl shadow-2xl z-50 flex flex-col font-sans"
          >
            {/* Grab handle for touch feel */}
            <div className="w-12 h-1.5 bg-[#CBEDE7]/60 rounded-full mx-auto my-3 shrink-0" />

            {/* Header */}
            <div className="px-6 pb-4 border-b border-[#CBEDE7]/40 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-amber-500 fill-amber-500" />
                <div>
                  <h3 className="font-bold text-[#163A3A] text-base font-display">BÀI TẬP LUYỆN TẬP TƯƠNG TỰ</h3>
                  <p className="text-xs text-[#587272]">Rèn luyện kỹ năng giải bài và làm chủ phương pháp</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-[#CBEDE7]/40 text-[#163A3A] transition-colors cursor-pointer"
                aria-label="Đóng bảng luyện tập"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Exercises List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white">
              {exercises.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <p className="text-slate-400 italic">Đang tải danh sách bài tập tương tự từ Thầy Tùng AI...</p>
                </div>
              ) : (
                exercises.map((ex, index) => {
                  const exId = ex.id || `ex_${index}`;
                  const isSaved = !!savedIds[exId];
                  return (
                    <div
                      key={exId}
                      className="bg-white border border-[#CBEDE7]/50 hover:border-[#0F9D8A]/70 rounded-xl p-5 shadow-sm hover:shadow transition-all group relative overflow-hidden"
                    >
                      {/* Ribbon or Badge */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-[#0F9D8A] bg-[#CBEDE7]/30 px-2.5 py-1 rounded-md uppercase">
                          Bài {index + 1}
                        </span>
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                            ex.difficulty === "easier"
                              ? "bg-emerald-50 text-emerald-800"
                              : ex.difficulty === "harder"
                              ? "bg-rose-50 text-red-800"
                              : "bg-amber-50 text-amber-800"
                          }`}
                        >
                          {ex.difficulty === "easier"
                            ? "Dễ hơn một mức"
                            : ex.difficulty === "harder"
                            ? "Khó hơn một mức"
                            : "Độ khó tương đương"}
                        </span>
                      </div>

                      {/* Math Problem Renderer */}
                      <div className="text-slate-800 text-sm sm:text-base leading-relaxed mb-4">
                        <MathRenderer content={ex.problemText} />
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                        <button
                          onClick={() => onSelectExercise(ex)}
                          className="w-full sm:w-auto flex items-center justify-center gap-1 bg-[#FF8A00] hover:bg-[#E07A00] text-white font-bold text-xs sm:text-sm px-5 py-3 rounded-xl shadow-md transition-all cursor-pointer active:scale-95 whitespace-nowrap"
                        >
                          <span>Làm bài tập này</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleSaveExercise(exId)}
                          className={`w-full sm:w-auto flex items-center justify-center gap-1.5 border font-bold text-xs sm:text-sm px-5 py-3 rounded-xl transition-all cursor-pointer ${
                            isSaved
                              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                              : "border-[#CBEDE7] text-[#0F9D8A] hover:bg-[#CBEDE7]/10"
                          }`}
                        >
                          {isSaved ? (
                            <>
                              <Check className="w-4 h-4" />
                              <span>Đã lưu vào nháp</span>
                            </>
                          ) : (
                            <>
                              <Bookmark className="w-4 h-4" />
                              <span>Lưu làm sau</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom notification spacing */}
            <div className="p-4 bg-[#F7FFFD] border-t border-[#CBEDE7]/40 text-xs text-center text-[#587272]">
              Lưu ý: Đáp án và lời giải chi tiết sẽ chỉ hiển thị khi em bắt đầu làm bài luyện tập.
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
