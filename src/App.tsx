import React, { useState, useEffect, useRef } from "react";
import {
  GradeType,
  StudentAbility,
  KnowledgeLevel,
  SupportMode,
  LearningSession,
  Message,
  ExtractedProblem,
  SimilarExercise,
  GeometrySpecResponse,
} from "./types";
import { saveSession, loadLatestSession, clearAllSessions } from "./utils/db";
import MathRenderer from "./components/MathRenderer";
import GeometryInlineLab from "./components/GeometryInlineLab";
import BrainMemoryDashboard from "./components/BrainMemoryDashboard";
import SimilarExerciseDrawer from "./components/SimilarExerciseDrawer";
import ImageCropDialog from "./components/ImageCropDialog";
import ResetDialog from "./components/ResetDialog";
import { motion, AnimatePresence } from "motion/react";
import {
  Brain,
  Camera,
  Image as ImageIcon,
  Paperclip,
  Send,
  Sparkles,
  HelpCircle,
  TrendingUp,
  RefreshCw,
  Plus,
  Trash2,
  Check,
  ChevronRight,
  Loader2,
  BookOpen,
  ArrowRight,
} from "lucide-react";

export default function App() {
  // Session States
  const [session, setSession] = useState<LearningSession | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [ocrStage, setOcrStage] = useState<number>(0); // 0: none, 1: quality, 2: ocr, 3: normalizing, 4: ready
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Setup Form States (Proposed default selections)
  const [formGrade, setFormGrade] = useState<GradeType>(9);
  const [formAbility, setFormAbility] = useState<StudentAbility>("average_good");
  const [formLevel, setFormLevel] = useState<KnowledgeLevel>("basic");
  const [formMode, setFormMode] = useState<SupportMode>("hints");

  // Interaction State
  const [inputText, setInputText] = useState<string>("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [pendingImageSize, setPendingImageSize] = useState<number | undefined>(undefined);
  const [editPromptMode, setEditPromptMode] = useState<boolean>(false);
  const [tempProblemText, setTempProblemText] = useState<string>("");

  // Drawer & Dialog visibility toggles
  const [isBrainOpen, setIsBrainOpen] = useState<boolean>(false);
  const [isExerciseOpen, setIsExerciseOpen] = useState<boolean>(false);
  const [isCropOpen, setIsCropOpen] = useState<boolean>(false);
  const [isResetOpen, setIsResetOpen] = useState<boolean>(false);

  // References
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Load latest persistent session on mount
  useEffect(() => {
    async function loadSession() {
      const saved = await loadLatestSession();
      if (saved) {
        setSession(saved);
      }
      setIsInitialized(true);
    }
    loadSession();
  }, []);

  // Save session when updated
  const updateAndSaveSession = async (newSession: LearningSession) => {
    setSession(newSession);
    await saveSession(newSession);
  };

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages, ocrStage]);

  // Handle Drag & Drop + Clipboard Pasting inside App
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
            const blob = items[i].getAsFile();
            if (blob) {
              const reader = new FileReader();
              reader.onload = () => {
                setPendingImage(reader.result as string);
                setPendingImageSize(blob.size);
                setIsCropOpen(true);
              };
              reader.readAsDataURL(blob);
            }
          }
        }
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => {
          setPendingImage(reader.result as string);
          setPendingImageSize(file.size);
          setIsCropOpen(true);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Start Session handler
  const startSession = async (useSuggested: boolean = false) => {
    const grade = useSuggested ? 9 : formGrade;
    const ability = useSuggested ? "average_good" : formAbility;
    const level = useSuggested ? "basic" : formLevel;
    const mode = useSuggested ? "hints" : formMode;

    const newSession: LearningSession = {
      sessionId: `session_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      profile: {
        selectedGrade: grade,
        studentAbility: ability,
        knowledgeLevel: level,
        preferredMode: mode,
        preferredHintDepth: 1,
      },
      currentProblemId: null,
      currentProblem: null,
      messages: [
        {
          id: `msg_welcome_${Date.now()}`,
          sender: "assistant" as "assistant",
          timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
          text: `**Chào em! Thầy là Thầy Tùng AI – Trợ lý học Toán của em.** 🌸\n\nThầy rất vui được đồng hành cùng em học tập hôm nay. Phương châm của Thầy là: **"Gợi đúng lúc – Học từng bước – Trình bày chuẩn thi"**.\n\nHãy gửi đề bài Toán bằng cách nhập văn bản hoặc tải ảnh chụp đề bài lên đây, Thầy sẽ giúp em làm chủ phương pháp giải quyết nhé!`,
        },
      ],
      conversations: [],
      extractedProblems: [],
      generatedExercises: [],
      learningState: {
        masteredSkills: [],
        weakSkills: [],
        recurringMistakes: [],
        misconceptions: [],
        successfulStrategies: [],
      },
      stepState: {
        hiddenPlanId: null,
        currentStepNumber: 1,
        totalSteps: 0,
        attemptsByStep: {},
        completedStepIds: [],
      },
      compactSessionSummary: "Bắt đầu phiên học toán.",
    };

    await updateAndSaveSession(newSession);
  };

  // Reset/Clear Session handler
  const handleResetSession = async () => {
    await clearAllSessions();
    setSession(null);
    setOcrStage(0);
    setPendingImage(null);
  };

  // File picker handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setPendingImage(reader.result as string);
        setPendingImageSize(file.size);
        setIsCropOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  // Confirm image from crop/rotate dialog
  const handleConfirmModifiedImage = (base64: string) => {
    setPendingImage(base64);
    setIsCropOpen(false);
    triggerOCR(base64);
  };

  // OCR Processing Pipeline Simulation + API Call
  const triggerOCR = async (base64Image: string) => {
    if (!session) return;
    setLoading(true);
    setErrorMessage(null);

    // Progression of stages matching states requirements
    setOcrStage(1); // checking quality
    await new Promise((r) => setTimeout(r, 900));
    setOcrStage(2); // recognizing problem
    await new Promise((r) => setTimeout(r, 1000));
    setOcrStage(3); // normalizing formula
    await new Promise((r) => setTimeout(r, 900));

    try {
      const res = await fetch("/api/analyze-problem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64Image,
          grade: session.profile.selectedGrade,
        }),
      });

      if (!res.ok) {
        throw new Error("Lỗi khi kết nối hệ thống phân tích đề bài.");
      }

      const problemData: ExtractedProblem = await res.json();

      // Stage 4: Ask student to check OCR
      setOcrStage(4);
      setTempProblemText(problemData.normalizedProblem);

      const reviewMessage: Message = {
        id: `msg_review_${Date.now()}`,
        sender: "assistant" as "assistant",
        timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        text: "Thầy đã quét và nhận diện được đề toán từ ảnh em gửi. Em hãy kiểm tra xem nội dung bên dưới đã hoàn toàn chính xác chưa nhé:",
        image: base64Image,
        reviewProblem: problemData,
      };

      const updated = {
        ...session,
        messages: [...session.messages, reviewMessage],
      };
      await updateAndSaveSession(updated);
    } catch (err: any) {
      setErrorMessage(err.message || "Không thể phân tích ảnh. Em hãy thử chụp lại rõ nét hơn.");
      setOcrStage(0);
    } finally {
      setLoading(false);
    }
  };

  // Edit OCR manually if confidence is low
  const handleSaveEditedProblem = async (msgId: string, originalProblem: ExtractedProblem) => {
    if (!session) return;
    const updatedProblem = {
      ...originalProblem,
      normalizedProblem: tempProblemText,
    };

    const updatedMessages = session.messages.map((m) => {
      if (m.id === msgId) {
        return {
          ...m,
          reviewProblem: updatedProblem,
        };
      }
      return m;
    });

    const updated = {
      ...session,
      messages: updatedMessages,
    };
    await updateAndSaveSession(updated);
    setEditPromptMode(false);
  };

  // Confirm OCR correct & Trigger Tutoring Engine
  const handleConfirmProblemCorrect = async (problem: ExtractedProblem) => {
    if (!session) return;
    setLoading(true);
    setOcrStage(0); // completed OCR verification

    // Insert user confirmation log
    const userConfirmMsg: Message = {
      id: `msg_user_confirm_${Date.now()}`,
      sender: "user" as "user",
      timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      text: "Đề bài nhận dạng đã chính xác rồi ạ! Nhờ Thầy hướng dẫn giúp em.",
    };

    // Prepare session update
    let updatedSession = {
      ...session,
      currentProblem: problem,
      currentProblemId: `problem_${Date.now()}`,
      messages: [...session.messages, userConfirmMsg],
    };

    try {
      // Check if we need geometry visualization
      let geoSpec: GeometrySpecResponse | null = null;
      if (problem.problemType === "geometry") {
        const geoRes = await fetch("/api/generate-geometry-spec", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ problem }),
        });
        if (geoRes.ok) {
          geoSpec = await geoRes.json();
        }
      }

      // Generate tutoring response based on standard mode selected
      const tutorRes = await fetch("/api/generate-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem,
          mode: session.profile.preferredMode,
          grade: session.profile.selectedGrade,
          knowledgeLevel: session.profile.knowledgeLevel,
          ability: session.profile.studentAbility,
          compactSessionSummary: session.compactSessionSummary,
        }),
      });

      if (!tutorRes.ok) {
        throw new Error("Không thể kết nối dịch vụ hỗ trợ giải toán.");
      }

      const tutorData = await tutorRes.json();

      const assistantMsg: Message = {
        id: `msg_tutor_${Date.now()}`,
        sender: "assistant" as "assistant",
        timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        geometrySpec: geoSpec,
      };

      if (session.profile.preferredMode === "hints") {
        assistantMsg.hints = tutorData;
      } else if (session.profile.preferredMode === "step_by_step") {
        assistantMsg.step = tutorData;
        // Update Step Coach state trackers
        updatedSession.stepState = {
          hiddenPlanId: `plan_${Date.now()}`,
          currentStepNumber: 1,
          totalSteps: tutorData.progress?.total || 4,
          attemptsByStep: {},
          completedStepIds: [],
        };
      } else {
        assistantMsg.examSolution = tutorData;
      }

      updatedSession.messages.push(assistantMsg);
      await updateAndSaveSession(updatedSession);
    } catch (err: any) {
      setErrorMessage(err.message || "Gặp sự cố khi kết nối trí tuệ nhân tạo của Thầy.");
    } finally {
      setLoading(false);
    }
  };

  // Submit plain text problem
  const handleSendTextProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !session) return;

    const userText = inputText.trim();
    setInputText("");
    setLoading(true);
    setErrorMessage(null);

    const userMsg: Message = {
      id: `msg_user_${Date.now()}`,
      sender: "user" as "user",
      timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      text: userText,
    };

    let updatedSession = {
      ...session,
      messages: [...session.messages, userMsg],
    };
    await updateAndSaveSession(updatedSession);

    try {
      // Simulate normal text extraction and formatting via analyze API
      const res = await fetch("/api/analyze-problem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: userText,
          grade: session.profile.selectedGrade,
        }),
      });

      if (!res.ok) {
        throw new Error("Không trích xuất được văn bản đề bài.");
      }

      const problemData: ExtractedProblem = await res.json();
      
      // Let's directly solve/guide without reviewing step if text is highly confident (>0.8)
      if (problemData.confidence > 0.8) {
        let geoSpec: GeometrySpecResponse | null = null;
        if (problemData.problemType === "geometry") {
          const geoRes = await fetch("/api/generate-geometry-spec", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ problem: problemData }),
          });
          if (geoRes.ok) {
            geoSpec = await geoRes.json();
          }
        }

        const tutorRes = await fetch("/api/generate-response", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            problem: problemData,
            mode: session.profile.preferredMode,
            grade: session.profile.selectedGrade,
            knowledgeLevel: session.profile.knowledgeLevel,
            ability: session.profile.studentAbility,
            compactSessionSummary: session.compactSessionSummary,
          }),
        });

        if (!tutorRes.ok) {
          throw new Error("Không tạo được phương án hướng dẫn.");
        }

        const tutorData = await tutorRes.json();

        const assistantMsg: Message = {
          id: `msg_tutor_${Date.now()}`,
          sender: "assistant" as "assistant",
          timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
          geometrySpec: geoSpec,
        };

        updatedSession.currentProblem = problemData;
        updatedSession.currentProblemId = `problem_${Date.now()}`;

        if (session.profile.preferredMode === "hints") {
          assistantMsg.hints = tutorData;
        } else if (session.profile.preferredMode === "step_by_step") {
          assistantMsg.step = tutorData;
          updatedSession.stepState = {
            hiddenPlanId: `plan_${Date.now()}`,
            currentStepNumber: 1,
            totalSteps: tutorData.progress?.total || 4,
            attemptsByStep: {},
            completedStepIds: [],
          };
        } else {
          assistantMsg.examSolution = tutorData;
        }

        updatedSession.messages.push(assistantMsg);
        await updateAndSaveSession(updatedSession);
      } else {
        // Ask to verify OCR if confidence is low
        const reviewMessage: Message = {
          id: `msg_review_${Date.now()}`,
          sender: "assistant" as "assistant",
          timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
          text: "Đề bài của em viết tay hoặc mô tả hơi phức tạp. Nhờ em kiểm tra xem nội dung trích xuất này đúng chưa nhé:",
          reviewProblem: problemData,
        };
        updatedSession.messages.push(reviewMessage);
        await updateAndSaveSession(updatedSession);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Lỗi khi truyền tải câu hỏi.");
    } finally {
      setLoading(false);
    }
  };

  // Next step handler
  const handleNextStep = async (currentStepObj: any) => {
    if (!session || !session.currentProblem) return;
    setLoading(true);

    let nextStepNum = session.stepState.currentStepNumber + 1;
    let completedIds = [...session.stepState.completedStepIds, currentStepObj.stepId];

    let updatedSession = {
      ...session,
      stepState: {
        ...session.stepState,
        currentStepNumber: nextStepNum,
        completedStepIds: completedIds,
      },
    };

    try {
      if (nextStepNum <= session.stepState.totalSteps) {
        const nextStepRes = await fetch("/api/generate-response", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            problem: session.currentProblem,
            mode: "step_by_step",
            grade: session.profile.selectedGrade,
            knowledgeLevel: session.profile.knowledgeLevel,
            ability: session.profile.studentAbility,
            currentStepNumber: nextStepNum,
            compactSessionSummary: session.compactSessionSummary,
          }),
        });

        if (nextStepRes.ok) {
          const nextStepData = await nextStepRes.json();
          const nextStepMsg = {
            id: `msg_next_step_${Date.now()}`,
            sender: "assistant" as "assistant",
            timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
            step: nextStepData,
          };
          updatedSession.messages = [...updatedSession.messages, nextStepMsg];
        }
      } else {
        const completionMsg = {
          id: `msg_step_complete_${Date.now()}`,
          sender: "assistant" as "assistant",
          timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
          text: `🎉 **Chúc mừng em! Em đã hoàn thành xuất sắc tất cả ${session.stepState.totalSteps} bước giải bài toán.**\n\nBây giờ em có thể chuyển sang chế độ Lời giải chuẩn thi cử để xem lại toàn bộ cách trình bày hoàn chỉnh nhé!`,
        };
        updatedSession.messages = [...updatedSession.messages, completionMsg];
      }

      await updateAndSaveSession(updatedSession);
    } catch (err: any) {
      setErrorMessage(err.message || "Lỗi khi chuyển sang bước tiếp theo.");
    } finally {
      setLoading(false);
    }
  };

  // Switch modes dynamically (💡 Gợi ý, 📋 Từng bước, ✅ Lời giải thi cử)
  const handleSwitchMode = async (newMode: SupportMode) => {
    if (!session) return;

    // Direct mode update
    const updatedProfile = {
      ...session.profile,
      preferredMode: newMode,
    };

    let updatedSession = {
      ...session,
      profile: updatedProfile,
    };

    // If there is an active problem, regenerate the tutoring response instantly for the new mode!
    if (session.currentProblem) {
      setLoading(true);
      const userSwitchLog: Message = {
        id: `msg_user_switch_${Date.now()}`,
        sender: "user" as "user",
        timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        text: `Em muốn chuyển sang chế độ hỗ trợ: **${
          newMode === "hints" ? "Gợi ý" : newMode === "step_by_step" ? "Từng bước" : "Lời giải chuẩn thi cử"
        }**`,
      };

      updatedSession.messages.push(userSwitchLog);

      try {
        const res = await fetch("/api/generate-response", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            problem: session.currentProblem,
            mode: newMode,
            grade: session.profile.selectedGrade,
            knowledgeLevel: session.profile.knowledgeLevel,
            ability: session.profile.studentAbility,
            compactSessionSummary: session.compactSessionSummary,
            currentStepNumber: 1,
          }),
        });

        if (!res.ok) {
          throw new Error("Lỗi khi tái khởi động chế độ mới.");
        }

        const tutorData = await res.json();

        const assistantMsg: Message = {
          id: `msg_tutor_${Date.now()}`,
          sender: "assistant" as "assistant",
          timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        };

        if (newMode === "hints") {
          assistantMsg.hints = tutorData;
        } else if (newMode === "step_by_step") {
          assistantMsg.step = tutorData;
          updatedSession.stepState = {
            hiddenPlanId: `plan_${Date.now()}`,
            currentStepNumber: 1,
            totalSteps: tutorData.progress?.total || 4,
            attemptsByStep: {},
            completedStepIds: [],
          };
        } else {
          assistantMsg.examSolution = tutorData;
        }

        updatedSession.messages.push(assistantMsg);
        await updateAndSaveSession(updatedSession);
      } catch (err: any) {
        setErrorMessage(err.message || "Sự cố khi nạp phản hồi chế độ mới.");
      } finally {
        setLoading(false);
      }
    } else {
      await updateAndSaveSession(updatedSession);
    }
  };

  // Toggle Basic vs Advanced level switch
  const handleToggleLevel = (newLevel: KnowledgeLevel) => {
    if (!session) return;
    if (newLevel === "advanced") {
      const confirmMsg =
        "Chế độ Nâng cao có thể sử dụng kiến thức mở rộng hoặc phương pháp vượt ngoài yêu cầu cơ bản của lớp. Em có muốn tiếp tục không?";
      if (window.confirm(confirmMsg)) {
        const updated = {
          ...session,
          profile: {
            ...session.profile,
            knowledgeLevel: "advanced" as const,
          },
        };
        updateAndSaveSession(updated);
      }
    } else {
      const updated = {
        ...session,
        profile: {
          ...session.profile,
          knowledgeLevel: "basic" as const,
        },
      };
      updateAndSaveSession(updated);
    }
  };

  // Trigger Similar math problem generation (Cam CTA button)
  const handleTriggerSimilarExercises = async () => {
    if (!session || !session.currentProblem) return;
    setLoading(true);
    setIsExerciseOpen(true);

    try {
      const res = await fetch("/api/generate-similar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem: session.currentProblem,
          grade: session.profile.selectedGrade,
          knowledgeLevel: session.profile.knowledgeLevel,
          count: 3,
        }),
      });

      if (!res.ok) {
        throw new Error("Lỗi khi thiết lập bài tập tương đương.");
      }

      const similarData = await res.json(); // contains exercises

      const updated = {
        ...session,
        generatedExercises: similarData.exercises,
      };
      await updateAndSaveSession(updated);
    } catch (err: any) {
      alert(err.message || "Gặp sự cố khi nạp danh sách bài tập luyện tập.");
    } finally {
      setLoading(false);
    }
  };

  // Explain a specific hint and generate a new simpler sub-hint
  const handleExplainHint = async (messageId: string, hintId: string) => {
    if (!session || !session.currentProblem) return;

    // Toggle loading state for this specific hint inside messages list
    const updatedMessages = session.messages.map((m) => {
      if (m.id === messageId && m.hints) {
        const updatedHints = m.hints.hints.map((h) => {
          if (h.id === hintId) {
            return { ...h, isExplaining: true };
          }
          return h;
        });
        return { ...m, hints: { ...m.hints, hints: updatedHints } };
      }
      return m;
    });

    let updatedSession = {
      ...session,
      messages: updatedMessages,
    };
    setSession(updatedSession);

    try {
      // Find the specific hint to explain
      const msg = session.messages.find((m) => m.id === messageId);
      const hintItem = msg?.hints?.hints.find((h) => h.id === hintId);

      if (!hintItem) return;

      const res = await fetch("/api/explain-hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem: session.currentProblem,
          hintTitle: hintItem.title,
          hintContent: hintItem.content,
          grade: session.profile.selectedGrade,
          knowledgeLevel: session.profile.knowledgeLevel,
          ability: session.profile.studentAbility,
        }),
      });

      if (!res.ok) {
        throw new Error("Không thể kết nối máy chủ để giải thích gợi ý.");
      }

      const explainData = await res.json(); // contains explanation, newSubHint

      // Update the message with explanation data
      const finalMessages = session.messages.map((m) => {
        if (m.id === messageId && m.hints) {
          const updatedHints = m.hints.hints.map((h) => {
            if (h.id === hintId) {
              return {
                ...h,
                isExplaining: false,
                explanation: explainData.explanation,
                newSubHint: explainData.newSubHint,
              };
            }
            return h;
          });
          return { ...m, hints: { ...m.hints, hints: updatedHints } };
        }
        return m;
      });

      updatedSession = {
        ...session,
        messages: finalMessages,
      };
      await updateAndSaveSession(updatedSession);
    } catch (err: any) {
      // Clear loading state on error
      const rollbackMessages = session.messages.map((m) => {
        if (m.id === messageId && m.hints) {
          const updatedHints = m.hints.hints.map((h) => {
            if (h.id === hintId) {
              return { ...h, isExplaining: false };
            }
            return h;
          });
          return { ...m, hints: { ...m.hints, hints: updatedHints } };
        }
        return m;
      });
      setSession({
        ...session,
        messages: rollbackMessages,
      });
      alert(err.message || "Gặp lỗi khi giải thích gợi ý.");
    }
  };

  // Select loaded similar exercise from Drawer to solve
  const handleLoadExerciseToWorkspace = async (ex: SimilarExercise) => {
    if (!session) return;
    setIsExerciseOpen(false);

    const problemData: ExtractedProblem = {
      rawText: ex.problemText,
      normalizedProblem: ex.problemText,
      problemType: "algebra",
      topic: "Luyện tập kỹ năng toán",
      estimatedGrade: session.profile.selectedGrade,
      difficulty: "medium",
      givenData: [],
      requirements: ["Giải bài tập luyện tập"],
      latexSegments: [],
      ambiguousParts: [],
      confidence: 1.0,
    };

    setLoading(true);

    const userMsg: Message = {
      id: `msg_user_ex_${Date.now()}`,
      sender: "user" as "user",
      timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      text: `Em muốn luyện tập bài tương tự: **${ex.problemText}**`,
    };

    let updatedSession = {
      ...session,
      currentProblem: problemData,
      currentProblemId: `problem_${Date.now()}`,
      messages: [...session.messages, userMsg],
    };
    await updateAndSaveSession(updatedSession);

    try {
      const tutorRes = await fetch("/api/generate-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem: problemData,
          mode: session.profile.preferredMode,
          grade: session.profile.selectedGrade,
          knowledgeLevel: session.profile.knowledgeLevel,
          ability: session.profile.studentAbility,
          compactSessionSummary: session.compactSessionSummary,
        }),
      });

      if (!tutorRes.ok) {
        throw new Error("Lỗi nạp bài tập vào phòng học.");
      }

      const tutorData = await tutorRes.json();

      const assistantMsg: Message = {
        id: `msg_tutor_${Date.now()}`,
        sender: "assistant" as "assistant",
        timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      };

      if (session.profile.preferredMode === "hints") {
        assistantMsg.hints = tutorData;
      } else if (session.profile.preferredMode === "step_by_step") {
        assistantMsg.step = tutorData;
        updatedSession.stepState = {
          hiddenPlanId: `plan_${Date.now()}`,
          currentStepNumber: 1,
          totalSteps: tutorData.progress?.total || 4,
          attemptsByStep: {},
          completedStepIds: [],
        };
      } else {
        assistantMsg.examSolution = tutorData;
      }

      updatedSession.messages.push(assistantMsg);
      await updateAndSaveSession(updatedSession);
    } catch (err: any) {
      setErrorMessage(err.message || "Lỗi khi thiết lập câu hỏi.");
    } finally {
      setLoading(false);
    }
  };

  // Loading indicator for OCR
  const renderOcrStatus = () => {
    switch (ocrStage) {
      case 1:
        return "Đang kiểm tra chất lượng ảnh...";
      case 2:
        return "Đang nhận diện đề bài...";
      case 3:
        return "Đang chuẩn hóa công thức...";
      default:
        return "";
    }
  };

  // Return to Setup view if not initialized
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-[#F7FFFD] flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="min-h-screen bg-[#F7FFFD] text-[#163A3A] flex flex-col font-sans"
    >
      {/* 1. INITIAL SESSION SETUP VIEW */}
      {!session ? (
        <div className="flex-1 flex items-center justify-center p-6 max-w-lg mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-[#CBEDE7]/70 rounded-2xl p-6 sm:p-8 w-full shadow-sm space-y-6"
          >
            {/* Branding Header */}
            <div className="text-center space-y-3">
              <div className="inline-flex p-3.5 bg-[#F7FFFD] border border-[#CBEDE7]/50 rounded-2xl text-[#0F9D8A] mb-1">
                <Brain className="w-8 h-8 animate-pulse" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold font-display text-[#163A3A] tracking-tight">
                Thầy Tùng AI
              </h1>
              <p className="text-sm text-[#587272] max-w-sm mx-auto leading-relaxed">
                “Gợi đúng lúc – Học từng bước – Trình bày chuẩn thi”
              </p>
            </div>

            {/* Config Fields */}
            <div className="space-y-5 pt-2">
              {/* Grade Pick */}
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-semibold text-[#587272] block">
                  Lớp học của em
                </label>
                <select
                  value={formGrade}
                  onChange={(e) => setFormGrade(Number(e.target.value) as GradeType)}
                  className="w-full bg-[#F7FFFD] border border-[#CBEDE7]/60 rounded-xl p-3 text-sm focus:outline-none focus:border-[#0F9D8A] font-bold text-[#163A3A] transition-colors"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                    <option key={g} value={g}>
                      Lớp {g}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ability Pick */}
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-semibold text-[#587272] block">
                  Năng lực hiện tại
                </label>
                <select
                  value={formAbility}
                  onChange={(e) => setFormAbility(e.target.value as StudentAbility)}
                  className="w-full bg-[#F7FFFD] border border-[#CBEDE7]/60 rounded-xl p-3 text-sm focus:outline-none focus:border-[#0F9D8A] font-semibold text-[#163A3A] transition-colors"
                >
                  <option value="foundation">Cần củng cố nền tảng</option>
                  <option value="average">Trung bình</option>
                  <option value="average_good">Trung bình – Khá</option>
                  <option value="good">Khá</option>
                  <option value="advanced">Giỏi</option>
                </select>
              </div>

              {/* Level switch */}
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-semibold text-[#587272] block">
                  Mức độ kiến thức mong muốn
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setFormLevel("basic")}
                    className={`py-3 px-6 rounded-xl border text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                      formLevel === "basic"
                        ? "bg-[#0F9D8A] border-[#0F9D8A] text-white shadow-sm"
                        : "bg-[#F7FFFD] border-[#CBEDE7]/60 text-[#163A3A] hover:bg-[#CBEDE7]/10"
                    }`}
                  >
                    Cơ bản
                  </button>
                  <button
                    onClick={() => setFormLevel("advanced")}
                    className={`py-3 px-6 rounded-xl border text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                      formLevel === "advanced"
                        ? "bg-[#0F9D8A] border-[#0F9D8A] text-white shadow-sm"
                        : "bg-[#F7FFFD] border-[#CBEDE7]/60 text-[#163A3A] hover:bg-[#CBEDE7]/10"
                    }`}
                  >
                    Nâng cao
                  </button>
                </div>
              </div>

              {/* Support mode */}
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-semibold text-[#587272] block">
                  Chế độ hỗ trợ mặc định
                </label>
                <select
                  value={formMode}
                  onChange={(e) => setFormMode(e.target.value as SupportMode)}
                  className="w-full bg-[#F7FFFD] border border-[#CBEDE7]/60 rounded-xl p-3 text-sm focus:outline-none focus:border-[#0F9D8A] font-semibold text-[#163A3A] transition-colors"
                >
                  <option value="hints">💡 Gợi ý giải pháp</option>
                  <option value="step_by_step">📋 Gợi ý từng bước (Step Coach)</option>
                  <option value="exam_solution">✅ Lời giải chuẩn thi cử</option>
                </select>
              </div>
            </div>

            {/* Launcher Buttons */}
            <div className="flex flex-col gap-3 pt-4">
              <button
                onClick={() => startSession(false)}
                className="w-full bg-[#0F9D8A] hover:bg-[#0b7769] text-white font-bold py-3 px-6 rounded-xl shadow-sm transition-all active:scale-98 flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer hover:shadow-md"
              >
                <span>Bắt đầu phiên học</span>
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => startSession(true)}
                className="w-full bg-white border border-[#CBEDE7] text-[#0F9D8A] font-bold py-2.5 px-5 rounded-xl hover:bg-[#F7FFFD] transition-all text-xs sm:text-sm cursor-pointer"
              >
                Dùng thiết lập đề xuất (Lớp 9, Cơ bản)
              </button>
            </div>
          </motion.div>
        </div>
      ) : (
        /* 2. CHAT WORKSPACE & CONVERSATION PANEL */
        <div className="flex-1 flex flex-col h-screen relative overflow-hidden bg-[#F7FFFD]">
          {/* Header Panel */}
          <header className="bg-white border-b border-[#CBEDE7]/60 px-4 py-3 flex items-center justify-between shadow-sm shrink-0 z-10">
            <div className="flex items-center gap-3">
              {/* Logo rounded square */}
              <div className="w-10 h-10 rounded-xl bg-[#0F9D8A] flex items-center justify-center text-white font-bold text-lg shadow-sm font-display">
                T
              </div>
              <div className="text-left">
                <h2 className="font-bold text-[#163A3A] text-sm sm:text-base tracking-tight leading-none flex items-center gap-1.5">
                  <span className="font-display">Thầy Tùng AI</span>
                  <span className="text-[10px] text-[#0F9D8A] bg-[#F7FFFD] border border-[#CBEDE7]/60 px-2 py-0.5 rounded-md font-semibold">
                    Lớp {session.profile.selectedGrade}
                  </span>
                </h2>
                <span className="text-[10px] sm:text-xs text-[#587272]">Trợ lý học Toán chuyên sâu</span>
              </div>
            </div>

            {/* Quick config badges on header */}
            <div className="flex items-center gap-2">
              {/* Basic / Advanced switcher */}
              <div className="bg-[#F7FFFD] p-0.5 rounded-xl border border-[#CBEDE7]/50 flex items-center text-xs">
                <button
                  onClick={() => handleToggleLevel("basic")}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all text-[11px] whitespace-nowrap cursor-pointer ${
                    session.profile.knowledgeLevel === "basic" ? "bg-[#0F9D8A] text-white shadow-sm" : "text-[#587272]"
                  }`}
                >
                  Cơ bản
                </button>
                <button
                  onClick={() => handleToggleLevel("advanced")}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all text-[11px] whitespace-nowrap cursor-pointer ${
                    session.profile.knowledgeLevel === "advanced" ? "bg-[#0F9D8A] text-white shadow-sm" : "text-[#587272]"
                  }`}
                >
                  Nâng cao
                </button>
              </div>

              {/* Brain Brain indicators */}
              <button
                onClick={() => setIsBrainOpen(true)}
                className="p-2.5 bg-[#F7FFFD] border border-[#CBEDE7]/50 hover:bg-[#CBEDE7]/20 text-[#0F9D8A] rounded-xl transition-all shadow-sm relative group cursor-pointer"
                title="Bảng theo dõi trí nhớ AI"
              >
                <Brain className="w-4 h-4 sm:w-5 h-5 animate-pulse" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#FF8A00] rounded-full border border-white" />
              </button>

              {/* Menu click for refresh */}
              <button
                onClick={() => setIsResetOpen(true)}
                className="p-2.5 hover:bg-red-50/50 text-[#DC5A5A] rounded-xl transition-all border border-transparent hover:border-red-100 cursor-pointer"
                title="Làm mới toàn bộ phiên học"
              >
                <RefreshCw className="w-4 h-4 sm:w-5 h-5" />
              </button>
            </div>
          </header>

          {/* Tutoring Mode switcher toolbar */}
          <div className="bg-white border-b border-[#CBEDE7]/40 p-2.5 shrink-0 flex items-center justify-center gap-2 overflow-x-auto">
            <button
              onClick={() => handleSwitchMode("hints")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                session.profile.preferredMode === "hints"
                  ? "bg-[#0F9D8A] text-white shadow-sm"
                  : "bg-[#F7FFFD] border border-[#CBEDE7]/40 text-[#587272] hover:bg-[#CBEDE7]/10"
              }`}
            >
              💡 Gợi ý giải pháp
            </button>
            <button
              onClick={() => handleSwitchMode("step_by_step")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                session.profile.preferredMode === "step_by_step"
                  ? "bg-[#0F9D8A] text-white shadow-sm"
                  : "bg-[#F7FFFD] border border-[#CBEDE7]/40 text-[#587272] hover:bg-[#CBEDE7]/10"
              }`}
            >
              📋 Hướng dẫn từng bước
            </button>
            <button
              onClick={() => handleSwitchMode("exam_solution")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                session.profile.preferredMode === "exam_solution"
                  ? "bg-[#0F9D8A] text-white shadow-sm"
                  : "bg-[#F7FFFD] border border-[#CBEDE7]/40 text-[#587272] hover:bg-[#CBEDE7]/10"
              }`}
            >
              ✅ Lời giải chuẩn thi cử
            </button>
          </div>

          {/* Conversation viewports */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
            <div className="max-w-2xl mx-auto space-y-6">
              {session.messages.map((msg, index) => {
                const isUser = msg.sender === "user";
                return (
                  <div
                    key={msg.id || index}
                    className={`flex flex-col ${isUser ? "items-end" : "items-start"} space-y-1.5`}
                  >
                    {/* Time or Sender badge */}
                    <span className="text-[10px] text-[#587272] px-2">
                      {isUser ? "Em" : "Thầy Tùng AI"} • {msg.timestamp}
                    </span>

                    {/* Message Card */}
                    <div
                      className={`max-w-[90%] rounded-2xl px-4 py-3 sm:px-5 sm:py-4 shadow-sm border ${
                        isUser
                          ? "bg-[#0F9D8A] text-white border-[#0d8474]"
                          : "bg-white text-[#163A3A] border-[#CBEDE7]/60"
                      }`}
                    >
                      {/* Attached image preview */}
                      {msg.image && (
                        <div className="mb-3 max-h-[200px] overflow-hidden rounded-xl border border-[#CBEDE7]/60">
                          <img
                            src={msg.image}
                            alt="Đề bài tải lên"
                            className="w-full object-contain max-h-[190px]"
                          />
                        </div>
                      )}

                      {/* Display normal text using MathRenderer (perfect math render) */}
                      {msg.text && (
                        <MathRenderer
                          content={msg.text}
                          className={isUser ? "text-white" : "text-[#163A3A]"}
                        />
                      )}

                      {/* C. Image OCR verification block */}
                      {msg.reviewProblem && (
                        <div className="mt-4 bg-[#F7FFFD] border border-[#CBEDE7]/70 rounded-xl p-4 space-y-3">
                          <div className="border-b border-[#CBEDE7]/40 pb-2">
                            <span className="text-xs font-semibold text-[#0F9D8A] uppercase tracking-wider block">
                              ✏️ Kiểm tra đề đã nhận diện
                            </span>
                          </div>

                          {editPromptMode ? (
                            <textarea
                              value={tempProblemText}
                              onChange={(e) => setTempProblemText(e.target.value)}
                              rows={3}
                              className="w-full bg-white border border-[#CBEDE7]/80 rounded-xl p-3 text-sm focus:outline-none focus:border-[#0F9D8A] font-medium text-[#163A3A]"
                            />
                          ) : (
                            <div className="bg-white border border-[#CBEDE7]/40 rounded-xl p-3 text-sm text-[#163A3A] font-medium leading-relaxed shadow-sm">
                              <MathRenderer content={msg.reviewProblem.normalizedProblem} />
                            </div>
                          )}

                          {/* OCR Ambiguous items */}
                          {msg.reviewProblem.ambiguousParts && msg.reviewProblem.ambiguousParts.length > 0 && (
                            <div className="space-y-1.5">
                              <span className="text-xs font-bold text-amber-700 block">
                                ⚠️ Chi tiết chưa rõ nét trong ảnh:
                              </span>
                              {msg.reviewProblem.ambiguousParts.map((item, keyIdx) => (
                                <div
                                  key={keyIdx}
                                  className="text-xs bg-amber-50/60 border border-amber-100 rounded-xl p-3 text-amber-900"
                                >
                                  <strong>{item.location}:</strong> {item.questionForStudent} (Thầy đoán tạm là:{" "}
                                  <code>{item.recognizedAs}</code>)
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Verify OCR Controls */}
                          <div className="flex flex-wrap items-center gap-2 pt-1.5">
                            {editPromptMode ? (
                              <button
                                onClick={() => handleSaveEditedProblem(msg.id, msg.reviewProblem!)}
                                className="px-4 py-2 bg-[#0F9D8A] hover:bg-[#0b7769] text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                              >
                                Lưu chỉnh sửa
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setTempProblemText(msg.reviewProblem!.normalizedProblem);
                                  setEditPromptMode(true);
                                }}
                                className="px-4 py-2 border border-[#CBEDE7] text-[#0F9D8A] hover:bg-[#F7FFFD] font-bold text-xs rounded-xl transition-all cursor-pointer"
                              >
                                Chỉnh sửa đề
                              </button>
                            )}

                            <button
                              onClick={() => handleConfirmProblemCorrect(msg.reviewProblem!)}
                              className="flex items-center gap-1.5 px-4 py-2 bg-[#E56A00] hover:bg-[#C45B00] text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer active:scale-95"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Xác nhận đề đúng</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* E1. Hint Response layout */}
                      {msg.hints && (
                        <div className="mt-3 space-y-4">
                          <div className="flex items-center justify-between border-b border-[#CBEDE7]/40 pb-2">
                            <span className="text-xs font-semibold text-[#0F9D8A] uppercase tracking-wider block">
                              💡 DANH SÁCH GỢI Ý (Mức: {msg.hints.difficulty})
                            </span>
                          </div>

                          <div className="space-y-3">
                            {msg.hints.hints.map((hint, index) => {
                              return (
                                <div
                                  key={hint.id || index}
                                  className="border border-[#CBEDE7]/50 rounded-xl bg-[#F7FFFD]/30 p-4 shadow-sm"
                                >
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <span className="text-[10px] font-bold text-[#0F9D8A] bg-[#CBEDE7]/40 px-2 py-0.5 rounded-md">
                                      Gợi ý {index + 1}
                                    </span>
                                    <h5 className="font-bold text-[#163A3A] text-sm">{hint.title}</h5>
                                  </div>
                                  <MathRenderer content={hint.content} className="text-sm text-[#587272]" />

                                  {/* Interaction section for student who doesn't understand */}
                                  {!hint.explanation && !hint.isExplaining && (
                                    <button
                                      onClick={() => handleExplainHint(msg.id, hint.id)}
                                      className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#0F9D8A] bg-[#CBEDE7]/20 hover:bg-[#CBEDE7]/40 rounded-lg font-semibold transition-all cursor-pointer border border-[#CBEDE7]/40"
                                    >
                                      <HelpCircle className="w-3.5 h-3.5" />
                                      <span>Em chưa hiểu gợi ý này</span>
                                    </button>
                                  )}

                                  {hint.isExplaining && (
                                    <div className="mt-3 flex items-center gap-2 text-xs text-[#0F9D8A] font-semibold">
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      <span>Thầy Tùng đang soạn lời giải thích siêu dễ hiểu...</span>
                                    </div>
                                  )}

                                  {hint.explanation && (
                                    <div className="mt-3 bg-[#F0FAF8] border-l-2 border-[#0F9D8A] rounded-r-lg p-3 space-y-2">
                                      <div className="flex items-center gap-1 text-[11px] font-bold text-[#0F9D8A] uppercase tracking-wider">
                                        <Sparkles className="w-3 h-3 fill-current" />
                                        <span>Thầy giải thích chi tiết hơn</span>
                                      </div>
                                      <MathRenderer content={hint.explanation} className="text-xs sm:text-sm text-[#587272] leading-relaxed" />
                                      
                                      {hint.newSubHint && (
                                        <div className="mt-2 pt-2 border-t border-[#CBEDE7]/40">
                                          <div className="text-[11px] font-bold text-[#FF8A00] uppercase tracking-wider mb-1">
                                            💡 Gợi ý tiếp theo dành cho em
                                          </div>
                                          <MathRenderer content={hint.newSubHint} className="text-xs sm:text-sm font-semibold text-[#163A3A]" />
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                                                    <div className="bg-[#F7FFFD] border border-[#CBEDE7]/60 rounded-xl p-4 space-y-3">
                            <MathRenderer
                              content={msg.hints.followUpQuestion}
                              className="text-xs font-bold text-[#163A3A] block leading-relaxed"
                            />
                          </div>
                        </div>
                      )}

                      {/* E2. Step Coach response layout */}
                      {msg.step && (
                        <div className="mt-3 space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#CBEDE7]/40 pb-2">
                            <span className="text-xs font-semibold text-[#0F9D8A] uppercase tracking-wider block">
                              📋 BƯỚC {msg.step.currentStep.stepNumber} / {msg.step.progress.total}:{" "}
                              {msg.step.currentStep.title}
                            </span>
                            <span className="text-[10px] text-[#0F9D8A] bg-[#CBEDE7]/40 font-bold px-2.5 py-0.5 rounded-md self-start sm:self-auto">
                              Mục tiêu: {msg.step.currentStep.objective}
                            </span>
                          </div>

                          <div className="bg-[#F7FFFD] border border-[#CBEDE7]/50 rounded-xl p-4">
                            <MathRenderer
                              content={msg.step.currentStep.promptForStudent}
                              className="text-sm sm:text-base font-medium text-[#163A3A]"
                            />
                          </div>

                                                    <div className="flex items-center justify-end mt-2">
                            <button
                              onClick={() => handleNextStep(msg.step!.currentStep)}
                              className="px-5 py-3 bg-[#0F9D8A] hover:bg-[#0b7769] text-white font-bold text-xs sm:text-sm rounded-xl shadow cursor-pointer transition-all whitespace-nowrap"
                            >
                              Bước tiếp theo
                            </button>
                          </div>
                        </div>
                      )}

                      {/* E3. Exam Solution Response layout */}
                      {msg.examSolution && (
                        <div className="mt-3 space-y-4">
                          <div className="border-b border-[#CBEDE7]/40 pb-2">
                            <span className="text-xs font-semibold text-[#0F9D8A] uppercase tracking-wider block">
                              ✅ {msg.examSolution.title || "Lời giải chuẩn thi cử"}
                            </span>
                          </div>

                          {msg.examSolution.conditions && msg.examSolution.conditions.length > 0 && (
                            <div className="text-xs text-[#587272] bg-[#F7FFFD] p-3 rounded-xl border border-[#CBEDE7]/50">
                              <strong>Điều kiện xác định:</strong>{" "}
                              {msg.examSolution.conditions.join(", ")}
                            </div>
                          )}

                          <div className="space-y-3">
                            {msg.examSolution.solutionBlocks.map((block, bIdx) => (
                              <div key={bIdx} className="leading-relaxed text-[#163A3A]">
                                <MathRenderer content={block.content} />
                              </div>
                            ))}
                          </div>

                          <div className="text-[#163A3A] font-semibold text-sm bg-[#CBEDE7]/20 p-4 rounded-xl border border-[#CBEDE7]/50 shadow-sm">
                            <strong>Kết luận:</strong> <MathRenderer content={msg.examSolution.conclusion} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* J. Geometry visualizer module inline if spec available */}
                    {msg.geometrySpec && (
                      <div className="w-full max-w-[90%]">
                        <GeometryInlineLab spec={msg.geometrySpec} />
                      </div>
                    )}

                    {/* G. Create Similar Exercises Banner under final solutions */}
                    {(msg.examSolution || (session.stepState.totalSteps > 0 && session.stepState.currentStepNumber > session.stepState.totalSteps)) && (
                      <div className="w-full max-w-[90%] mt-4 bg-[#FFFDF0] border border-[#CBEDE7] rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-[#FFF9E6] text-[#FF8A00] rounded-xl border border-[#FFEAB3]">
                            <Sparkles className="w-5 h-5 animate-bounce" />
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-sm text-[#163A3A]">
                              Em đã hiểu bài! Sẵn sàng luyện tập chưa?
                            </p>
                            <p className="text-xs text-[#587272]">
                              Giải thêm bài tương tự giúp nâng cao tư duy giải đề nhanh nhạy.
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={handleTriggerSimilarExercises}
                          className="w-full sm:w-auto bg-[#FF8A00] hover:bg-[#E07A00] text-white font-bold text-xs sm:text-sm px-5 py-3 rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                        >
                          <span>✨ Tạo bài tập tương tự</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Multimodal processing stage loader */}
              {loading && ocrStage > 0 && (
                <div className="flex flex-col items-center justify-center py-8 space-y-3 bg-white border border-[#CBEDE7]/60 rounded-xl max-w-xl mx-auto shadow-sm">
                  <Loader2 className="w-7 h-7 text-[#0F9D8A] animate-spin" />
                  <span className="text-sm font-bold text-[#0F9D8A]">{renderOcrStatus()}</span>
                </div>
              )}

              {/* Basic AI message generator loader */}
              {loading && ocrStage === 0 && (
                <div className="flex items-center gap-2.5 bg-white border border-[#CBEDE7]/60 rounded-xl px-4 py-3 shadow-sm max-w-xs">
                  <Loader2 className="w-4 h-4 text-[#0F9D8A] animate-spin" />
                  <span className="text-xs text-[#587272]">Thầy Tùng đang suy luận...</span>
                </div>
              )}

              {/* Error fallback board */}
              {errorMessage && (
                <div className="bg-red-50/55 border border-red-200 text-red-900 rounded-xl p-4 text-sm flex items-start gap-2.5 max-w-xl mx-auto shadow-sm">
                  <span className="p-1.5 bg-red-100 rounded-xl text-[#DC5A5A] mt-0.5 shrink-0 border border-red-200">
                    <Trash2 className="w-4 h-4" />
                  </span>
                  <div>
                    <h5 className="font-bold mb-1">Gặp thử thách kết nối</h5>
                    <p className="text-xs text-red-700 leading-relaxed">{errorMessage}</p>
                    <button
                      onClick={() => setErrorMessage(null)}
                      className="mt-2 text-xs font-bold text-[#0F9D8A] hover:underline cursor-pointer"
                    >
                      Bỏ qua thông báo
                    </button>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Composer Footer (Fixed area) */}
          <footer className="bg-white border-t border-[#CBEDE7]/60 p-3 sm:p-4 shrink-0 shadow-lg">
            <form onSubmit={handleSendTextProblem} className="max-w-2xl mx-auto flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                {/* Photo Trigger camera icon */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 bg-[#F7FFFD] border border-[#CBEDE7] hover:border-[#0F9D8A] text-[#0F9D8A] hover:bg-[#CBEDE7]/20 rounded-xl transition-all relative cursor-pointer shadow-sm"
                  title="Tải lên ảnh đề bài hoặc dán ảnh"
                >
                  <Camera className="w-5 h-5" />
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                </button>
              </div>

              {/* Rich compose text area */}
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Nhập đề bài Toán... hoặc dùng công cụ chụp ảnh"
                className="flex-1 bg-[#F7FFFD] border border-[#CBEDE7]/60 rounded-xl px-4 py-3 text-xs sm:text-sm focus:outline-none focus:bg-white focus:border-[#0F9D8A] font-medium text-[#163A3A] transition-all"
              />

              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-3.5 bg-[#0F9D8A] hover:bg-[#0b7769] disabled:opacity-40 disabled:hover:bg-[#0F9D8A] text-white rounded-xl shadow-md cursor-pointer transition-all active:scale-95"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </footer>

          {/* 3. DRAWERS & MODALS MOUNTED */}
          <BrainMemoryDashboard
            isOpen={isBrainOpen}
            onClose={() => setIsBrainOpen(false)}
            session={session}
            onUpdateSession={updateAndSaveSession}
          />

          <SimilarExerciseDrawer
            isOpen={isExerciseOpen}
            onClose={() => setIsExerciseOpen(false)}
            exercises={session.generatedExercises}
            onSelectExercise={handleLoadExerciseToWorkspace}
          />

          {pendingImage && (
            <ImageCropDialog
              isOpen={isCropOpen}
              onClose={() => {
                setIsCropOpen(false);
                setPendingImage(null);
              }}
              imageUrl={pendingImage}
              fileSize={pendingImageSize}
              onConfirm={handleConfirmModifiedImage}
            />
          )}

          <ResetDialog
            isOpen={isResetOpen}
            onClose={() => setIsResetOpen(false)}
            onConfirm={handleResetSession}
          />
        </div>
      )}
    </div>
  );
}
