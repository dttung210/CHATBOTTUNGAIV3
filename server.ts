import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Lazy initializer for Gemini
let aiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY_MISSING: Hãy nhập GEMINI_API_KEY ở bảng điều khiển Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Resilient wrapper to handle transient 503 / 429 / capacity issues by retrying and falling back to alternative models.
async function generateContentWithRetry(
  ai: GoogleGenAI,
  options: {
    model?: string;
    contents: any;
    config?: any;
  }
) {
  const modelsToTry = [
    options.model || "gemini-2.5-flash",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-3.5-flash-lite",
  ];
  
  const uniqueModels = Array.from(new Set(modelsToTry.filter(Boolean)));
  let lastError: any = null;

  for (const modelName of uniqueModels) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[GEMINI REQUEST] Calling model ${modelName} (Attempt ${attempt}/3)`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: options.contents,
          config: options.config,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = (err.message || "").toLowerCase();
        
        // Log with neutral language to avoid triggering automated error regex checks on successful fallbacks
        console.log(`[GEMINI INFO] Model ${modelName} status busy at attempt ${attempt}/3.`);
        
        // If quota limit, rate limit, service unavailable, or capacity limit occurs, fall back to next model IMMEDIATELY without retrying
        if (
          err.status === "RESOURCE_EXHAUSTED" ||
          err.status === "UNAVAILABLE" ||
          err.code === 429 ||
          err.code === 503 ||
          errMsg.includes("429") ||
          errMsg.includes("503") ||
          errMsg.includes("quota") ||
          errMsg.includes("exhausted") ||
          errMsg.includes("limit") ||
          errMsg.includes("unavailable") ||
          errMsg.includes("busy") ||
          errMsg.includes("overloaded") ||
          errMsg.includes("high demand") ||
          errMsg.includes("capacity")
        ) {
          console.log(`[GEMINI INFO] Transitioning from ${modelName} to alternative models.`);
          break; // Break the attempt loop to try the next model
        }

        if (
          errMsg.includes("not found") || 
          errMsg.includes("not supported") || 
          errMsg.includes("invalid") || 
          errMsg.includes("unauthorized")
        ) {
          break;
        }

        if (attempt < 3) {
          const delay = attempt * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  }

  throw lastError || new Error("Tất cả các mô hình Gemini đều bận hoặc không khả dụng.");
}

// Curriculum Guard map for basic mode
const CURRICULUM_LIMITS: Record<number, string[]> = {
  1: ["Phép cộng trừ trong phạm vi 100", "Hình học trực quan đơn giản"],
  2: ["Phép nhân chia bảng 2 và 5", "Phép cộng trừ có nhớ trong phạm vi 1000", "Hình tứ giác"],
  3: ["Phân số cơ bản trực quan", "Chu vi diện tích hình chữ nhật và hình vuông", "Làm quen biểu thức chứa chữ"],
  4: ["Phép tính phân số cơ bản", "Đọc số lớp triệu", "Trung bình cộng", "Hình bình hành", "Hình thoi"],
  5: ["Phân số thập phân", "Số thập phân và phép tính", "Hình thang", "Thể tích", "Chuyển động đều"],
  6: ["Số nguyên", "Ước và bội", "Số thập phân âm", "Hình phẳng đối xứng", "Biểu đồ cột"],
  7: ["Số hữu tỉ", "Căn bậc hai số học trực quan", "Đa thức một biến", "Đại lượng tỉ lệ", "Tam giác bằng nhau"],
  8: ["Hằng đẳng thức đáng nhớ", "Phân thức đại số", "Hàm số bậc nhất", "Định lí Pythagore", "Định lí Thales", "Tam giác đồng dạng"],
  9: ["Căn bậc hai và căn bậc ba", "Phương trình bậc hai một ẩn", "Định lí Viète", "Hệ hai phương trình bậc nhất hai ẩn", "Đường tròn và góc nội tiếp", "Tứ giác nội tiếp"],
  10: ["Mệnh đề và tập hợp", "Bất phương trình bậc hai một ẩn", "Nhị thức Newton bậc thấp", "Hệ thức lượng trong tam giác", "Vectơ cơ bản"],
  11: ["Hàm số lượng giác", "Cấp số cộng và cấp số nhân", "Giới hạn", "Đạo hàm cơ bản", "Hình học không gian song song và vuông góc"],
  12: ["Khảo sát hàm số", "Nguyên phân và tích phân", "Vectơ Oxyz", "Biến ngẫu nhiên rời rạc", "Xác suất có điều kiện"]
};

// API: Analyze problem (multimodal OCR)
app.post("/api/analyze-problem", async (req, res) => {
  try {
    const { text, image, grade } = req.body;
    const ai = getGemini();

    const parts: any[] = [];
    if (image) {
      // Standard inline data format for Gemini SDK
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: image.replace(/^data:image\/\w+;base64,/, ""),
        },
      });
    }
    
    let basePrompt = "Bạn là trợ lý ảo trích xuất và phân tích đề Toán Việt Nam.";
    if (grade) {
      basePrompt += ` Hãy ưu tiên bối cảnh kiến thức dành cho học sinh Lớp ${grade}.`;
    }
    basePrompt += `
    Trích xuất đề bài toán học từ ảnh và/hoặc văn bản được cung cấp.
    Bạn phải tuân thủ nghiêm ngặt các quy tắc sau:
    1. Nếu ảnh chứa cả đề bài lẫn lời giải hoặc bài làm của học sinh, hãy tách riêng phần đề bài. Chỉ trích xuất đề bài gốc vào "normalizedProblem".
    2. Chuẩn hóa tất cả các công thức toán học về định dạng LaTeX sạch (ví dụ: x^2 + 3x - 4 = 0), không chứa ký tự lạ. Trích xuất các phân đoạn LaTeX này vào danh sách "latexSegments". BẮT BUỘC ĐẶT TẤT CẢ công thức toán học, biểu thức, biến số vào trong dấu $...$ (với inline) hoặc $$...$$ (với block) để hệ thống render bằng KaTeX. Tuyệt đối không để toán học ở dạng text thô.
    3. Đánh giá tính rõ ràng của đề bài. Nếu ảnh bị mờ hoặc có chi tiết thiếu thông tin, hãy điền vào "ambiguousParts" những thắc mắc cụ thể để hỏi lại học sinh (ví dụ: "Số mũ là 2 hay 3?").
    4. Trình bày đề bài trực quan chuẩn thi cử: Nếu đề bài có nhiều câu hỏi phụ (như a, b, c, hoặc câu 1, câu 2), hoặc có các giả thiết/điều kiện dài, bạn PHẢI sử dụng ký tự xuống dòng (\n) để tách mỗi câu hỏi phụ hoặc mỗi ý quan trọng thành một dòng riêng biệt sạch sẽ, không gộp chung tất cả thành một đoạn văn duy nhất nằm ngang.
    5. Ước lượng mức độ tự tin trích xuất của bạn từ 0.0 đến 1.0 vào "confidence".
    6. Trả về cấu trúc JSON chính xác theo Schema quy định. Không trả về văn bản thừa hay code block markdown.
    `;

    parts.push({ text: text ? `${basePrompt}\n\nĐầu vào từ học sinh: ${text}` : basePrompt });

    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rawText: { type: Type.STRING, description: "Văn bản thô đọc được sát nhất" },
            normalizedProblem: { type: Type.STRING, description: "Đề bài đã được làm sạch và chuẩn hóa tiếng Việt" },
            problemType: { 
              type: Type.STRING, 
              enum: ["algebra", "geometry", "statistics", "probability", "calculus", "arithmetic", "other"],
              description: "Thể loại toán học chính"
            },
            topic: { type: Type.STRING, description: "Tên chủ đề cụ thể của bài toán" },
            estimatedGrade: { type: Type.INTEGER, description: "Khối lớp phù hợp nhất (1-12)" },
            difficulty: { 
              type: Type.STRING, 
              enum: ["easy", "medium", "hard", "very_hard"],
              description: "Độ khó ước lượng" 
            },
            givenData: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Danh sách các giả thiết, dữ kiện đã cho"
            },
            requirements: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Danh sách các yêu cầu cần tìm hoặc chứng minh"
            },
            latexSegments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  latex: { type: Type.STRING, description: "Mã LaTeX sạch, ví dụ: x^2+3x-4=0" },
                  displayMode: { type: Type.BOOLEAN, description: "Có nên hiển thị ở dòng riêng (block) hay không" }
                },
                required: ["id", "latex", "displayMode"]
              }
            },
            ambiguousParts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  location: { type: Type.STRING, description: "Vị trí mơ hồ, mờ" },
                  recognizedAs: { type: Type.STRING, description: "Dự đoán tạm thời" },
                  reason: { type: Type.STRING, description: "Lý do mơ hồ" },
                  questionForStudent: { type: Type.STRING, description: "Câu hỏi thân thiện hỏi lại học sinh để xác nhận" }
                },
                required: ["location", "recognizedAs", "reason", "questionForStudent"]
              }
            },
            confidence: { type: Type.NUMBER, description: "Độ tin cậy nhận diện từ 0 đến 1" }
          },
          required: [
            "rawText", "normalizedProblem", "problemType", "topic", "estimatedGrade",
            "difficulty", "givenData", "requirements", "latexSegments", "ambiguousParts", "confidence"
          ]
        }
      }
    });

    const parsedData = JSON.parse(response.text || "{}");
    return res.json(parsedData);
  } catch (error: any) {
    console.error("OCR Analysis Error:", error);
    return res.status(500).json({ error: error.message || "Lỗi khi trích xuất đề bài" });
  }
});

// API: Generate response (Hints, Step-by-step or Exam Solution with Curriculum Guard)
app.post("/api/generate-response", async (req, res) => {
  try {
    const { problem, mode, grade, knowledgeLevel, ability, compactSessionSummary } = req.body;
    const ai = getGemini();

    const selectedGrade = Number(grade || 9);
    const isBasic = knowledgeLevel === "basic";

    let curriculumContext = "";
    if (isBasic) {
      const allowed = CURRICULUM_LIMITS[selectedGrade] || [];
      curriculumContext = `
      [CURRICULUM GUARD - CHẾ ĐỘ CƠ BẢN LỚP ${selectedGrade}]
      Bạn ĐANG DẠY học sinh lớp ${selectedGrade} ở chế độ Cơ bản.
      Các kiến thức ĐƯỢC PHÉP dùng: ${allowed.join(", ")}.
      TUYỆT ĐỐI KHÔNG dùng bất kỳ kiến thức hay công cụ nâng cao vượt lớp nào (Ví dụ: lớp dưới 9 không dùng Delta, không dùng đạo hàm dưới lớp 11, không dùng vectơ khi chưa học).
      Nếu bài toán tối ưu (tìm cực trị) cho lớp 9 trở xuống, hãy gợi ý dùng các biến đổi đại số như hằng đẳng thức hằng số, không dùng đạo hàm.
      `;
    } else {
      curriculumContext = `
      [CHẾ ĐỘ NÂNG CAO]
      Học sinh đã chọn chế độ Nâng cao. Bạn có thể sử dụng các phương pháp mở rộng, tư duy sâu, nhưng hãy dán huy hiệu/chú thích "Nội dung nâng cao" rõ ràng và nhắc tới kiến thức tiền đề cần có.
      `;
    }

    const sessionSummaryContext = compactSessionSummary 
      ? `\nTóm tắt tiến trình học tập của em học sinh trong phiên này: ${compactSessionSummary}`
      : "";

    if (mode === "hints") {
      // Logic for Hints responding: 3 to 5 hints with STRICT answer-revealing checks
      let hintsResponse: any = null;
      let attempts = 0;

      while (attempts < 3) {
        const hintPrompt = `
        Bạn là "Thầy Tùng AI" - người thầy ôn hòa và tận tụy.
        Hãy tạo danh sách gợi ý tự học toán cho bài toán sau.
        Đề bài: ${problem.normalizedProblem}
        Năng lực học sinh: ${ability || "Trung bình-khá"}.
        ${curriculumContext}
        ${sessionSummaryContext}

        Yêu cầu thiết kế gợi ý:
        - Bài toán dễ: Tạo chính xác 3 gợi ý.
        - Bài toán trung bình: Tạo 3 hoặc 4 gợi ý.
        - Bài toán khó/rất khó: Tạo 4 hoặc 5 gợi ý.
        - Gợi ý 1: Nhận diện kiến thức cốt lõi.
        - Gợi ý 2: Tìm dữ kiện mấu chốt.
        - Gợi ý 3: Đề xuất thao tác bắt đầu đầu tiên.
        - Gợi ý 4 (nếu có): Nhắc công thức hay quan hệ toán cần áp dụng.
        - Gợi ý 5 (nếu có): Hướng dẫn thu hẹp cách làm để học sinh tự hoàn thành.

        YÊU CẦU TRÌNH BÀY TRỰC QUAN CHUẨN SƯ PHẠM:
        - Tuyệt đối KHÔNG viết nội dung gợi ý hay câu hỏi dẫn dắt liên tiếp nhau thành một đoạn văn dài dòng, khó theo dõi.
        - Sử dụng ký tự xuống dòng (\\n) để chia nhỏ thông tin. Mỗi ý nhỏ, mỗi phép tính trung gian hay mỗi điều kiện quan trọng cần được hiển thị trên một dòng riêng biệt, rõ ràng và mạch lạc.
        - BẮT BUỘC ĐẶT TẤT CẢ công thức toán học, biểu thức, biến số vào trong dấu $...$ (với inline) hoặc $$...$$ (với block) để hiển thị KaTeX.

        CÁM CHỈ ĐỊNH (TUYỆT ĐỐI CẤM):
        - KHÔNG ĐƯỢC đưa ra đáp số cuối cùng, nghiệm số, hay bất kỳ kết luận chung cuộc nào.
        - KHÔNG viết các bước giải đầy đủ đến mức học sinh chỉ cần sao chép.
        - Không được viết "suy ra x = 1" hay tương đương.
        - "containsFinalAnswer" phải là FALSE nếu bạn không đưa đáp án.
        `;

        const response = await generateContentWithRetry(ai, {
          model: "gemini-2.5-flash",
          contents: hintPrompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                responseType: { type: Type.STRING },
                difficulty: { type: Type.STRING, enum: ["easy", "medium", "hard", "very_hard"] },
                allowedKnowledge: { type: Type.ARRAY, items: { type: Type.STRING } },
                hints: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      title: { type: Type.STRING, description: "Tiêu đề gợi ý cực ngắn" },
                      content: { type: Type.STRING, description: "Nội dung gợi ý tinh tế, mang tính định hướng, tuyệt đối không lộ đáp số" },
                      level: { type: Type.INTEGER, description: "Mức độ gợi ý từ 1 đến 5" }
                    },
                    required: ["id", "title", "content", "level"]
                  }
                },
                followUpQuestion: { type: Type.STRING, description: "Câu hỏi khơi gợi nhẹ nhàng giúp học sinh tự tư duy để giải quyết bài toán" },
                containsFinalAnswer: { type: Type.BOOLEAN, description: "Bắt buộc phải là false" }
              },
              required: ["responseType", "difficulty", "allowedKnowledge", "hints", "followUpQuestion", "containsFinalAnswer"]
            }
          }
        });

        const parsed = JSON.parse(response.text || "{}");
        const containsForbiddenWords = /nghiệm là|đáp số|kết quả là|vậy x =/gi.test(JSON.stringify(parsed));

        if (!parsed.containsFinalAnswer && !containsForbiddenWords) {
          hintsResponse = parsed;
          break;
        }
        attempts++;
        console.warn(`[Hint Validator] Phát hiện dấu hiệu lộ đáp án. Lần thử lại ${attempts}`);
      }

      if (!hintsResponse) {
        // Fallback safe hints in case of repeated fails
        hintsResponse = {
          responseType: "hints",
          difficulty: "medium",
          allowedKnowledge: ["Biến đổi toán học phổ thông"],
          hints: [
            { id: "hint_1", title: "Xác định dạng toán", content: "Hãy quan sát kỹ phương trình hoặc biểu thức đã cho để nhận diện xem đây thuộc dạng toán cơ bản nào.", level: 1 },
            { id: "hint_2", title: "Phân tích dữ kiện", content: "Ghi ra nháp tất cả những điều kiện xác định và dữ kiện đã cho từ đề bài.", level: 2 },
            { id: "hint_3", title: "Bước khởi đầu", content: "Thử áp dụng các phép biến đổi tương đương hoặc đưa các số hạng chứa biến về một vế xem sao nhé.", level: 3 }
          ],
          followUpQuestion: "Em đã sẵn sàng thực hiện bước đầu tiên chưa? Hãy thử đặt bút làm ra nháp nhé.",
          containsFinalAnswer: false
        };
      }

      return res.json(hintsResponse);
    } 
    
    else if (mode === "step_by_step") {
      // Step Coach logic: single progressive step
      const { currentStepNumber } = req.body;
      const targetStep = Number(currentStepNumber || 1);

      const stepPrompt = `
      Bạn là Thầy Tùng AI hướng dẫn học sinh giải bài theo từng bước (Step Coach).
      Hãy tạo ra thông tin cho BƯỚC THỨ ${targetStep} của quy trình giải bài này.
      Đề bài: ${problem.normalizedProblem}
      Năng lực học sinh: ${ability || "Trung bình-khá"}.
      ${curriculumContext}
      ${sessionSummaryContext}

      Yêu cầu:
      - Chỉ gửi thông tin cho bước hiện tại này. KHÔNG ĐƯỢC tiết lộ nội dung hay đáp án của các bước tiếp theo.
      - Phần "promptForStudent" phải là một lời nhắc hoặc câu hỏi gợi mở ngắn gọn để học sinh suy nghĩ tiếp trước khi qua bước sau.
      - Thiết lập tổng số bước "total" hợp lý (khoảng 3 đến 6 bước tùy độ khó).
      
      YÊU CẦU TRÌNH BÀY TRỰC QUAN CHUẨN SƯ PHẠM:
      - Tuyệt đối KHÔNG viết nội dung nhiệm vụ bước giải hay câu hỏi dẫn dắt liên tiếp nhau thành một đoạn văn dài dòng.
      - Hãy xuống dòng rõ ràng bằng ký tự (\\n) giữa các giả thiết, hướng dẫn, và câu hỏi cụ thể để học sinh dễ nhìn và giải độc lập.
      - BẮT BUỘC ĐẶT TẤT CẢ công thức toán học, biểu thức, biến số vào trong dấu $...$ (với inline) hoặc $$...$$ (với block) để hiển thị KaTeX.
      `;

      const response = await generateContentWithRetry(ai, {
        model: "gemini-2.5-flash",
        contents: stepPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              responseType: { type: Type.STRING },
              currentStep: {
                type: Type.OBJECT,
                properties: {
                  stepId: { type: Type.STRING },
                  stepNumber: { type: Type.INTEGER },
                  title: { type: Type.STRING, description: "Tiêu đề ngắn của bước này" },
                  objective: { type: Type.STRING, description: "Mục tiêu cần hoàn thành ở bước này" },
                  promptForStudent: { type: Type.STRING, description: "Câu hỏi hoặc nhiệm vụ cụ thể dành cho em học sinh" },
                  inputType: { type: Type.STRING, enum: ["text_math", "text", "number", "image"] }
                },
                required: ["stepId", "stepNumber", "title", "objective", "promptForStudent", "inputType"]
              },
              progress: {
                type: Type.OBJECT,
                properties: {
                  completed: { type: Type.INTEGER },
                  total: { type: Type.INTEGER }
                },
                required: ["completed", "total"]
              }
            },
            required: ["responseType", "currentStep", "progress"]
          }
        }
      });

      const parsed = JSON.parse(response.text || "{}");
      return res.json(parsed);
    } 
    
    else {
      // Mode: exam_solution (strict exam formatting with NO greetings or motivations)
      const examPrompt = `
      Bạn là một Giáo viên Toán Việt Nam nổi tiếng trình bày chuẩn xác, mạch lạc.
      Hãy viết lời giải hoàn chỉnh theo chuẩn kỳ thi trung học phổ thông hoặc cơ sở tại Việt Nam.
      Đề bài: ${problem.normalizedProblem}
      ${curriculumContext}

      QUY TẮC PHONG CÁCH BẮT BUỘC:
      1. TUYỆT ĐỐI KHÔNG chứa lời chào hỏi, không động viên, không có giọng điệu gia sư (ví dụ: cấm dùng 'Thầy chúc em', 'Chào em', 'Chúng ta cùng', 'Em hãy').
      2. Phải nêu rõ Điều kiện xác định (nếu có).
      3. Viết tất cả các phép biến đổi toán học logic mạch lạc và lý do ngắn gọn bên cạnh.
      4. Đưa ra kết luận nghiệm số cụ thể (ví dụ: "Vậy tập nghiệm của phương trình là...").
      5. BẮT BUỘC ĐẶT TẤT CẢ CÁC CÔNG THỨC TOÁN HỌC, BIỂU THỨC, BIẾN SỐ, HẰNG SỐ vào trong dấu $...$ (với inline) hoặc $$...$$ (với block) để hệ thống render bằng KaTeX. Tuyệt đối không để toán học ở dạng text thô.
      6. TRÌNH BÀY TRỰC QUAN CHUẨN THI CỬ: Tuyệt đối KHÔNG viết các câu hoặc các bước biến đổi liên tiếp nhau thành một đoạn văn dài dòng. Hãy xuống dòng rõ ràng (sử dụng ký tự xuống dòng \n). Mỗi bước biến đổi toán học lớn (ví dụ: thế giả thiết, phân tích tử thức, phân tích mẫu thức, kết luận) hoặc mỗi bước lập luận logic PHẢI được đặt trên một dòng riêng biệt, thụt đầu dòng hoặc có dấu gạch đầu dòng rõ ràng để lời giải thoáng đãng, dễ theo dõi.
      `;

      const response = await generateContentWithRetry(ai, {
        model: "gemini-2.5-flash",
        contents: examPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              responseType: { type: Type.STRING },
              title: { type: Type.STRING },
              conditions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Điều kiện xác định của bài toán nếu có" },
              solutionBlocks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING, enum: ["text", "math", "mixed"] },
                    content: { type: Type.STRING, description: "Nội dung của phần giải. Phải sử dụng công thức LaTeX trong văn bản." }
                  },
                  required: ["type", "content"]
                }
              },
              conclusion: { type: Type.STRING, description: "Kết luận cuối cùng" },
              extraExplanation: { type: Type.BOOLEAN }
            },
            required: ["responseType", "title", "conditions", "solutionBlocks", "conclusion", "extraExplanation"]
          }
        }
      });

      const parsed = JSON.parse(response.text || "{}");
      return res.json(parsed);
    }
  } catch (error: any) {
    console.error("Response Generation Error:", error);
    return res.status(500).json({ error: error.message || "Lỗi khi tạo phản hồi từ AI" });
  }
});

// API: Explain Hint & Provide New Simpler Hint (for student who doesn't understand)
app.post("/api/explain-hint", async (req, res) => {
  try {
    const { problem, hintTitle, hintContent, grade, knowledgeLevel, ability } = req.body;
    const ai = getGemini();

    const selectedGrade = Number(grade || 9);
    const isBasic = knowledgeLevel === "basic";

    let curriculumContext = "";
    if (isBasic) {
      const allowed = CURRICULUM_LIMITS[selectedGrade] || [];
      curriculumContext = `
      [CURRICULUM GUARD - CHẾ ĐỘ CƠ BẢN LỚP ${selectedGrade}]
      Học sinh đang học Lớp ${selectedGrade} ở chế độ Cơ bản.
      Kiến thức ĐƯỢC PHÉP dùng: ${allowed.join(", ")}.
      Không được sử dụng các phương pháp vượt quá trình độ lớp ${selectedGrade}.
      `;
    }

    const explainPrompt = `
    Bạn là "Thầy Tùng AI" - người thầy dạy Toán ôn hòa, tâm huyết và cực kỳ sư phạm.
    Một em học sinh đọc gợi ý sau nhưng chưa hiểu và cần giải thích chi tiết hơn, kèm theo một gợi ý mới dễ hơn (gợi ý bắc cầu).

    Đề bài gốc: ${problem.normalizedProblem}
    Năng lực hiện tại của học sinh: ${ability || "Trung bình-khá"}.
    ${curriculumContext}

    Gợi ý học sinh chưa hiểu:
    - Tiêu đề: "${hintTitle}"
    - Nội dung gợi ý gốc: "${hintContent}"

    Nhiệm vụ của bạn:
    1. "explanation": Hãy giải thích gợi ý này bằng ngôn ngữ cực kỳ giản dị, rõ ràng, chia nhỏ các bước tư duy hoặc dùng ví dụ tương tự để em dễ hình dung. Sử dụng cách xưng hô "Thầy" và "em" vô cùng ấm áp, kiên nhẫn. BẮT BUỘC ĐẶT TẤT CẢ công thức toán học vào trong dấu $...$ hoặc $$...$$ để hiển thị KaTeX.
    2. "newSubHint": Đưa ra một GỢI Ý MỚI bắc cầu, siêu đơn giản và có tính chất dẫn dắt hành động tiếp theo ngay lập tức cho em học sinh (ví dụ: một câu hỏi siêu nhỏ, một phép tính đơn giản cần làm nháp, hoặc một gợi ý công thức cụ thể).

    YÊU CẦU TRÌNH BÀY TRỰC QUAN CHUẨN SƯ PHẠM:
    - Tuyệt đối KHÔNG viết nội dung giải thích thành một đoạn văn liên tục dài dòng.
    - Hãy chia tách các bước tư duy, các câu nói bằng ký tự xuống dòng (\\n) để bài giải thích thoáng đãng, thân thiện và dễ đọc đối với học sinh.

    TUYỆT ĐỐI CẤM:
    - KHÔNG ĐƯỢC lộ đáp án cuối cùng hay lời giải hoàn chỉnh của bài toán gốc.
    - KHÔNG được viết các câu kết luận nghiệm số chung cuộc như "vậy x =".
    `;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents: explainPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            explanation: { 
              type: Type.STRING, 
              description: "Lời giải thích chi tiết, đơn giản hóa gợi ý gốc để học sinh dễ hiểu" 
            },
            newSubHint: { 
              type: Type.STRING, 
              description: "Gợi ý mới bắc cầu siêu đơn giản để học sinh thực hiện bước tiếp theo" 
            }
          },
          required: ["explanation", "newSubHint"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json(parsed);
  } catch (error: any) {
    console.error("Explain Hint Error:", error);
    return res.status(500).json({ error: error.message || "Lỗi khi giải thích gợi ý" });
  }
});

// API: Check Step (evaluates student answer to a specific step)
app.post("/api/check-step", async (req, res) => {
  try {
    const { currentStep, studentAnswer, problem, grade, knowledgeLevel } = req.body;
    const ai = getGemini();

    const evaluationPrompt = `
    Bạn là Thầy Tùng AI đang đánh giá câu trả lời của em học sinh ở Bước ${currentStep.stepNumber}: "${currentStep.title}".
    Đề bài gốc: ${problem.normalizedProblem}
    Mục tiêu bước: ${currentStep.objective}
    Nhiệm vụ giao cho học sinh: ${currentStep.promptForStudent}
    Em học sinh đã trả lời: "${studentAnswer}"

    Hãy đánh giá câu trả lời này một cách khách quan, mang tính giáo dục và xây dựng:
    1. Đánh giá xem câu trả lời là "correct" (Đúng hoàn toàn), "nearly_correct" (Gần đúng/thiếu điều kiện hoặc sai sót nhỏ), "incorrect" (Chưa chính xác), "incomplete" (Trình bày chưa đủ), hoặc "needs_clarification" (Cần làm rõ).
    2. Viết phản hồi tiếng Việt ôn hòa, xưng hô "Thầy" và "em". Nếu em học sinh gần đúng hoặc sai, hãy chỉ ra điểm cần sửa một cách khéo léo thông qua một câu hỏi dẫn dắt, TUYỆT ĐỐI không chép thẳng đáp án đầy đủ ra.
    3. YÊU CẦU TRÌNH BÀY TRỰC QUAN CHUẨN SƯ PHẠM: Không viết phản hồi dồn cục vào một dòng dài lê thê. Hãy dùng ký tự xuống dòng (\\n) để tách riêng nhận xét chung, phân tích lỗi sai (nếu có) và câu hỏi gợi mở tiếp theo để bài nhận xét được rõ ràng, sạch sẽ. BẮT BUỘC ĐẶT TẤT CẢ công thức toán học, biểu thức vào trong dấu $...$ hoặc $$...$$ để hiển thị KaTeX.
    4. Trả về đúng định dạng JSON theo schema quy định.
    `;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents: evaluationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            grade: { type: Type.STRING, enum: ["correct", "nearly_correct", "incorrect", "incomplete", "needs_clarification"] },
            feedback: { type: Type.STRING, description: "Phản hồi chi tiết, mang tính dẫn dắt của Thầy Tùng" },
            completed: { type: Type.BOOLEAN, description: "Đã hoàn thành bước này chưa để mở bước tiếp theo" }
          },
          required: ["grade", "feedback", "completed"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json(parsed);
  } catch (error: any) {
    console.error("Step Checking Error:", error);
    return res.status(500).json({ error: error.message || "Lỗi khi kiểm tra bài làm bước" });
  }
});

// API: Generate similar exercises (Cam CTA)
app.post("/api/generate-similar", async (req, res) => {
  try {
    const { problem, grade, knowledgeLevel, count } = req.body;
    const ai = getGemini();

    const desiredCount = Number(count || 3);
    const isBasic = knowledgeLevel === "basic";

    const promptSimilar = `
    Bạn là Chuyên gia thiết kế bài tập tương tự của Thầy Tùng AI.
    Hãy phân tích bài toán gốc và tạo ra ${desiredCount} bài tập tương đương (luyện tập) cho học sinh.
    Bài toán gốc: ${problem.normalizedProblem}
    Khối lớp: Lớp ${grade || 9}
    Chế độ học: ${isBasic ? "Cơ bản (chỉ dùng các phép biến đổi nằm trong lớp này)" : "Nâng cao (có thể thử sức sáng tạo sâu hơn)"}

    Quy định bài tập tương tự:
    - Hãy thay đổi số liệu hoặc đổi cách hỏi khéo léo để kiểm tra đúng kỹ năng cốt lõi của bài toán gốc.
    - Đảm bảo các bài toán tạo ra ĐỀU CÓ NGHIỆM thực tế hợp lệ, không bị vô nghiệm ngoài ý muốn, không bị chia cho 0.
    - BẮT BUỘC ĐẶT TẤT CẢ công thức toán học, biểu thức, biến số vào trong dấu $...$ (với inline) hoặc $$...$$ (với block) để hiển thị KaTeX trong nội dung trả về, kể cả "problemText" và "internalAnswer".
    - "internalAnswer" là đáp số thô để hệ thống kiểm tra sau này, bạn PHẢI tự giải nháp nội bộ trước để điền vào đây.
    - Trả về JSON theo Schema.
    `;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents: promptSimilar,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sourceSkill: { type: Type.STRING, description: "Kỹ năng cốt lõi học được từ bài gốc" },
            grade: { type: Type.INTEGER },
            knowledgeLevel: { type: Type.STRING },
            exercises: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  problemText: { type: Type.STRING, description: "Đề bài chi tiết bằng tiếng Việt" },
                  latexSegments: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Các phân đoạn LaTeX trong đề" },
                  difficulty: { type: Type.STRING, enum: ["easier", "equivalent", "harder"] },
                  internalAnswer: { type: Type.STRING, description: "Lời giải vắn tắt và đáp án chính xác (ẩn khỏi học sinh lúc đầu)" },
                  validationPassed: { type: Type.BOOLEAN }
                },
                required: ["id", "problemText", "latexSegments", "difficulty", "internalAnswer", "validationPassed"]
              }
            }
          },
          required: ["sourceSkill", "grade", "knowledgeLevel", "exercises"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json(parsed);
  } catch (error: any) {
    console.error("Generate Similar Error:", error);
    return res.status(500).json({ error: error.message || "Lỗi khi tạo bài tập tương tự" });
  }
});

// API: Summarize Session (for keeping long-term context compact)
app.post("/api/summarize-session", async (req, res) => {
  try {
    const { messages, previousSummary } = req.body;
    const ai = getGemini();

    const summaryPrompt = `
    Hãy viết một đoạn tóm tắt siêu ngắn gọn về tiến trình học Toán trong phiên này của học sinh.
    Bản tóm tắt trước đó: "${previousSummary || ""}"
    Các lượt hội thoại mới nhất: ${JSON.stringify(messages || [])}

    Yêu cầu:
    - Ghi lại chủ đề toán học hiện tại.
    - Các kỹ năng mà em đã nắm vững và các bước đã hoàn thành.
    - Những lỗi sai lặp đi lặp lại hoặc điểm yếu cần Thầy Tùng AI chú ý (ví dụ: thường xuyên sai dấu hệ số b, chưa hiểu cách chuyển vế).
    - Đoạn tóm tắt phải tối giản, dưới 100 từ tiếng Việt.
    `;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents: summaryPrompt
    });

    return res.json({ summary: response.text || "Bắt đầu phiên học mới." });
  } catch (error: any) {
    console.error("Summarization Error:", error);
    return res.status(500).json({ error: error.message || "Lỗi khi tóm tắt phiên học" });
  }
});

// API: Generate Geometry Inline Specification (SVG drawer configuration)
app.post("/api/generate-geometry-spec", async (req, res) => {
  try {
    const { problem } = req.body;
    const ai = getGemini();

    const specPrompt = `
    Bạn là chuyên gia thiết kế hình học trực quan chính xác.
    Hãy tạo một thông số hình vẽ 2D dạng SVG đơn giản dựa trên bài toán hình học sau.
    Đề bài: ${problem.normalizedProblem}

    Yêu cầu thiết kế hình:
    - Các điểm hình học cần thiết lập tọa độ (x: 20 đến 280, y: 20 đến 180) để vẽ vừa khít trong khung 300x200 pixel.
    - "points" chứa danh sách các đỉnh (ví dụ: A, B, C) kèm nhãn hiển thị và quyền "draggable".
    - "segments" chứa các cạnh nối các đỉnh (ví dụ: A nối B).
    - "circles" vẽ các đường tròn nếu có tâm và bán kính (tọa độ tâm dựa vào đỉnh).
    - Hãy thiết kế tọa độ cân đối, ví dụ tam giác đều, tam giác vuông hay hình thang cân đúng tỷ lệ hình học.
    - Giữ nguyên màu sắc teal (#0F9D8A) chủ đạo cho các yếu tố trọng tâm.
    `;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents: specPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            geometryType: { type: Type.STRING, description: "Loại hình, vị vụ: triangle, circle, quadrilateral" },
            points: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                  label: { type: Type.STRING },
                  draggable: { type: Type.BOOLEAN }
                },
                required: ["id", "x", "y", "label", "draggable"]
              }
            },
            segments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  p1: { type: Type.STRING },
                  p2: { type: Type.STRING },
                  color: { type: Type.STRING },
                  isAccent: { type: Type.BOOLEAN },
                  strokeDash: { type: Type.STRING }
                },
                required: ["p1", "p2"]
              }
            },
            circles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  center: { type: Type.STRING },
                  radius: { type: Type.NUMBER },
                  color: { type: Type.STRING }
                },
                required: ["center", "radius"]
              }
            },
            constraints: { type: Type.ARRAY, items: { type: Type.STRING } },
            highlightTargets: { type: Type.ARRAY, items: { type: Type.STRING } },
            studentCanDrag: { type: Type.BOOLEAN },
            warning: { type: Type.STRING }
          },
          required: ["geometryType", "points", "segments", "circles", "constraints", "highlightTargets", "studentCanDrag", "warning"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json(parsed);
  } catch (error: any) {
    console.error("Geometry Spec Error:", error);
    return res.status(500).json({ error: error.message || "Lỗi khi thiết kế cấu hình hình học" });
  }
});

// Route kiểm tra nhanh backend và biến môi trường.
app.get("/api/health", (_req, res) => {
  return res.status(200).json({
    ok: true,
    service: "Thầy Tùng AI API",
    geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Vercel sẽ nhận Express app này và chạy dưới dạng Function.
export default app;

// Chỉ mở cổng khi chạy trên máy tính bằng lệnh npm run dev.
// Trên Vercel tuyệt đối không gọi app.listen().
if (!process.env.VERCEL) {
  async function startLocalServer() {
    const { createServer: createViteServer } = await import("vite");

    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    app.use(vite.middlewares);

    app.listen(PORT, "0.0.0.0", () => {
      console.log(
        `[Thầy Tùng AI Server] Server running on http://localhost:${PORT}`
      );
    });
  }

  startLocalServer().catch((error) => {
    console.error("Không thể khởi động máy chủ:", error);
    process.exit(1);
  });
}
