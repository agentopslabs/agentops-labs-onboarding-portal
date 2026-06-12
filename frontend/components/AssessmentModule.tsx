import React, { useState, useEffect, useRef } from "react";
import { 
  Play, 
  Clock, 
  HelpCircle, 
  Maximize, 
  Minimize, 
  AlertTriangle, 
  ChevronRight, 
  ChevronLeft, 
  Send,
  Lock,
  Compass,
  MonitorPlay,
  Terminal,
  Activity,
  CheckCircle,
  XCircle,
  HelpCircle as QuestionIcon
} from "lucide-react";
import { useTheme } from "./ThemeContext";
import { Test, Question, QuestionType, AssignedTest } from "../types";

interface AssessmentModuleProps {
  testRecord: AssignedTest;
  testTemplate: Test;
  onSubmitted: () => void;
  onExit: () => void;
}

export default function AssessmentModule({
  testRecord,
  testTemplate,
  onSubmitted,
  onExit
}: AssessmentModuleProps) {
  const { isDark, toggleTheme, cardBg, textPrimary, textSecondary } = useTheme();

  // Active question index
  const [activeIdx, setActiveIdx] = useState(0);

  // Selected Answers: questionId -> optionIndices[]
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number[]>>({});

  // Countdown timers (seconds)
  const [timeLeft, setTimeLeft] = useState(() => {
    if (testRecord.remainingTime !== undefined && testRecord.remainingTime !== null) {
      return testRecord.remainingTime;
    }
    return testTemplate.duration * 60;
  });

  // Full Screen modes visual toggle state
  const [isFullScreen, setIsFullScreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Grade/Save feedback
  const [savingState, setSavingState] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<AssignedTest | null>(null);
  const [submitError, setSubmitError] = useState("");

  // Safe backdrop modal confirmation states
  const [confirmModal, setConfirmModal] = useState<{
    type: "pause" | "submit";
    message: string;
  } | null>(null);

  const answersRef = useRef(selectedAnswers);
  const timeLeftRef = useRef(timeLeft);
  const lastSeededIdRef = useRef<string | null>(null);

  useEffect(() => {
    answersRef.current = selectedAnswers;
  }, [selectedAnswers]);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  // Seed existing answers if resumed - track testRecord.id to prevent background polling from resetting candidate selections
  useEffect(() => {
    if (testRecord.id !== lastSeededIdRef.current) {
      lastSeededIdRef.current = testRecord.id;
      if (testRecord.answers) {
        setSelectedAnswers(testRecord.answers);
      } else {
        setSelectedAnswers({});
      }
    }
  }, [testRecord]);

  // Instant or on-demand sync of candidate progress to the server to prevent data loss on page refreshes
  async function saveProgressToServer(answersToSend: Record<string, number[]>, time: number) {
    setSavingState(true);
    try {
      await fetch(`/api/assigned-tests/${testRecord.id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: answersToSend,
          remainingTime: time
        })
      });
    } catch (e) {
      console.error("[Autosave Error] failed syncing progress:", e);
    } finally {
      setTimeout(() => setSavingState(false), 200);
    }
  }

  // Launch countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Auto Submit!
          handleAutoSubmitOnTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Periodic Auto-Save Draft interval
  useEffect(() => {
    const autosave = setInterval(() => {
      handleAutosaveState();
    }, 8000); // every 8 seconds

    return () => clearInterval(autosave);
  }, []);

  // Request browser Full screen or overlay simulator
  function toggleDisplayFullScreen() {
    if (!isFullScreen) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullScreen(false);
    }
  }

  // Monitor Esc key full screen exits
  useEffect(() => {
    function onFullScreenChange() {
      setIsFullScreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFullScreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullScreenChange);
  }, []);

  // Autosave answers payload to API
  async function handleAutosaveState() {
    setSavingState(true);
    try {
      await fetch(`/api/assigned-tests/${testRecord.id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: answersRef.current,
          remainingTime: timeLeftRef.current
        })
      });
    } catch (e) {
      console.error("[Autosave] Sync error:", e);
    } finally {
      setTimeout(() => setSavingState(false), 300);
    }
  }

  // Answer selections toggles
  function handleToggleOption(qId: string, optIdx: number, qType: QuestionType) {
    const answersArr = selectedAnswers[qId] || [];
    let updated: Record<string, number[]>;

    if (qType === QuestionType.MULTIPLE_CHOICE) {
      // Toggle multiple checkboxes
      if (answersArr.includes(optIdx)) {
        updated = {
          ...selectedAnswers,
          [qId]: answersArr.filter(idx => idx !== optIdx)
        };
      } else {
        updated = {
          ...selectedAnswers,
          [qId]: [...answersArr, optIdx]
        };
      }
    } else {
      // Single choice or boolean
      updated = {
        ...selectedAnswers,
        [qId]: [optIdx]
      };
    }

    setSelectedAnswers(updated);
    saveProgressToServer(updated, timeLeft);
  }

  // Submit test
  async function handleSubmitExam() {
    setSavingState(true);
    setSubmitError("");
    try {
      const res = await fetch(`/api/assigned-tests/${testRecord.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: selectedAnswers })
      });

      if (res.ok) {
        const payload = await res.json();
        setSubmitSuccess(payload);
        // Revoke fullscreen simulated lock
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
        setIsFullScreen(false);
      } else {
        setSubmitError("Failed to submit and grade answers.");
      }
    } catch (e) {
      setSubmitError("Failed to communicate with auto grading engine.");
    } finally {
      setSavingState(false);
    }
  }

  // Save progress and pause test (the confirm is handled in React UI before this is called)
  async function handlePauseAndExit() {
    setSavingState(true);
    try {
      const res = await fetch(`/api/assigned-tests/${testRecord.id}/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: selectedAnswers, remainingTime: timeLeft })
      });
      if (res.ok) {
        onExit();
      } else {
        console.error("Failed to pause assessment cleanly on server.");
        onExit(); 
      }
    } catch (e) {
      console.error(e);
      onExit();
    } finally {
      setSavingState(false);
    }
  }

  function handleAutoSubmitOnTimeout() {
    console.log("[Auto-Submit] Timer exceeded!");
    handleSubmitExam();
  }

  const currentQ = testTemplate.questions[activeIdx];
  const totalQuestionsIndex = testTemplate.questions.length;

  // Formatting utility
  function formatQuizTimer(secs: number) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  // Timer alerts levels
  const isTimeCritical = timeLeft < 120; // less than 2 mins

  return (
    <div 
      ref={containerRef}
      className={`fixed inset-0 z-50 overflow-y-auto flex flex-col justify-between ${
        isFullScreen ? "bg-slate-950 text-slate-100 p-6 md:p-10" : "bg-slate-950/95 backdrop-blur-md p-4 md:p-8"
      }`}
    >
      {/* Top Header Controls bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-900 pb-4 mb-6">
        <div className="flex items-center gap-3 text-left">
          <div className="bg-cyan-500/10 p-2 rounded-lg border border-cyan-500/20 text-cyan-400">
            <MonitorPlay className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-205 text-white">{testTemplate.name}</h2>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-mono">
              <span>Req Pass Ratio: {testTemplate.passingMarks}%</span>
              <span>•</span>
              {savingState ? (
                <span className="text-cyan-400 animate-pulse flex items-center gap-1">Saving answers...</span>
              ) : (
                <span className="text-slate-500">Auto-save connected</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3.5">
          {/* Fullscreen widget */}
          <button
            onClick={toggleDisplayFullScreen}
            className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            {isFullScreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>

          {/* TIMER */}
          <div className={`flex items-center gap-2 p-2 px-3.5 rounded-lg border font-mono text-xs font-bold ${
            isTimeCritical 
              ? "bg-rose-500/10 border-rose-500/30 text-rose-450 text-red-400 animate-pulse" 
              : "bg-slate-900 border-slate-850 text-cyan-400"
          }`}>
            <Clock className={`h-4.5 w-4.5 ${isTimeCritical ? 'animate-bounce' : ''}`} />
            <span>{formatQuizTimer(timeLeft)}</span>
          </div>

          <button
            onClick={() => setConfirmModal({
              type: "pause",
              message: "Any unsaved answers will be retained in state, but you will leave this assessment cycle. Proceed?"
            })}
            className="bg-slate-900 border border-slate-800 hover:bg-slate-805 text-xs text-slate-400 hover:text-white py-2 px-3.5 rounded-lg font-bold cursor-pointer"
          >
            Pause & Exit [X]
          </button>
        </div>
      </div>

      {/* Warning layout simulation about full screen */}
      {!isFullScreen && !submitSuccess && (
        <div className="mb-6 p-3 bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 text-[10px] rounded-lg text-left flex items-center gap-2.5 leading-snug">
          <AlertTriangle className="h-4 w-4 text-indigo-400 flex-shrink-0" />
          <p>
            🛡 Candidate Notice: We recommend toggling <span className="font-extrabold text-indigo-350 cursor-pointer underline" onClick={toggleDisplayFullScreen}>FULL SCREEN MODE [Fullscreen]</span> to preserve integrity checks of the assessment layout and eliminate distracting browser notifications.
          </p>
        </div>
      )}

      {/* Main Panel Content split: Left question, Right index mapper */}
      {submitSuccess ? (
        // Successful submit results display screen
        <div className="flex-1 flex flex-col items-center justify-center text-center max-w-xl mx-auto space-y-6">
          <div className={`p-8 bg-slate-900/60 border border-slate-850 rounded-2xl w-full text-xs space-y-5 leading-normal`}>
            {submitSuccess.passed ? (
              <div className="flex flex-col items-center">
                <div className="h-14 w-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 animate-bounce">
                  <CheckCircle className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-black text-slate-100">CERTIFICATE PASSED!</h3>
                <p className="text-slate-400 mt-1 max-w-sm">Congratulations! Your score met the passing criteria. Automated notification dispatched to HR.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="h-14 w-14 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-450 text-rose-400 mb-3 animate-pulse">
                  <XCircle className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-black text-slate-100">RETAKE REQUIRED</h3>
                <p className="text-slate-400 mt-1 max-w-xs">Your grade fell below the minimum score threshold. Please schedule a retake preparation.</p>
              </div>
            )}

            <div className="p-4 bg-slate-950 font-mono rounded-lg border border-slate-800 flex justify-between gap-4 text-left">
              <div>
                <p><span className="text-slate-500">Participant:</span> <span className="text-slate-200">Candidate Workspace</span></p>
                <p><span className="text-slate-500">Quiz:</span> <span className="text-slate-205">{testTemplate.name}</span></p>
                <p><span className="text-slate-500">Criteria Passing score:</span> <span className="text-slate-205">{testTemplate.passingMarks}%</span></p>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block">YOUR RESULT</span>
                <h2 className={`text-2xl font-black ${submitSuccess.passed ? 'text-green-400' : 'text-rose-400'}`}>
                  {submitSuccess.score}% ({submitSuccess.score} / 100 Marks)
                </h2>
                <span className={`text-[10px] font-bold ${submitSuccess.passed ? 'text-green-400' : 'text-rose-400'}`}>
                  {submitSuccess.passed ? "APPROVED" : "UNAPPROVED"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onSubmitted}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs py-2.5 rounded-lg transition"
            >
              Back to Dashboard Overview
            </button>
          </div>
        </div>
      ) : (
        // Interactive questionnaire panels
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-8 text-xs text-left mb-6">
          
          {/* Left panel: Active question */}
          <div className="md:col-span-8 flex flex-col justify-between">
            <div className="bg-slate-900/40 border border-slate-850 p-6 md:p-8 rounded-xl space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono border-b border-slate-900 pb-3">
                <span className="text-purple-400 font-extrabold uppercase">Question {activeIdx + 1} of {totalQuestionsIndex}</span>
                <span className="text-slate-400 bg-slate-900 border border-slate-800/60 px-2 py-0.5 rounded font-bold">
                  Module: {currentQ.moduleName || "General"}
                </span>
                <span className="text-amber-400 font-bold bg-amber-500/5 border border-amber-500/10 px-2 py-0.5 rounded">
                  Marks: {(100 / totalQuestionsIndex).toFixed(2)}
                </span>
                <span className="bg-slate-800 text-slate-400 px-2 py-0.2 rounded uppercase">
                  {currentQ.type.replace('_', ' ')}
                </span>
              </div>

              <h4 className="text-sm font-black text-slate-100 font-mono tracking-wide leading-relaxed">
                {currentQ.text}
              </h4>

              {/* Answers options rendering */}
              <div className="space-y-3 pt-2">
                {currentQ.options.map((opt, oIdx) => {
                  const answersArr = selectedAnswers[currentQ.id] || [];
                  const isSelected = answersArr.includes(oIdx);
                  const isMultipleInput = currentQ.type === QuestionType.MULTIPLE_CHOICE;

                  return (
                    <div
                      key={oIdx}
                      onClick={() => handleToggleOption(currentQ.id, oIdx, currentQ.type)}
                      className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isSelected 
                          ? "bg-indigo-505/10 bg-indigo-500/10 border-indigo-500 text-slate-100 shadow-lg shadow-indigo-500/5 translate-x-1" 
                          : "bg-slate-950 hover:bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* option index circle letter */}
                        <div className={`h-6 w-6 rounded-lg text-[11px] font-black font-mono flex items-center justify-center border ${
                          isSelected ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-900 border-slate-800 text-slate-500"
                        }`}>
                          {String.fromCharCode(65 + oIdx)}
                        </div>
                        <span className="font-medium text-slate-205">{opt}</span>
                      </div>

                      {/* checkbox/radio visual decoration feedback */}
                      <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                        isSelected ? "bg-cyan-500 border-cyan-400" : "border-slate-800"
                      }`}>
                        {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-slate-950" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Back Forward Navigation triggers */}
            <div className="flex items-center justify-between gap-4 mt-6">
              <button
                disabled={activeIdx === 0}
                onClick={() => setActiveIdx(activeIdx - 1)}
                className={`flex items-center gap-1.5 py-2 px-4 rounded-lg font-bold text-xs transition border ${
                  activeIdx === 0 
                    ? "text-slate-600 border-slate-900 bg-transparent cursor-not-allowed" 
                    : "text-slate-300 border-slate-800 hover:bg-slate-900 cursor-pointer"
                }`}
              >
                <ChevronLeft className="h-4 w-4" /> Previous Question
              </button>

              {activeIdx < totalQuestionsIndex - 1 ? (
                <button
                  onClick={() => setActiveIdx(activeIdx + 1)}
                  className="flex items-center gap-1.5 py-2 px-5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs border border-slate-800 cursor-pointer"
                >
                  Skip / Next Question <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    const unansweredCount = testTemplate.questions.filter(q => !selectedAnswers[q.id] || selectedAnswers[q.id].length === 0).length;
                    const confirmMsg = unansweredCount > 0 
                      ? `Warning: You have omitted ${unansweredCount} questions. Submit answers anyway for immediate HR grading?`
                      : "Submit assessment and calculate scoring outcomes immediately?";
                    setConfirmModal({
                      type: "submit",
                      message: confirmMsg
                    });
                  }}
                  className="flex items-center gap-1.5 py-2 px-5 rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black text-xs shadow-lg shadow-emerald-950/10 cursor-pointer uppercase"
                >
                  <Send className="h-4.5 w-4.5" /> Submit Assessment
                </button>
              )}
            </div>
          </div>

          {/* Right panel: Indexes navigator list */}
          <div className="md:col-span-4 space-y-4">
            <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-905 border-b border-slate-900 pb-2">
                📋 Questionnaire Index Sheet
              </h4>
              <p className="text-[11px] text-slate-505 leading-relaxed text-slate-500">Click indices below to quickly slide across assessment cards.</p>

              <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1">
                {Object.entries(
                  testTemplate.questions.reduce((acc, q, idx) => {
                    const mod = q.moduleName || "General";
                    if (!acc[mod]) acc[mod] = [];
                    acc[mod].push({ q, originalIdx: idx });
                    return acc;
                  }, {} as Record<string, { q: Question; originalIdx: number }[]>)
                ).map(([moduleName, items]) => (
                  <div key={moduleName} className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between border-b border-slate-900 pb-1">
                      <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase">{moduleName}</span>
                      <span className="text-[9px] text-slate-500 font-mono">
                        {items.length} Qs • {((items.length / totalQuestionsIndex) * 100).toFixed(0)} Marks
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-2 pt-1">
                      {items.map(({ q, originalIdx }) => {
                        const hasAnswered = selectedAnswers[q.id] && selectedAnswers[q.id].length > 0;
                        const isActive = originalIdx === activeIdx;

                        return (
                          <button
                            key={q.id}
                            onClick={() => setActiveIdx(originalIdx)}
                            className={`h-9 rounded-lg font-mono text-[11px] font-bold flex flex-col items-center justify-center border relative cursor-pointer transition-all ${
                              isActive 
                                ? "bg-cyan-505/10 border-cyan-400 text-cyan-400 ring-2 ring-cyan-500/10 font-black" 
                                : hasAnswered 
                                ? "bg-indigo-500/10 border-indigo-400/50 text-indigo-400" 
                                : "bg-slate-950 border-slate-850 text-slate-600 hover:text-white"
                            }`}
                          >
                            {originalIdx + 1}
                            {hasAnswered && (
                              <span className="absolute bottom-1 right-1 h-1 w-1 rounded-full bg-indigo-500" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-900 pt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[9px] font-mono text-slate-550 text-slate-500 uppercase">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-cyan-500/10 border border-cyan-500/40" /> Active screen</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-indigo-500/10 border border-indigo-500/40" /> Answered card</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-slate-950 border border-slate-800" /> Unanswered</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Safe dialog backdrop overlay (immune to iframe browser blocking constraints) */}
      {confirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 text-left space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-amber-550 text-amber-500">
              <AlertTriangle className="h-5 w-5" />
              <h4 className="text-xs font-black uppercase text-slate-105 text-slate-200 tracking-wider">
                {confirmModal.type === "pause" ? "Pause & Exit Test" : "Submit Assessment"}
              </h4>
            </div>
            <p className="text-slate-350 text-slate-300 text-xs leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={savingState}
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 bg-slate-800 hover:bg-slate-700 hover:text-white transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingState}
                onClick={async () => {
                  if (confirmModal.type === "pause") {
                    await handlePauseAndExit();
                  } else {
                    await handleSubmitExam();
                  }
                  setConfirmModal(null);
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {savingState ? (
                  <>
                    <span className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Confirm"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
