'use client';

/**
 * SmartLivestock — Authenticated Farmer Attachment Preview Dialog
 * 
 * Secure Document Access Architecture:
 * ------------------------------------
 * Farmer registration attachments (Government IDs, RSBSA certificates, etc.)
 * are sensitive personal records and are protected by backend Django authentication
 * (GET /api/users/documents/<id>/view/).
 * 
 * Because standard <img>, <iframe>, and raw <a> navigation tags do not attach
 * the Bearer JWT authorization header, this component retrieves the document
 * via the authenticated axios client with `responseType: 'blob'`, creates a local
 * Object URL (Blob URL), and renders it safely in an image viewer or PDF iframe.
 * 
 * Memory is reclaimed cleanly via `URL.revokeObjectURL` on unmount / document change.
 */

import React, { useState, useEffect } from 'react';
import api from '@/lib/axios';
import { UserDocumentItem } from './user-management';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ExternalLink,
  Download,
  AlertTriangle,
  Loader2,
  FileText,
  RefreshCw,
  Eye,
  ShieldCheck,
} from 'lucide-react';

interface DocumentPreviewDialogProps {
  document: UserDocumentItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getDocTypeLabel: (doc: UserDocumentItem) => string;
  getDocStatusBadge: (status: string) => React.ReactNode;
}

export function DocumentPreviewDialog({
  document: doc,
  open,
  onOpenChange,
  getDocTypeLabel,
  getDocStatusBadge,
}: DocumentPreviewDialogProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [contentType, setContentType] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState<number>(0);

  useEffect(() => {
    if (!open || !doc) {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
      setContentType(null);
      setErrorMessage(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    let createdUrl: string | null = null;

    const fetchDocument = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const response = await api.get(`/api/users/documents/${doc.id}/view/`, {
          responseType: 'blob',
        });

        if (!isMounted) return;

        const mime = response.headers['content-type'] || response.data?.type || 'application/octet-stream';
        const url = URL.createObjectURL(response.data);
        createdUrl = url;

        setBlobUrl(url);
        setContentType(mime);
        setIsLoading(false);
      } catch (err: any) {
        if (!isMounted) return;
        console.error('Failed to load document preview:', err);

        const status = err?.response?.status;
        if (status === 401) {
          setErrorMessage('Authentication credentials were not provided.');
        } else if (status === 403) {
          setErrorMessage('You are not authorized to view this document.');
        } else if (status === 404) {
          setErrorMessage('This document is no longer available.');
        } else {
          setErrorMessage('Unable to load the document. Please try again.');
        }
        setIsLoading(false);
      }
    };

    fetchDocument();

    return () => {
      isMounted = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [open, doc?.id, reloadTrigger]);

  const handleOpenInNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownload = () => {
    if (!blobUrl || !doc) return;
    const a = window.document.createElement('a');
    a.href = blobUrl;
    a.download = doc.file_name || `document-${doc.id}`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
  };

  if (!doc) return null;

  const isPdfDoc =
    Boolean(contentType?.toLowerCase().includes('pdf')) ||
    Boolean(doc.file_name?.toLowerCase().endsWith('.pdf')) ||
    Boolean(doc.file_url?.toLowerCase().endsWith('.pdf'));

  const isImageDoc =
    Boolean(contentType?.toLowerCase().startsWith('image/')) ||
    /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(doc.file_name || '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100vw-1.5rem)] sm:w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl bg-white border-slate-200 shadow-2xl">
        <DialogHeader className="space-y-1.5">
          <div className="flex items-start justify-between gap-2 pr-6">
            <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 leading-tight break-words">
              {getDocTypeLabel(doc)}
            </DialogTitle>
            <div className="shrink-0">{getDocStatusBadge(doc.verification_status)}</div>
          </div>
          <p className="text-xs text-slate-500 break-all">
            {doc.file_name || 'Attachment'} • Uploaded: {new Date(doc.uploaded_at).toLocaleString()}
          </p>
          {doc.approved_by_name && doc.verification_status === 'APPROVED' && (
            <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
              <ShieldCheck className="size-3.5" /> Verified by: {doc.approved_by_name}
            </p>
          )}
        </DialogHeader>

        {/* Viewer Content Area */}
        <div className="mt-3 rounded-xl overflow-hidden bg-slate-50 border border-slate-200 flex flex-col items-center justify-center min-h-[320px] max-h-[68vh]">
          {isLoading ? (
            <div className="p-8 flex flex-col items-center justify-center text-center space-y-2">
              <Loader2 className="size-8 animate-spin text-emerald-600" />
              <p className="text-sm font-semibold text-slate-700">Loading document...</p>
              <p className="text-xs text-slate-400">Fetching authenticated attachment from secure storage</p>
            </div>
          ) : errorMessage ? (
            <div className="p-6 flex flex-col items-center justify-center text-center space-y-3 max-w-md">
              <div className="size-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="size-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-rose-900">{errorMessage}</p>
                <p className="text-xs text-slate-500 mt-1">
                  If this issue persists, verify your administrative session or network connection.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReloadTrigger((prev) => prev + 1)}
                className="gap-1.5 text-xs text-slate-700 hover:bg-slate-100"
              >
                <RefreshCw className="size-3.5" /> Retry Loading
              </Button>
            </div>
          ) : blobUrl ? (
            isPdfDoc ? (
              <iframe
                src={blobUrl}
                className="w-full h-[65vh] border-0 rounded-xl"
                title={doc.file_name || 'Document PDF Viewer'}
              />
            ) : isImageDoc ? (
              <div className="w-full h-full p-2 flex items-center justify-center overflow-auto">
                <img
                  src={blobUrl}
                  alt={getDocTypeLabel(doc)}
                  className="max-h-[62vh] w-auto max-w-full object-contain rounded-lg shadow-xs"
                />
              </div>
            ) : (
              <div className="p-8 flex flex-col items-center justify-center text-center space-y-3">
                <div className="size-14 rounded-2xl bg-slate-200 text-slate-700 flex items-center justify-center">
                  <FileText className="size-7" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{doc.file_name || 'Attachment'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Preview is not available for this file type.</p>
                </div>
                <Button onClick={handleDownload} size="sm" className="gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white">
                  <Download className="size-4" /> Download File
                </Button>
              </div>
            )
          ) : null}
        </div>

        {/* Review Remarks Banner */}
        {doc.review_remarks && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-0.5">
            <p className="font-bold flex items-center gap-1">
              <AlertTriangle className="size-3.5 text-rose-600" /> Review Remarks:
            </p>
            <p className="pl-4.5 break-words">{doc.review_remarks}</p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap gap-2">
            {blobUrl && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleOpenInNewTab}
                  className="gap-1.5 text-xs text-slate-700 hover:text-slate-900"
                >
                  <ExternalLink className="size-3.5" /> Open in New Tab
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="gap-1.5 text-xs text-slate-700 hover:text-slate-900"
                >
                  <Download className="size-3.5" /> Download
                </Button>
              </>
            )}
          </div>

          <Button
            type="button"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="bg-slate-900 text-white hover:bg-slate-800 text-xs px-4"
          >
            Close Preview
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
