import React from "react";
import { LearningSession } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { Brain, X, Award, AlertCircle, FileText, CheckCircle, Trash2 } from "lucide-react";

interface BrainMemoryDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  session: LearningSession;
  onUpdateSession: (updated: LearningSession) => void;
}

export default function BrainMemoryDashboard({
  isOpen,
  onClose,
  session,
  onUpdateSession,
}: BrainMemoryDashboardProps) {
  const { profile, learningState, stepState, currentProblem } = session;

  const removeMasteredSkill = (skillName: string) => {
    const updated = {
      ...session,
      learningState: {
        ...session.learningState,
        masteredSkills: session.learningState.masteredSkills.filter((s) => s.name !== skillName),
      },
    };
    onUpdateSession(updated);
  };

  const removeWeakSkill = (skillName: string) => {
    const updated = {
      ...session,
      learningState: {
        ...session.learningState,
        weakSkills: session.learningState.weakSkills.filter((s) => s.name !== skillName),
      },
    };
    onUpdateSession(updated);
  };

  const removeMistake = (mistakeType: string) => {
    const updated = {
      ...session,
      learningState: {
        ...session.learningState,
        recurringMistakes: session.learningState.recurringMistakes.filter((m) => m.type !== mistakeType),
      },
    };
    onUpdateSession(updated);
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

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-[420px] bg-white border-l border-[#CBEDE7]/60 shadow-2xl z-50 flex flex-col h-full font-sans"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-[#CBEDE7]/60 bg-[#F7FFFD]">
              <div className="flex items-center gap-2.5">
                <Brain className="w-6 h-6 text-[#0F9D8A] animate-pulse" />
                <div>
                  <h3 className="font-bold text-[#163A3A] text-base font-display tracking-tight">BỘ NHỚ TRỢ LÝ AI</h3>
                  <p className="text-[11px] text-[#587272]">Trí nhớ lớp học & kỹ năng trong phiên</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-[#CBEDE7]/40 text-[#163A3A] transition-colors cursor-pointer"
                aria-label="Đóng bảng bộ nhớ"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content list */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-white">
              {/* Profile details */}
              <div className="bg-[#F7FFFD] border border-[#CBEDE7]/60 rounded-xl p-4 space-y-3">
                <h4 className="text-[#163A3A] font-bold text-xs uppercase tracking-wider">
                  Cấu hình học tập hiện tại
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-white border border-[#CBEDE7]/40 rounded-xl p-2.5 shadow-sm">
                    <span className="text-[10px] text-[#587272] uppercase font-bold block mb-0.5">Lớp học</span>
                    <span className="font-bold text-[#163A3A] text-base">Lớp {profile.selectedGrade}</span>
                  </div>
                  <div className="bg-white border border-[#CBEDE7]/40 rounded-xl p-2.5 shadow-sm">
                    <span className="text-[10px] text-[#587272] uppercase font-bold block mb-0.5">Kiến thức</span>
                    <span className="font-bold text-[#163A3A] text-base">
                      {profile.knowledgeLevel === "basic" ? "Cơ bản" : "Nâng cao"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Step completion progress */}
              {stepState.totalSteps > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[#163A3A] font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-[#0F9D8A]" />
                    Tiến độ Step Coach
                  </h4>
                  <div className="bg-white border border-[#CBEDE7]/40 rounded-xl p-4 shadow-sm space-y-2.5">
                    <div className="flex justify-between text-sm text-[#163A3A]">
                      <span className="font-semibold">Bước hiện tại</span>
                      <span className="font-bold">
                        {stepState.completedStepIds.length} / {stepState.totalSteps} bước
                      </span>
                    </div>
                    <div className="w-full bg-[#CBEDE7]/30 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#0F9D8A] h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${(stepState.completedStepIds.length / stepState.totalSteps) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Mastered Skills */}
              <div className="space-y-2">
                <h4 className="text-[#163A3A] font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-emerald-600" />
                  Kỹ năng đã làm tốt ({learningState.masteredSkills.length})
                </h4>
                {learningState.masteredSkills.length === 0 ? (
                  <p className="text-xs text-[#587272] italic pl-1">Chưa ghi nhận kỹ năng nào.</p>
                ) : (
                  <div className="space-y-2">
                    {learningState.masteredSkills.map((skill) => (
                      <div
                        key={skill.name}
                        className="flex items-center justify-between bg-[#F7FFFD] border border-emerald-100 rounded-xl p-3"
                      >
                        <span className="text-xs sm:text-sm font-medium text-emerald-900">{skill.name}</span>
                        <button
                          onClick={() => removeMasteredSkill(skill.name)}
                          className="text-emerald-700 hover:text-red-500 transition-colors p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Weak Skills / Misconceptions */}
              <div className="space-y-2">
                <h4 className="text-[#163A3A] font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-[#FF8A00]" />
                  Điểm cần chú ý ({learningState.weakSkills.length})
                </h4>
                {learningState.weakSkills.length === 0 ? (
                  <p className="text-xs text-[#587272] italic pl-1">Chưa phát hiện điểm yếu nào.</p>
                ) : (
                  <div className="space-y-2">
                    {learningState.weakSkills.map((skill) => (
                      <div
                        key={skill.name}
                        className="flex items-center justify-between bg-amber-50/50 border border-amber-100 rounded-xl p-3"
                      >
                        <span className="text-xs sm:text-sm font-medium text-amber-900">{skill.name}</span>
                        <button
                          onClick={() => removeWeakSkill(skill.name)}
                          className="text-amber-700 hover:text-red-500 transition-colors p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recurring Mistakes */}
              <div className="space-y-2">
                <h4 className="text-[#163A3A] font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-[#DC5A5A]" />
                  Lỗi lặp lại ({learningState.recurringMistakes.length})
                </h4>
                {learningState.recurringMistakes.length === 0 ? (
                  <p className="text-xs text-[#587272] italic pl-1">Chưa ghi nhận lỗi lặp lại.</p>
                ) : (
                  <div className="space-y-2">
                    {learningState.recurringMistakes.map((mistake) => (
                      <div
                        key={mistake.type}
                        className="flex items-center justify-between bg-red-50/50 border border-red-100 rounded-xl p-3"
                      >
                        <div className="text-left">
                          <span className="text-xs sm:text-sm font-semibold text-red-900 block">{mistake.type}</span>
                          <span className="text-xs text-red-700">{mistake.description}</span>
                        </div>
                        <button
                          onClick={() => removeMistake(mistake.type)}
                          className="text-red-700 hover:text-red-500 transition-colors p-1 shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Compact summary */}
              <div className="space-y-2 border-t border-[#CBEDE7]/40 pt-4">
                <h4 className="text-[#163A3A] font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-[#0F9D8A]" />
                  Ghi chú tổng kết phiên
                </h4>
                <div className="bg-[#F7FFFD] border border-[#CBEDE7]/50 rounded-xl p-4 text-xs text-[#163A3A] italic leading-relaxed">
                  {session.compactSessionSummary || "Đang học hỏi và đồng hành cùng em..."}
                </div>
              </div>
            </div>

            {/* Footer warning info */}
            <div className="p-4 bg-[#F7FFFD] border-t border-[#CBEDE7]/50 text-[10px] sm:text-xs text-[#587272] text-center">
              Trí nhớ này tồn tại suốt cả phiên học hiện tại. Kế hoạch giải bài được giữ bảo mật để kích thích tư duy tự lập.
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
