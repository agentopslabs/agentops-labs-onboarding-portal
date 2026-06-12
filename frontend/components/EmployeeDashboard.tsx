import React from "react";
import { 
  FileText, 
  BookOpen, 
  CheckCircle, 
  Award, 
  Bell, 
  Play, 
  ArrowRight, 
  AlertTriangle,
  Clock,
  ThumbsUp,
  XCircle,
  HelpCircle
} from "lucide-react";
import { useTheme } from "./ThemeContext";
import { 
  Application, 
  AssignedTest, 
  SystemNotification, 
  ApplicationStatus, 
  TestStatus 
} from "../types";

interface EmployeeDashboardProps {
  application: Application | null;
  assignedTests: AssignedTest[];
  notifications: SystemNotification[];
  onSelectTab: (tab: string) => void;
  onStartTest: (testRecord: AssignedTest) => void;
}

export default function EmployeeDashboard({
  application,
  assignedTests,
  notifications,
  onSelectTab,
  onStartTest
}: EmployeeDashboardProps) {
  const adminTheme = useTheme();

  const appStatus = application ? application.status : ApplicationStatus.NOT_STARTED;
  const isEligibleForTest = appStatus === ApplicationStatus.SUBMITTED || appStatus === ApplicationStatus.APPROVED;

  // Stats
  const totalAssigned = assignedTests.length;
  const completedAssigned = assignedTests.filter(t => t.status === TestStatus.COMPLETED).length;
  const pendingAssigned = totalAssigned - completedAssigned;

  // Latest Outcome Evaluator
  const completedList = assignedTests
    .filter(t => t.status === TestStatus.COMPLETED)
    .sort((a, b) => {
      const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return dateB - dateA; // descending
    });

  const latestResult = completedList.length > 0 ? completedList[0] : null;
  const passStatusCleared = completedList.length > 0 && completedList.every(t => t.passed);

  // Status Badge Label Helper
  function getAppStatusLabel(status: ApplicationStatus) {
    switch (status) {
      case ApplicationStatus.APPROVED:
        return { text: "Approved", style: "bg-emerald-50 text-emerald-700 border border-emerald-250 border-emerald-200" };
      case ApplicationStatus.REJECTED:
        return { text: "Rejected", style: "bg-rose-50 text-rose-700 border border-rose-250 border-rose-200" };
      case ApplicationStatus.SUBMITTED:
        return { text: "Submitted", style: "bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe]" };
      case ApplicationStatus.DRAFT:
        return { text: "Draft Profile", style: "bg-slate-50 text-slate-700 border border-slate-200" };
      default:
        return { text: "Not Started", style: "bg-amber-50 text-amber-700 border border-amber-200" };
    }
  }

  const appBadge = getAppStatusLabel(appStatus);

  return (
    <div className="space-y-6 animate-fade-in text-left">
      
      {/* Welcome Banner */}
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Onboarding Desk & Workspace</h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete your onboarding stages safely. Submit the entry details form to unlock qualification credentials.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-600 font-medium">
          <Clock className="h-4 w-4 text-slate-450" />
          <span>Onboarding Campaign: active</span>
        </div>
      </div>

      {/* STATS CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs font-sans">
        
        {/* Stat 1: Application Status */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Application Status</span>
            <FileText className="h-4 w-4 text-slate-400" />
          </div>
          <div>
            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${appBadge.style} mt-1`}>
              {appBadge.text}
            </span>
            <p className="text-[10px] text-slate-400 mt-1.5 leading-none">Submission Eligibility</p>
          </div>
        </div>

        {/* Stat 2: Assigned Tests Count */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned Certs</span>
            <BookOpen className="h-4 w-4 text-slate-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800 font-mono mt-1">{totalAssigned}</h3>
            <p className="text-[10px] text-slate-400 mt-1 leading-none">{pendingAssigned} exams outstanding</p>
          </div>
        </div>

        {/* Stat 3: Completed Tests Count */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Completed Exams</span>
            <CheckCircle className="h-4 w-4 text-slate-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800 font-mono mt-1">{completedAssigned}</h3>
            <p className="text-[10px] text-slate-400 mt-1 leading-none">Graded evaluations</p>
          </div>
        </div>

        {/* Stat 4: Latest Test Result */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Latest Score</span>
            <Award className="h-4 w-4 text-slate-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800 font-mono mt-1">
              {latestResult ? `${latestResult.score}%` : "None"}
            </h3>
            <p className="text-[10px] text-slate-400 mt-1 leading-none truncate" title={latestResult ? latestResult.testName : "No exam history"}>
              {latestResult ? latestResult.testName : "No exam history"}
            </p>
          </div>
        </div>

        {/* Stat 5: Pass/Fail Clear Status */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Final Verification</span>
            <ThumbsUp className="h-4 w-4 text-slate-400" />
          </div>
          <div>
            <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 ${
              completedList.length === 0 
                ? "bg-slate-50 text-slate-600 border border-slate-200" 
                : passStatusCleared 
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                : "bg-rose-50 text-rose-700 border border-rose-200"
            }`}>
              {completedList.length === 0 ? "UNKNOWN" : passStatusCleared ? "PASSED" : "RETAKES REQUIRED"}
            </span>
            <p className="text-[10px] text-slate-400 mt-1 px-0.5 leading-none">Onboarding criteria</p>
          </div>
        </div>

      </div>

      {/* Profiling Lock Alert Disclaimer */}
      {!isEligibleForTest && (
        <div className="p-5 rounded-xl bg-amber-50 border border-amber-200 text-slate-800 text-xs leading-relaxed flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-slate-900 text-sm">Action Needed: Submission Pending</h4>
            <p className="text-slate-600 mt-0.5">
              Your onboarding candidate profile state is currently marked as {appStatus.toUpperCase().replace('_', ' ')}. You of course cannot initiate test processes until basic profile details has been submitted.
            </p>
          </div>
          <button
            onClick={() => onSelectTab("employee-application")}
            className="sm:ml-auto flex items-center gap-1.5 bg-slate-900 hover:bg-slate-850 text-white font-bold py-2.5 px-4 rounded-xl transition cursor-pointer"
          >
            Complete Form Now <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* RESULTS SECTIONS */}
      <div className="grid grid-cols-1 gap-6">
        
        {/* Left Side: Latest Assessment Widget & Assessment History */}
        <div className="space-y-6">
          
          {/* Latest Assessment Widget Card */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden text-xs">
            <div className="p-4 px-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Latest Assessment Grade</h3>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded">Evaluated</span>
            </div>

            <div className="p-5">
              {latestResult ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Assigned Exam</span>
                    <h4 className="text-sm font-bold text-slate-850 text-slate-800 truncate" title={latestResult.testName}>{latestResult.testName}</h4>
                    <p className="text-xs text-slate-400 font-mono mt-1">Completed Date: {latestResult.completedAt ? new Date(latestResult.completedAt).toLocaleDateString() : "N/A"}</p>
                  </div>

                  <div className="space-y-1 flex flex-col md:items-center">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block md:text-center">Evaluation Score</span>
                      <div className="flex items-baseline gap-1 mt-0.5 md:justify-center">
                        <span className="text-2xl font-black text-slate-800 font-mono">{latestResult.score}%</span>
                        <span className="text-slate-455 text-slate-450 font-mono text-[11px]">Score</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col md:items-end">
                    <span className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 self-start md:self-auto">Status Outcome</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider p-1 px-3 rounded-full flex items-center gap-1 leading-none ${
                      latestResult.passed 
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-250 border-emerald-200" 
                        : "bg-rose-50 text-rose-700 border border-rose-250 border-rose-200"
                    }`}>
                      {latestResult.passed ? (
                        <>
                          <CheckCircle className="h-3 w-3 text-emerald-600" />
                          Passed
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 text-rose-600" />
                          Retake Needed
                        </>
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-405 text-slate-400">
                  <Award className="h-8 w-8 mx-auto text-slate-350 opacity-40 mb-2" />
                  <span>No completed exam achievements logged to your onboard profile.</span>
                </div>
              )}
            </div>
          </div>

          {/* Assessment History Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden text-xs">
            <div className="p-4 px-5 bg-slate-50 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Assessment History Logs</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/40 text-[10px] text-slate-400 uppercase font-black tracking-wider">
                    <th className="p-4 px-5">Test Name</th>
                    <th className="p-4">Assigned At</th>
                    <th className="p-4">Completed At</th>
                    <th className="p-4">Graded Score</th>
                    <th className="p-4 px-5">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-105 divide-slate-100 text-slate-700">
                  {assignedTests.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-450 text-slate-400 font-medium bg-white">
                        No assigned assessments compiled.
                      </td>
                    </tr>
                  ) : (
                    assignedTests.map(test => {
                      const isDone = test.status === TestStatus.COMPLETED;
                      const hasStarted = test.status === TestStatus.IN_PROGRESS;
                      return (
                        <tr key={test.id} className="hover:bg-slate-50 transition duration-150">
                          <td className="p-4 px-5 font-bold text-slate-900 truncate max-w-[180px]" title={test.testName}>
                            {test.testName}
                          </td>
                          <td className="p-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {test.startedAt ? new Date(test.startedAt).toLocaleDateString() : "N/A"}
                          </td>
                          <td className="p-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {isDone && test.completedAt ? new Date(test.completedAt).toLocaleDateString() : "-"}
                          </td>
                          <td className="p-4 font-mono font-bold text-slate-800">
                            {isDone ? `${test.score}%` : "-"}
                          </td>
                          <td className="p-4 px-5">
                            <span className={`inline-block text-[10px] font-bold uppercase ${
                              isDone
                                ? (test.passed ? "text-emerald-600" : "text-rose-600")
                                : hasStarted
                                ? "text-amber-600 animate-pulse"
                                : "text-slate-500"
                            }`}>
                              {isDone 
                                ? (test.passed ? "✔ Passed" : "✘ Failed") 
                                : hasStarted 
                                ? "In Progress" 
                                : "Not Started"
                              }
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
