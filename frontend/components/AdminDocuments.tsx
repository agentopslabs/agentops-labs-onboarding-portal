import React, { useState, useEffect } from "react";
import { 
  FileCheck, 
  Search, 
  Clock, 
  CheckCircle, 
  XCircle, 
  MapPin, 
  User, 
  Download, 
  MoreVertical, 
  Info, 
  HelpCircle,
  FileSpreadsheet
} from "lucide-react";
import { useTheme } from "./ThemeContext";
import { EmployeeDocument, DocumentStatus, User as CandidateUser } from "../types";
import DocumentPreviewModal from "./DocumentPreviewModal";
import { triggerDocumentDownload } from "../lib/downloadHelper";

interface AdminDocumentsProps {
  employees: CandidateUser[];
  documents: EmployeeDocument[];
  onRefreshAll: () => void;
}

export default function AdminDocuments({
  employees,
  documents,
  onRefreshAll
}: AdminDocumentsProps) {
  const { cardBg, cardHeaderBg, textPrimary, textSecondary } = useTheme();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterDocType, setFilterDocType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [previewDoc, setPreviewDoc] = useState<EmployeeDocument | null>(null);

  const filteredDocs = documents.filter(doc => {
    // Find candidate matching
    const emp = employees.find(e => e.id === doc.employeeId);
    const empName = emp ? emp.name : "Unknown Candidate";
    
    const matchesSearch = empName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          doc.fileName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDocType = filterDocType === "all" || doc.type === filterDocType;
    const matchesStatus = filterStatus === "all" || doc.status === filterStatus;

    return matchesSearch && matchesDocType && matchesStatus;
  });

  async function handleDocReview(docId: string, status: "approved" | "rejected") {
    const remarks = status === "approved" ? "Verified" : prompt("Enter remarks describing why this compliance document was rejected:");
    if (remarks === null) return; // cancelled

    try {
      const res = await fetch(`/api/documents/${docId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, remarks })
      });
      if (res.ok) {
        onRefreshAll();
      }
    } catch (err) {
      console.error(err);
    }
  }

  function getDocBadgeColor(status: DocumentStatus) {
    switch (status) {
      case DocumentStatus.APPROVED: return "bg-green-500/10 text-green-400 border border-green-500/15";
      case DocumentStatus.REJECTED: return "bg-rose-500/10 text-rose-450 border border-rose-550/15 text-rose-400";
      default: return "bg-amber-500/10 text-amber-500 border border-amber-500/15";
    }
  }

  function getDocLabel(type: string) {
    switch (type) {
      case "resume": return "RESUME (Curriculum Vitae)";
      case "aadhaar": return "AADHAAR Card (National ID)";
      case "pan": return "PAN CARD (Tax Identity)";
      case "photo": return "Passport Sized Photo";
      case "educational": return "Educational Degree Certs";
      case "experience": return "Employment Experience Letts";
      default: return type.toUpperCase();
    }
  }

  return (
    <div className="space-y-6 animate-fade-in text-left">
      {/* Title */}
      <div className="border-b border-slate-200/5 dark:border-slate-800/80 pb-6">
        <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          Compliance Documents Center
          <span className="text-xs bg-cyan-500/15 text-cyan-400 px-2.5 py-0.5 rounded-full border border-cyan-500/25">
            Audit Board
          </span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Perform administrative verification checks on credentials uploaded by candidates (such as Resume, Aadhaar, PAN, and degrees).
        </p>
      </div>

      {/* Filter and search bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search candidate by name or filename..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-500/5 dark:bg-slate-950 border border-slate-200/20 dark:border-slate-800 text-xs py-2.5 pl-10 pr-4 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <select
          value={filterDocType}
          onChange={(e) => setFilterDocType(e.target.value)}
          className="bg-slate-500/5 dark:bg-slate-950 border border-slate-200/20 dark:border-slate-800 text-xs p-2 rounded-lg text-slate-800 dark:text-slate-300 focus:outline-none cursor-pointer"
        >
          <option value="all">All Document Types</option>
          <option value="resume">Resume Files Only</option>
          <option value="aadhaar">Aadhaar Card Checks</option>
          <option value="pan">PAN Card Only</option>
          <option value="photo">Passport Photos</option>
          <option value="educational">Educational Docs</option>
          <option value="experience">Experience Letters</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-slate-500/5 dark:bg-slate-950 border border-slate-200/20 dark:border-slate-800 text-xs p-2 rounded-lg text-slate-800 dark:text-slate-300 focus:outline-none cursor-pointer"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending Review Only</option>
          <option value="approved">Approved List</option>
          <option value="rejected">Rejected List Only</option>
        </select>
      </div>

      {/* Dashboard Documents List */}
      <div className={`rounded-xl ${cardBg} border border-slate-200/30 dark:border-slate-800/80 overflow-hidden shadow-sm`}>
        <div className="overflow-x-auto min-w-full">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-950/45 text-slate-500 text-[10px] uppercase font-bold tracking-wider border-b border-slate-850">
                <th className="p-4 pl-6">Candidate Name / Email</th>
                <th className="p-4">Certificate Type</th>
                <th className="p-4">Uploaded Attachment File</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4">Audit Remarks</th>
                <th className="p-4 text-right pr-6">Administrative Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/10 dark:divide-slate-800/70">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500 max-w-[400px] leading-tight mx-auto">
                    <Info className="h-8 w-8 text-slate-700 mx-auto mb-2 animate-pulse" />
                    No uploaded attachments found matching queries.
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => {
                  const emp = employees.find(e => e.id === doc.employeeId);
                  const candidateName = emp ? emp.name : "Unknown Employee";
                  const candidateEmail = emp ? emp.email : "N/A";
                  return (
                    <tr key={doc.id} className="hover:bg-slate-500/5 transition">
                      <td className="p-4 pl-6">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{candidateName}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{candidateEmail}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold uppercase text-[11px] leading-none text-slate-800 dark:text-slate-200">
                          {getDocLabel(doc.type).split(' ')[0]}
                        </div>
                        <span className="text-[10px] text-slate-500">{doc.type}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-slate-500 truncate max-w-[200px]">
                          <span className="font-semibold text-slate-900 dark:text-indigo-400">{doc.fileName}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{doc.fileSize} • {new Date(doc.uploadedAt).toLocaleDateString()}</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-0.7 rounded-full font-bold uppercase text-[9px] ${getDocBadgeColor(doc.status)}`}>
                          {doc.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-slate-400 italic font-medium leading-relaxed block max-w-[200px]">
                          {doc.remarks || "No remarks loaded"}
                        </span>
                      </td>
                      <td className="p-4 text-right pr-6">
                        <div className="flex justify-end gap-1.5">
                          {/* direct view button */}
                          <button
                            type="button"
                            onClick={() => setPreviewDoc(doc)}
                            className="bg-[#0A2540] hover:bg-slate-900 text-white font-bold p-1 px-2.5 rounded text-[10px] transition cursor-pointer"
                          >
                            View Direct
                          </button>
                          {/* safe download */}
                          <button 
                            type="button"
                            onClick={() => triggerDocumentDownload(doc, candidateName)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold p-1 px-2.5 rounded transition cursor-pointer"
                          >
                            Download
                          </button>
                          {doc.status === DocumentStatus.PENDING ? (
                            <>
                              <button
                                onClick={() => handleDocReview(doc.id, "approved")}
                                className="bg-emerald-950/80 text-emerald-400 border border-emerald-500/20 font-bold p-1 px-2.5 rounded hover:bg-emerald-900 transition"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleDocReview(doc.id, "rejected")}
                                className="bg-rose-955/80 text-rose-400 border border-rose-500/20 font-bold p-1 px-2.5 rounded hover:bg-rose-900 transition"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-semibold italic">Reviewed</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dynamic Document Preview overlay */}
      <DocumentPreviewModal 
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        document={previewDoc}
        candidateName={employees.find(e => e.id === previewDoc?.employeeId)?.name || "Candidate"}
        isAdmin={true}
      />
    </div>
  );
}
