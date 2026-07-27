export type GradeType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type StudentAbility = 
  | "foundation" 
  | "average" 
  | "average_good" 
  | "good" 
  | "advanced";

export type KnowledgeLevel = "basic" | "advanced";

export type SupportMode = "hints" | "step_by_step" | "exam_solution";

export interface LatexSegment {
  id: string;
  latex: string;
  displayMode: boolean;
}

export interface AmbiguityPart {
  location: string;
  recognizedAs: string;
  reason: string;
  questionForStudent: string;
}

export interface ExtractedProblem {
  rawText: string;
  normalizedProblem: string;
  problemType: "algebra" | "geometry" | "statistics" | "probability" | "calculus" | "arithmetic" | "other";
  topic: string;
  estimatedGrade: number;
  difficulty: "easy" | "medium" | "hard" | "very_hard";
  givenData: string[];
  requirements: string[];
  latexSegments: LatexSegment[];
  ambiguousParts: AmbiguityPart[];
  confidence: number;
}

export interface HintItem {
  id: string;
  title: string;
  content: string;
  level: number;
  status: "unviewed" | "viewed" | "applied";
  explanation?: string;
  newSubHint?: string;
  isExplaining?: boolean;
}

export interface HintResponse {
  responseType: "hints";
  difficulty: "easy" | "medium" | "hard" | "very_hard";
  allowedKnowledge: string[];
  hints: HintItem[];
  followUpQuestion: string;
  containsFinalAnswer: boolean;
}

export interface StepItem {
  stepId: string;
  stepNumber: number;
  title: string;
  objective: string;
  promptForStudent: string;
  inputType: "text_math" | "text" | "number" | "image";
  status: "waiting" | "checking" | "correct" | "incorrect" | "nearly_correct";
}

export interface StepResponse {
  responseType: "step";
  currentStep: StepItem;
  progress: {
    completed: number;
    total: number;
  };
}

export interface StepEvaluation {
  grade: "correct" | "nearly_correct" | "incorrect" | "incomplete" | "needs_clarification";
  feedback: string;
  nextStep?: StepItem | null;
  completed?: boolean;
}

export interface SolutionBlock {
  type: "text" | "math" | "mixed";
  content: string;
}

export interface ExamSolutionResponse {
  responseType: "exam_solution";
  title: string;
  conditions: string[];
  solutionBlocks: SolutionBlock[];
  conclusion: string;
  extraExplanation: boolean;
}

export interface SimilarExercise {
  id: string;
  problemText: string;
  latexSegments: string[];
  difficulty: "easier" | "equivalent" | "harder";
  internalAnswer?: string;
  validationPassed?: boolean;
}

export interface SimilarExerciseResponse {
  sourceSkill: string;
  grade: number;
  knowledgeLevel: KnowledgeLevel;
  exercises: SimilarExercise[];
}

export interface GeometryPoint {
  id: string;
  x: number;
  y: number;
  label?: string;
  draggable?: boolean;
}

export interface GeometrySegment {
  p1: string; // Point ID 1
  p2: string; // Point ID 2
  color?: string;
  isAccent?: boolean;
  strokeDash?: string;
}

export interface GeometryCircle {
  center: string;
  radius: number;
  color?: string;
}

export interface GeometrySpecResponse {
  geometryType: string;
  points: GeometryPoint[];
  segments: GeometrySegment[];
  circles: GeometryCircle[];
  constraints: string[];
  highlightTargets: string[];
  studentCanDrag: boolean;
  warning: string;
}

export interface Message {
  id: string;
  sender: "user" | "assistant";
  timestamp: string;
  text?: string;
  image?: string; // base64 payload
  status?: "pending" | "done" | "error";
  
  // Custom response components based on standard types:
  reviewProblem?: ExtractedProblem; // OCR check
  hints?: HintResponse;
  step?: StepResponse;
  examSolution?: ExamSolutionResponse;
  similarExercises?: SimilarExercise[];
  geometrySpec?: GeometrySpecResponse | null;
}

export interface ConversationTurn {
  userMessageId: string;
  assistantMessageId: string;
  timestamp: string;
}

export interface SkillRecord {
  name: string;
  masteryCount: number;
}

export interface MistakeRecord {
  type: string;
  count: number;
  description: string;
}

export interface LearningSession {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  version: number;

  profile: {
    selectedGrade: GradeType;
    studentAbility: StudentAbility;
    knowledgeLevel: KnowledgeLevel;
    preferredMode: SupportMode;
    preferredHintDepth: number;
  };

  currentProblemId: string | null;
  currentProblem: ExtractedProblem | null;
  messages: Message[];
  conversations: ConversationTurn[];
  extractedProblems: ExtractedProblem[];
  generatedExercises: SimilarExercise[];

  learningState: {
    masteredSkills: SkillRecord[];
    weakSkills: SkillRecord[];
    recurringMistakes: MistakeRecord[];
    misconceptions: string[];
    successfulStrategies: string[];
  };

  stepState: {
    hiddenPlanId: string | null;
    currentStepNumber: number;
    totalSteps: number;
    attemptsByStep: Record<string, number>;
    completedStepIds: string[];
  };

  compactSessionSummary: string;
}
