import React, { useState, useEffect } from "react";
import { 
  Upload, 
  Lock, 
  User, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  FileText, 
  Key, 
  Paperclip,
  Check,
  Eye,
  Trash2,
  Calendar,
  Layers,
  Award,
  BookOpen
} from "lucide-react";
import { useTheme } from "./ThemeContext";
import { 
  User as EmployeeUser, 
  Application, 
  EmployeeDocument, 
  DocumentStatus 
} from "../types";
import DocumentPreviewModal from "./DocumentPreviewModal";
import { triggerDocumentDownload } from "../lib/downloadHelper";
import { uploadDocumentToStorage } from "../lib/supabaseStorage";

interface EmployeeProfileProps {
  currentUser: EmployeeUser;
  application: Application | null;
  onRefreshAll: () => void;
}

export default function EmployeeProfile({
  currentUser,
  application,
  onRefreshAll
}: EmployeeProfileProps) {
  // Settings State: Change Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Profile editing state
  const [isEditing, setIsEditing] = useState(false);
  const justSavedRef = React.useRef(false);
  const [editName, setEditName] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editQualification, setEditQualification] = useState("");
  const [editCollege, setEditCollege] = useState("");
  const [editYearOfPassing, setEditYearOfPassing] = useState("");
  const [editCgpa, setEditCgpa] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);

  // feedback toasts
  const [errorStatus, setErrorStatus] = useState("");
  const [successStatus, setSuccessStatus] = useState("");

  // Documents State from backend
  const [docs, setDocs] = useState<EmployeeDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<EmployeeDocument | null>(null);

  // Sync profile editing values with currentUser and application
  useEffect(() => {
    if (!isEditing) {
      if (justSavedRef.current) {
        justSavedRef.current = false;
        return;
      }
      setEditName(currentUser.name || "");
      setEditMobile(currentUser.mobile || "");
      setEditGender(application?.gender || "");
      setEditQualification(application?.highestQualification || "");
      setEditCollege(application?.collegeName || "");
      setEditYearOfPassing(application?.yearOfPassing || "");
      setEditCgpa(application?.percentageOrCgpa || "");
    }
  }, [currentUser, application, isEditing]);

  // Handle saving of updated profile details
  async function handleSaveProfile() {
    setErrorStatus("");
    setSuccessStatus("");

    if (!editName.trim() || !editMobile.trim()) {
      setErrorStatus("Name and Mobile Number fields are mandatory.");
      return;
    }

    setSaveLoading(true);

    const token = localStorage.getItem("agentops_jwt");
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      // 1. Update user credentials (PUT /api/users/:id)
      const userRes = await fetch(`/api/users/${currentUser.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          name: editName,
          mobile: editMobile,
          email: currentUser.email
        })
      });

      if (!userRes.ok) {
        throw new Error("Failed to update user profile details.");
      }

      // 2. Update onboarding application details (POST /api/applications)
      const appRes = await fetch("/api/applications", {
        method: "POST",
        headers,
        body: JSON.stringify({
          employeeId: currentUser.id,
          fullName: editName,
          email: currentUser.email,
          mobile: editMobile,
          gender: editGender,
          highestQualification: editQualification,
          collegeName: editCollege,
          yearOfPassing: editYearOfPassing,
          percentageOrCgpa: editCgpa,
          technicalSkills: application?.technicalSkills || [],
          otherSkills: application?.otherSkills || [],
          status: application?.status || "draft"
        })
      });

      if (!appRes.ok) {
        throw new Error("Failed to update onboarding academic details.");
      }

      // Clear local storage draft backup since everything is persistent on the server database
      localStorage.removeItem(`onboarding_form_${currentUser.id}`);

      justSavedRef.current = true;
      setSuccessStatus("Your profile and academic credentials have been updated successfully!");
      setIsEditing(false);
      onRefreshAll();
    } catch (e: any) {
      setErrorStatus(e?.message || "Failed to update profile details.");
    } finally {
      setSaveLoading(false);
    }
  }

  // Drag over states
  const [activeDragType, setActiveDragType] = useState<string | null>(null);

  // Simulated progress bars per document type for visual polish
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  async function fetchEmployeeDocs() {
    setLoadingDocs(true);
    const token = localStorage.getItem("agentops_jwt");
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    try {
      const res = await fetch(`/api/documents/${currentUser.id}`, { headers });
      if (res.ok) {
        setDocs(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDocs(false);
    }
  }

  useEffect(() => {
    fetchEmployeeDocs();
  }, [currentUser.id]);

  // Handle password modification
  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    setErrorStatus("");
    setSuccessStatus("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorStatus("All password parameters are mandatory.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorStatus("New and confirmed passwords must match.");
      return;
    }

    const token = localStorage.getItem("agentops_jwt");
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`/api/users/${currentUser.id}/change-password`, {
        method: "POST",
        headers,
        body: JSON.stringify({ currentPassword, newPassword })
      });

      if (res.ok) {
        setSuccessStatus("Password changed successfully in secure session vaults.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        onRefreshAll();
      } else {
        const err = await res.json();
        setErrorStatus(err.detail || err.error || "Credentials authorization failed.");
      }
    } catch (e) {
      setErrorStatus("Failed to communicate with authentication servers.");
    }
  }

  // Handle document upload — uploads to Firebase Storage, then saves metadata to backend
  async function handleMockFileUpload(docType: string, file: File) {
    setErrorStatus("");
    setSuccessStatus("");

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(pdf|jpg|jpeg|png|webp|doc|docx)$/i)) {
      setErrorStatus("Only PDF, JPG, PNG, WEBP, DOC, and DOCX files are accepted.");
      return;
    }

    // Max 20MB
    if (file.size > 20 * 1024 * 1024) {
      setErrorStatus("File size must not exceed 20 MB.");
      return;
    }

    // Initial progress
    setUploadProgress(prev => ({ ...prev, [docType]: 5 }));

    try {
      // Step 1: Upload file to Firebase Storage with real progress tracking
      const downloadURL = await uploadDocumentToStorage(
        file,
        currentUser.id,
        docType,
        (percent) => {
          // Scale to 10–90% during upload, leave 90–100% for backend save
          const scaled = Math.round(10 + (percent * 0.8));
          setUploadProgress(prev => ({ ...prev, [docType]: scaled }));
        }
      );

      setUploadProgress(prev => ({ ...prev, [docType]: 92 }));

      // Step 2: Save only metadata + download URL to backend (no base64 blob!)
      const payload = {
        employeeId: currentUser.id,
        type: docType,
        fileName: file.name,
        fileSize: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        // fileContent is now just the Firebase Storage HTTPS URL — tiny metadata
        fileContent: downloadURL
      };

      const token = localStorage.getItem("agentops_jwt");
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/documents", {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      setUploadProgress(prev => ({ ...prev, [docType]: 100 }));

      if (res.ok) {
        const newDoc = await res.json();
        // Optimistically update local docs state
        setDocs(prev => {
          const filtered = prev.filter(d => d.type !== docType);
          return [...filtered, newDoc];
        });
        setSuccessStatus(`"${file.name}" uploaded successfully! Pending admin review.`);
        setTimeout(() => {
          fetchEmployeeDocs();
          onRefreshAll();
        }, 1000);
      } else {
        const err = await res.json();
        setErrorStatus(err.detail || "Failed to save document metadata.");
      }
    } catch (e: any) {
      console.error("[Document Upload]", e);
      if (e.message?.includes("storage/unauthorized")) {
        setErrorStatus("Firebase Storage permission denied. Please contact support.");
      } else if (e.message?.includes("storage/")) {
        setErrorStatus(`Storage error: ${e.message}`);
      } else {
        setErrorStatus(e.message || "Upload failed. Please try again.");
      }
    } finally {
      setTimeout(() => {
        setUploadProgress(prev => {
          const updated = { ...prev };
          delete updated[docType];
          return updated;
        });
      }, 1500);
    }
  }

  // Choose file callbacks
  function onFileChosen(docType: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleMockFileUpload(docType, file);
    }
  }

  // Drag & drop handlers
  function handleDragOver(docType: string, e: React.DragEvent) {
    e.preventDefault();
    setActiveDragType(docType);
  }

  function handleDragLeave() {
    setActiveDragType(null);
  }

  function handleDrop(docType: string, e: React.DragEvent) {
    e.preventDefault();
    setActiveDragType(null);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleMockFileUpload(docType, file);
    }
  }

  function getDocByKind(docType: string) {
    return docs.find(d => d.type === docType);
  }

  // Color mapper matching user instructions
  // Status Badges: Pending (Orange), Approved (Green), Rejected (Red), Uploaded (Blue)
  function getStatusBadge(status: DocumentStatus) {
    switch (status) {
      case DocumentStatus.APPROVED:
        return {
          text: "Approved",
          classes: "bg-emerald-50 text-emerald-700 border border-emerald-250 border-emerald-200"
        };
      case DocumentStatus.REJECTED:
        return {
          text: "Rejected",
          classes: "bg-rose-50 text-rose-705 text-rose-700 border border-rose-250 border-rose-200"
        };
      case DocumentStatus.PENDING:
        return {
          text: "Pending Approval",
          classes: "bg-amber-50 text-amber-705 text-amber-750 text-amber-700 border border-amber-250 border-amber-200"
        };
      default:
        return {
          text: "Uploaded",
          classes: "bg-blue-50 text-blue-700 border border-blue-200"
        };
    }
  }

  const documentTypes = [
    { id: "resume", label: "Mandatory Resume File (PDF / Word)" },
    { id: "aadhaar", label: "Aadhaar Identity Card (PDF / Image)" },
    { id: "pan", label: "PAN Tax Identity Card (PDF / Image)" },
    { id: "photo", label: "Passport-Sized Color photo (PNG / JPG)" },
    { id: "educational", label: "Consolidated Educational Certificates" },
    { id: "experience", label: "Previous Employment Proof Letters (Optional)" }
  ];

  return (
    <div className="space-y-6 animate-fade-in text-left">
      {/* Title block */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Onboarding Profile & Documents</h1>
        <p className="text-sm text-slate-505 text-slate-500 mt-1">
          Review secure personnel credentials, adjust your password parameters, and complete document compliance checklist stages.
        </p>
      </div>

      {successStatus && (
        <div className="p-4 bg-emerald-50 border border-emerald-250 border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 shadow-sm">
          <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          <span>{successStatus}</span>
        </div>
      )}

      {errorStatus && (
        <div className="p-4 bg-rose-50 border border-rose-250 border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-center gap-2 shadow-sm">
          <CheckCircle className="h-5 w-5 text-rose-600 flex-shrink-0 rotate-45" />
          <span>{errorStatus}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
        
        {/* Left column: My Profile Summary view of metadata and details */}
        <div className="lg:col-span-8 space-y-6">
          
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <User className="text-indigo-600 h-5 w-5" />
                <h3 className="text-sm font-bold text-slate-900">Personal & Academic Credentials</h3>
              </div>
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-bold py-1.5 px-3.5 rounded-lg transition duration-150 cursor-pointer text-[11px]"
                >
                  Edit Profile Details
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={saveLoading}
                    onClick={() => setIsEditing(false)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1.5 px-3.5 rounded-lg transition duration-150 cursor-pointer text-[11px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={saveLoading}
                    onClick={handleSaveProfile}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-3.5 rounded-lg transition duration-150 cursor-pointer text-[11px] flex items-center gap-1.5"
                  >
                    {saveLoading ? "Saving..." : "Save Details"}
                  </button>
                </div>
              )}
            </div>

            {isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Personal Details Form */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Personal Details</h4>
                  <div className="space-y-3 p-4 border border-slate-200 bg-slate-50/50 rounded-xl">
                    <div>
                      <label className="text-slate-500 block mb-1 font-semibold text-[10px] uppercase">Full Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1 font-semibold text-[10px] uppercase">Registered Email (Read Only)</label>
                      <input
                        type="text"
                        disabled
                        value={currentUser.email}
                        className="w-full bg-slate-100 border border-slate-205 text-slate-400 rounded-lg p-2 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-1 font-semibold text-[10px] uppercase">Mobile Number</label>
                      <input
                        type="text"
                        value={editMobile}
                        onChange={(e) => setEditMobile(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-1 font-semibold text-[10px] uppercase">Gender</label>
                      <select
                        value={editGender}
                        onChange={(e) => setEditGender(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-905 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                      >
                        <option value="">-- Choose Gender --</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Non-binary">Non-binary</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Graduation Details Form */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Graduation Details</h4>
                  <div className="space-y-3 p-4 border border-slate-200 bg-slate-50/50 rounded-xl">
                    <div>
                      <label className="text-slate-500 block mb-1 font-semibold text-[10px] uppercase">Highest Qualification</label>
                      <input
                        type="text"
                        value={editQualification}
                        onChange={(e) => setEditQualification(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-1 font-semibold text-[10px] uppercase">College / University</label>
                      <input
                        type="text"
                        value={editCollege}
                        onChange={(e) => setEditCollege(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-905 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-slate-550 block mb-1 font-semibold text-[10px] uppercase">Year of Passing</label>
                      <input
                        type="text"
                        value={editYearOfPassing}
                        onChange={(e) => setEditYearOfPassing(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-indigo-700 block mb-1 font-bold text-[10px] uppercase">Score / Grade (GPA/Percentage)</label>
                      <input
                        type="text"
                        value={editCgpa}
                        onChange={(e) => setEditCgpa(e.target.value)}
                        className="w-full bg-indigo-50/50 border border-indigo-205 text-indigo-950 font-bold rounded-lg p-2 focus:ring-1 focus:ring-indigo-505 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Demographics Summary */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Personal Details</h4>
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 font-medium text-slate-700">
                    <p><span className="text-slate-400 block font-normal text-[10px] uppercase">Full Name</span> <span className="text-slate-900">{currentUser.name}</span></p>
                    <p><span className="text-slate-400 block font-normal text-[10px] uppercase">Registered Email</span> <span className="text-slate-900">{currentUser.email}</span></p>
                    <p><span className="text-slate-400 block font-normal text-[10px] uppercase">Mobile Number</span> <span className="text-slate-900">{currentUser.mobile}</span></p>
                    <p><span className="text-slate-400 block font-normal text-[10px] uppercase">Gender</span> <span className="text-slate-900">{application?.gender || "Not declared Yet"}</span></p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Graduation Details</h4>
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 font-medium text-slate-700">
                    <p><span className="text-slate-400 block font-normal text-[10px] uppercase">Highest Qualification</span> <span className="text-slate-900">{application?.highestQualification || "Not declared Yet"}</span></p>
                    <p><span className="text-slate-400 block font-normal text-[10px] uppercase">College / University</span> <span className="text-slate-900">{application?.collegeName || "Not declared Yet"}</span></p>
                    <p><span className="text-slate-400 block font-normal text-[10px] uppercase">Year of Passing</span> <span className="text-slate-900">{application?.yearOfPassing || "Not declared Yet"}</span></p>
                    <p><span className="text-slate-400 block font-normal text-[10px] uppercase font-bold text-indigo-650">Score / Grade</span> <span className="text-indigo-650 text-indigo-600 font-bold">{application?.percentageOrCgpa || "Not declared Yet"}</span></p>
                  </div>
                </div>
              </div>
            )}

            {/* Upload attachments controls */}
            <div className="border-t border-slate-100 pt-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Paperclip className="h-4.5 w-4.5 text-indigo-550 text-indigo-600" /> Compliance Attachment Checklist
                </h3>
                <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">Only uploaded here</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {documentTypes.map((typeObj) => {
                  const existingDoc = getDocByKind(typeObj.id);
                  const isDragging = activeDragType === typeObj.id;
                  const progress = uploadProgress[typeObj.id];

                  return (
                    <div 
                      key={typeObj.id}
                      onDragOver={(e) => handleDragOver(typeObj.id, e)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(typeObj.id, e)}
                      className={`p-5 rounded-2xl border flex flex-col justify-between min-h-[160px] transition-all duration-250 relative bg-white shadow-sm hover:shadow-md ${
                        isDragging 
                          ? "bg-indigo-50/20 border-indigo-400 ring-4 ring-indigo-500/5 scale-[1.01]" 
                          : "border-slate-200"
                      }`}
                    >
                      <div>
                        <h4 className="font-bold text-slate-900 leading-snug">
                          {typeObj.label.split('(')[0]}
                        </h4>
                        <p className="text-[10px] text-slate-505 text-slate-500 italic mt-1 font-medium">
                          {typeObj.id === "experience" ? "Optional compliance file" : "Required verification file"}
                        </p>
                      </div>

                      {/* Display Progress Bar if uploading */}
                      {progress !== undefined && (
                        <div className="mt-4 space-y-1.5">
                          <div className="flex justify-between items-center text-[10px] text-slate-600 font-bold">
                            <span>Uploading compliance file...</span>
                            <span>{progress}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-slate-900 rounded-full transition-all duration-150" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                      )}

                      {/* Doc State / Drag trigger Area */}
                      {progress === undefined && (
                        existingDoc ? (
                          <div className="mt-4">
                            {/* file detail block */}
                            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs">
                              <div className="truncate flex-1 pr-3">
                                <span className="font-bold text-slate-900 block truncate" title={existingDoc.fileName}>
                                  {existingDoc.fileName}
                                </span>
                                <span className="text-[9px] text-slate-400 font-mono block mt-0.5">{existingDoc.fileSize}</span>
                              </div>
                              
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span className={`text-[9px] font-bold uppercase rounded-lg px-2 py-0.5 leading-none ${getStatusBadge(existingDoc.status).classes}`}>
                                  {getStatusBadge(existingDoc.status).text}
                                </span>
                                
                                {/* download button */}
                                <button 
                                  type="button"
                                  onClick={() => triggerDocumentDownload(existingDoc, currentUser.name)}
                                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded transition cursor-pointer"
                                  title="Download Original"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </button>

                                {/* direct view button */}
                                <button
                                  type="button"
                                  onClick={() => setPreviewDoc(existingDoc)}
                                  className="p-1.5 text-indigo-650 hover:text-indigo-950 hover:bg-indigo-550 rounded transition cursor-pointer"
                                  title="View Document directly"
                                >
                                  <Eye className="h-3.5 w-3.5 text-indigo-650" />
                                </button>

                                {/* replace button */}
                                <label className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded transition cursor-pointer" title="Replace Attachment">
                                  <RefreshCw className="h-3.5 w-3.5" />
                                  <input
                                    type="file"
                                    accept=".pdf,.doc,.docx,image/*"
                                    onChange={(e) => onFileChosen(typeObj.id, e)}
                                    className="hidden"
                                  />
                                </label>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 border border-dashed border-slate-300 rounded-xl p-4 bg-slate-50 hover:bg-slate-100/50 transition">
                            <label className="cursor-pointer group flex flex-col items-center justify-center">
                              <Upload className="h-5 w-5 text-slate-400 group-hover:text-indigo-600 transition" />
                              <span className="text-[10px] text-slate-500 font-bold block mt-1">
                                Drag file here or <span className="text-indigo-600 group-hover:underline">Browse</span>
                              </span>
                              <input
                                type="file"
                                accept=".pdf,.doc,.docx,image/*"
                                onChange={(e) => onFileChosen(typeObj.id, e)}
                                className="hidden"
                              />
                            </label>
                          </div>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Update password form */}
        <div className="lg:col-span-4 h-fit text-xs space-y-6">
          <form onSubmit={handlePasswordUpdate} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Key className="text-slate-800 h-5 w-5" />
              <h3 className="text-sm font-bold text-slate-900">Change Account Password</h3>
            </div>

            <div>
              <label className="text-slate-505 text-slate-500 font-semibold block mb-1">Old Account Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-slate-505 text-slate-500 font-semibold block mb-1">New Target Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 characters required"
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-slate-505 text-slate-500 font-semibold block mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-3 rounded-xl transition cursor-pointer shadow-sm mt-2"
            >
              Update Password
            </button>
          </form>
        </div>
      </div>

      {/* Document View overlay */}
      <DocumentPreviewModal 
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        document={previewDoc}
        candidateName={currentUser.name}
      />
    </div>
  );
}
