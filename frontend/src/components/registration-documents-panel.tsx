"use client";

import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck2,
  FileText,
  FileUp,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentPreviewDialog } from "@/app/(admin)/user-management/document-preview-dialog";
import {
  establishDocumentRevisionSession,
  fetchOwnRegistrationDocuments,
  formatDocumentDisplayName,
  GOVERNMENT_ID_TYPE_OPTIONS,
  hasRegistrationDocumentAuth,
  resubmitRegistrationDocument,
  type OwnRegistrationDocumentsResponse,
  type RegistrationDocumentItem,
} from "@/lib/registration-documents";

interface RegistrationDocumentsPanelProps {
  variant?: "pending" | "profile";
  onDocumentsUpdated?: (data: OwnRegistrationDocumentsResponse) => void;
}

export function RegistrationDocumentsPanel({
  variant = "pending",
  onDocumentsUpdated,
}: RegistrationDocumentsPanelProps) {
  const queryClient = useQueryClient();
  const [hasAuth, setHasAuth] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessionError, setSessionError] = useState("");

  const [selectedFiles, setSelectedFiles] = useState<Record<number, File | null>>({});
  const [selectedIdTypes, setSelectedIdTypes] = useState<Record<number, string>>({});
  const [previewDoc, setPreviewDoc] = useState<RegistrationDocumentItem | null>(null);

  useEffect(() => {
    setHasAuth(hasRegistrationDocumentAuth());
    try {
      const remembered = localStorage.getItem("smartlivestock_remember_email");
      if (remembered) setEmail(remembered);
    } catch {
      // Ignore storage access errors
    }
  }, []);

  const docsQuery = useQuery({
    queryKey: ["own-registration-documents"],
    queryFn: fetchOwnRegistrationDocuments,
    enabled: hasAuth,
    retry: false,
  });

  useEffect(() => {
    if (docsQuery.data && onDocumentsUpdated) {
      onDocumentsUpdated(docsQuery.data);
    }
  }, [docsQuery.data, onDocumentsUpdated]);

  const sessionMutation = useMutation({
    mutationFn: () => establishDocumentRevisionSession(email, password),
    onSuccess: (data) => {
      setSessionError("");
      setPassword("");
      setHasAuth(true);
      queryClient.setQueryData(["own-registration-documents"], data);
      toast.success("Application documents loaded.");
    },
    onError: (err: unknown) => {
      const detail = isAxiosError<{ detail?: string }>(err)
        ? err.response?.data?.detail
        : undefined;
      setSessionError(
        detail || "Could not verify credentials. Please check your email and password."
      );
    },
  });

  const resubmitMutation = useMutation({
    mutationFn: resubmitRegistrationDocument,
    onSuccess: (updatedDoc) => {
      setSelectedFiles((prev) => ({ ...prev, [updatedDoc.id]: null }));
      queryClient.setQueryData<OwnRegistrationDocumentsResponse | undefined>(
        ["own-registration-documents"],
        (old) => {
          if (!old) return old;
          const nextDocs = old.documents.map((d) =>
            d.id === updatedDoc.id ? updatedDoc : d
          );
          const stillNeedsRevision = nextDocs.some(
            (d) => d.verification_status === "SUBJECT_TO_REVISION"
          );
          return {
            ...old,
            account_status:
              !stillNeedsRevision && old.account_status === "SUBJECT_TO_REVISION"
                ? "PENDING"
                : old.account_status,
            documents: nextDocs,
          };
        }
      );
      void queryClient.invalidateQueries({ queryKey: ["own-registration-documents"] });
      toast.success("Replacement document uploaded!", {
        description:
          "Your document has been returned to the MAO review queue for verification.",
      });
    },
    onError: (err: unknown) => {
      const data = isAxiosError<Record<string, unknown>>(err)
        ? err.response?.data
        : undefined;
      let msg = "Failed to upload replacement document.";
      if (data && typeof data === "object") {
        if (typeof data.detail === "string") {
          msg = data.detail;
        } else {
          const strings = Object.values(data)
            .flat()
            .filter((v): v is string => typeof v === "string");
          if (strings.length > 0) msg = strings.join(" ");
        }
      }
      toast.error(msg);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-black text-[10px] uppercase tracking-wider px-2.5 py-0.5 gap-1">
            <CheckCircle2 className="size-3" /> Verified by MAO
          </Badge>
        );
      case "SUBJECT_TO_REVISION":
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-black text-[10px] uppercase tracking-wider px-2.5 py-0.5 gap-1">
            <AlertTriangle className="size-3" /> Subject to Revision
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-black text-[10px] uppercase tracking-wider px-2.5 py-0.5 gap-1">
            <Clock className="size-3" /> In MAO Review Queue
          </Badge>
        );
    }
  };

  // Show credential lookup if no active session or if the session expired (401)
  const needsCredentials =
    !hasAuth ||
    (docsQuery.isError &&
      isAxiosError(docsQuery.error) &&
      docsQuery.error.response?.status === 401);

  if (needsCredentials) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
            <FileUp className="size-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-slate-900">
              Check Registration Documents &amp; MAO Revision Requests
            </h3>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              Did MAO request a correction to your Government ID or RSBSA document? Sign in with your registered email and password below to view MAO&apos;s remarks and upload a replacement file.
            </p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!email.trim() || !password) return;
            sessionMutation.mutate();
          }}
          className="space-y-3 bg-white p-3.5 sm:p-4 rounded-xl border border-amber-200/80 shadow-2xs"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="revision-lookup-email"
                className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 block"
              >
                Registered Email
              </label>
              <div className="relative">
                <Mail className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="revision-lookup-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="farmer@example.com"
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#2D5A27] focus:bg-white"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="revision-lookup-password"
                className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 block"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="revision-lookup-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#2D5A27] focus:bg-white"
                />
              </div>
            </div>
          </div>

          {sessionError && (
            <p role="alert" className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {sessionError}
            </p>
          )}

          <Button
            type="submit"
            disabled={sessionMutation.isPending}
            className="w-full sm:w-auto h-10 px-4 rounded-xl bg-[#2D5A27] hover:bg-[#23471f] text-white text-xs font-black cursor-pointer"
          >
            {sessionMutation.isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
                Checking Documents...
              </>
            ) : (
              <>
                <FileCheck2 className="size-3.5 mr-1.5" />
                Load My Registration Documents
              </>
            )}
          </Button>
        </form>
      </div>
    );
  }

  if (docsQuery.isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 flex items-center gap-3 text-slate-600">
        <Loader2 className="size-5 animate-spin text-[#2D5A27] shrink-0" />
        <span className="text-xs font-bold">Loading your submitted registration documents...</span>
      </div>
    );
  }

  const documents = docsQuery.data?.documents || [];
  const revisionDocs = documents.filter(
    (doc) => doc.verification_status === "SUBJECT_TO_REVISION"
  );

  return (
    <div className="space-y-4">
      {/* Banner if any document is marked Subject to Revision */}
      {revisionDocs.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-950 space-y-2 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 mt-0.5">
              <ShieldAlert className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-sm font-black text-rose-950">
                  Action Required: {revisionDocs.length}{" "}
                  {revisionDocs.length === 1 ? "Document Needs" : "Documents Need"} Revision
                </h3>
                <span className="text-[10px] font-mono font-black uppercase tracking-wider bg-rose-200/80 text-rose-900 px-2 py-0.5 rounded-md">
                  MAO Desk Request
                </span>
              </div>
              <p className="text-xs text-rose-900/90 mt-1 leading-relaxed font-medium">
                The Municipal Agriculture Office (MAO) reviewed your registration and requested a replacement for the highlighted {revisionDocs.length === 1 ? "document" : "documents"} below. Upload a clear replacement file to return it to MAO&apos;s approval queue.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Documents List Container */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5 space-y-3.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-[#2D5A27] shrink-0" />
            <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
              Submitted Registration Documents ({documents.length})
            </h3>
          </div>

          <button
            type="button"
            onClick={() => void docsQuery.refetch()}
            disabled={docsQuery.isFetching}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 hover:text-[#2D5A27] px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-emerald-50/50 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`size-3 ${docsQuery.isFetching ? "animate-spin text-emerald-600" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="p-4 rounded-xl bg-white border border-slate-200/80 text-xs text-slate-500 font-medium">
            No registration document files are attached to this account yet.
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => {
              const isRevision = doc.verification_status === "SUBJECT_TO_REVISION";
              const isRSBSA = doc.document_type === "RSBSA";
              const selectedFile = selectedFiles[doc.id] || null;
              const selectedType = selectedIdTypes[doc.id] || doc.document_type;
              const isUploadingThis =
                resubmitMutation.isPending &&
                resubmitMutation.variables?.documentId === doc.id;

              return (
                <div
                  key={doc.id}
                  className={`rounded-2xl border p-4 transition-all space-y-3 ${
                    isRevision
                      ? "bg-white border-rose-300 ring-2 ring-rose-500/15 shadow-sm"
                      : doc.verification_status === "APPROVED"
                      ? "bg-white border-emerald-200/90"
                      : "bg-white border-slate-200/90"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-black text-slate-900">
                          {formatDocumentDisplayName(doc)}
                        </span>
                        {getStatusBadge(doc.verification_status)}
                      </div>
                      <p className="text-[11px] text-slate-500 break-all font-medium">
                        {doc.file_name || "Submitted file"} • Uploaded{" "}
                        {new Date(doc.uploaded_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewDoc(doc)}
                        className="h-8 px-3 rounded-xl text-xs font-bold border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 cursor-pointer gap-1.5"
                      >
                        <Eye className="size-3.5 text-[#2D5A27]" />
                        <span>View File</span>
                      </Button>
                    </div>
                  </div>

                  {/* MAO Reason Callout */}
                  {doc.review_remarks && (
                    <div
                      className={`p-3 rounded-xl border text-xs space-y-1 ${
                        isRevision
                          ? "bg-rose-50/90 border-rose-200 text-rose-950"
                          : "bg-slate-50 border-slate-200 text-slate-700"
                      }`}
                    >
                      <p className="font-black uppercase tracking-wider text-[10px] flex items-center gap-1.5 text-rose-800">
                        <AlertTriangle className="size-3.5 text-rose-600 shrink-0" />
                        <span>MAO Revision Reason:</span>
                      </p>
                      <p className="font-semibold leading-relaxed break-words pl-5">
                        {doc.review_remarks}
                      </p>
                    </div>
                  )}

                  {/* Replacement Upload Form when marked SUBJECT_TO_REVISION */}
                  {isRevision && (
                    <div className="pt-2 border-t border-rose-100 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {!isRSBSA && (
                          <div className="space-y-1">
                            <label
                              htmlFor={`doc-type-${doc.id}`}
                              className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 block"
                            >
                              Government ID Type
                            </label>
                            <select
                              id={`doc-type-${doc.id}`}
                              value={selectedType}
                              onChange={(e) =>
                                setSelectedIdTypes((prev) => ({
                                  ...prev,
                                  [doc.id]: e.target.value,
                                }))
                              }
                              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#2D5A27] focus:bg-white"
                            >
                              {GOVERNMENT_ID_TYPE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className={isRSBSA ? "sm:col-span-2 space-y-1" : "space-y-1"}>
                          <label
                            htmlFor={`doc-file-${doc.id}`}
                            className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 block"
                          >
                            Upload Replacement File (PDF, JPG, PNG, WEBP • Max 10MB)
                          </label>
                          <input
                            id={`doc-file-${doc.id}`}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp,application/pdf"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              setSelectedFiles((prev) => ({
                                ...prev,
                                [doc.id]: file,
                              }));
                            }}
                            className="w-full text-xs text-slate-700 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-emerald-50 file:text-[#2D5A27] hover:file:bg-emerald-100 file:cursor-pointer cursor-pointer border border-slate-200 rounded-xl p-1 bg-slate-50/60"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                        <p className="text-[11px] text-slate-500 font-medium">
                          {selectedFile
                            ? `Selected: ${selectedFile.name} (${(
                                selectedFile.size /
                                (1024 * 1024)
                              ).toFixed(2)} MB)`
                            : "Select a clear, readable photo or PDF to replace this document."}
                        </p>

                        <Button
                          type="button"
                          disabled={!selectedFile || isUploadingThis}
                          onClick={() => {
                            if (!selectedFile) return;
                            resubmitMutation.mutate({
                              documentId: doc.id,
                              file: selectedFile,
                              documentType: !isRSBSA ? selectedType : undefined,
                            });
                          }}
                          className="w-full sm:w-auto h-10 px-4 rounded-xl bg-[#2D5A27] hover:bg-[#23471f] text-white text-xs font-black shadow-sm cursor-pointer gap-1.5"
                        >
                          {isUploadingThis ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" />
                              <span>Uploading Replacement...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="size-3.5" />
                              <span>Submit Replacement to MAO</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <DocumentPreviewDialog
        document={previewDoc}
        open={Boolean(previewDoc)}
        onOpenChange={(open) => {
          if (!open) setPreviewDoc(null);
        }}
        getDocTypeLabel={(doc) => formatDocumentDisplayName(doc)}
        getDocStatusBadge={(status) => getStatusBadge(status)}
      />
    </div>
  );
}
