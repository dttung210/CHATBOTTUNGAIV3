const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Replace handleCheckStepAnswer with handleNextStep
const oldCheckStepRegex = /  \/\/ Submit step answer evaluation[\s\S]*?async function updateAndSaveSession/m;
const newNextStep = `  // Next step handler
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
          const nextStepMsg: Message = {
            id: \`msg_next_step_\${Date.now()}\`,
            sender: "assistant",
            timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
            step: nextStepData,
          };
          updatedSession.messages = [...updatedSession.messages, nextStepMsg];
        }
      } else {
        const completionMsg: Message = {
          id: \`msg_step_complete_\${Date.now()}\`,
          sender: "assistant",
          timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
          text: \`🎉 **Chúc mừng em! Em đã hoàn thành xuất sắc tất cả \${session.stepState.totalSteps} bước giải bài toán.**\\n\\nBây giờ em có thể chuyển sang chế độ Lời giải chuẩn thi cử để xem lại toàn bộ cách trình bày hoàn chỉnh nhé!\`,
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

  async function updateAndSaveSession`;

code = code.replace(oldCheckStepRegex, newNextStep);

// 2. Remove Task draft input in hint mode (around lines 1416-1472)
const hintDraftInputRegex = /\{\/\* Task draft input \*\/\}([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*\}\)/;
// Wait, I should be more precise.
// Let's just find the exact block.
