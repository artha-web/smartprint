"use client";

import { FormEvent, useState, useRef, useEffect } from "react";
import Script from "next/script";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Image as ImageIcon,
  FileCode,
  Eye,
  Trash2,
  Camera,
  ShieldCheck,
} from "lucide-react";
import { validateFileInstant } from "@/lib/client-validation";
import { uploadFiles } from "@/lib/uploadthing";

interface UploadedDoc {
  id: string;
  customerName: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export default function CustomerUpload({
  shopCode,
  shopName,
}: {
  shopCode: string;
  shopName: string;
}) {
  const [customerName, setCustomerName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [previewFile, setPreviewFile] = useState<{ file: File; url: string; isPdf: boolean; isImage: boolean } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const MAX_MB = 20;
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  // Cleanup object URLs when preview changes
  useEffect(() => {
    return () => {
      if (previewFile?.url) {
        URL.revokeObjectURL(previewFile.url);
      }
    };
  }, [previewFile]);

  // Turnstile callback
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as unknown as { onTurnstileSuccess?: (token: string) => void }).onTurnstileSuccess = (token: string) => {
        setTurnstileToken(token);
      };
    }
  }, []);

  async function handleFilesChange(selectedList: FileList | null) {
    setError("");
    if (!selectedList || selectedList.length === 0) return;

    const validExts = [".pdf", ".docx", ".doc", ".png", ".jpg", ".jpeg", ".webp", ".txt"];
    const newFiles: File[] = [];

    for (let i = 0; i < selectedList.length; i++) {
      const file = selectedList[i];
      if (file.size > MAX_MB * 1024 * 1024) {
        setError(`"${file.name}" exceeds ${MAX_MB} MB. Skipping oversized file.`);
        continue;
      }

      const ext = file.name.toLowerCase();
      const hasValidExt = validExts.some((e) => ext.endsWith(e));
      if (!hasValidExt) {
        setError(`"${file.name}" is not a supported file type (PDF, Word, Images, TXT).`);
        continue;
      }

      // Feature 1: Instant 0-Second Magic Bytes Validation (Fail-Fast in <1ms)
      const instantCheck = await validateFileInstant(file);
      if (!instantCheck.valid) {
        setError(instantCheck.error || `"${file.name}" is corrupted or has an invalid header.`);
        continue;
      }

      newFiles.push(file);
    }

    if (newFiles.length > 0) {
      setFiles((prev) => [...prev, ...newFiles]);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFilesChange(e.dataTransfer.files);
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (previewFile && files[index] === previewFile.file) {
      setPreviewFile(null);
    }
  }

  function openPreview(file: File) {
    if (previewFile?.url) {
      URL.revokeObjectURL(previewFile.url);
    }

    const ext = file.name.toLowerCase();
    const isPdf = ext.endsWith(".pdf") || file.type === "application/pdf";
    const isImage = file.type.startsWith("image/") || [".png", ".jpg", ".jpeg", ".webp"].some((e) => ext.endsWith(e));
    const url = URL.createObjectURL(file);

    setPreviewFile({ file, url, isPdf, isImage });
  }

  function closePreview() {
    if (previewFile?.url) {
      URL.revokeObjectURL(previewFile.url);
    }
    setPreviewFile(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    const trimmedName = customerName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setError("Please enter your full name.");
      return;
    }

    if (files.length === 0) {
      setError("Please select at least one document to upload.");
      return;
    }

    setBusy(true);
    setUploadProgress(10);

    try {
      // Step 1: Instant fail-fast validation before sending any data
      for (const file of files) {
        const check = await validateFileInstant(file);
        if (!check.valid) {
          throw new Error(check.error || `"${file.name}" failed verification.`);
        }
      }

      setUploadProgress(20);

      // Step 2: Request temporary direct upload link from server (~20ms)
      const presignRes = await fetch(`/api/upload/${shopCode}/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: trimmedName,
          turnstileToken,
          files: files.map((f) => ({
            name: f.name,
            size: f.size,
            type: f.type || "application/octet-stream",
          })),
        }),
      });

      const presignData = await presignRes.json();
      if (!presignRes.ok) {
        throw new Error(presignData.error || "Failed to initialize direct upload.");
      }

      // Step 3: Direct-to-Storage Single-Hop Uploads (Bypassing Vercel 4.5 MB request body limit)
      if (presignData.directMode === "r2" && Array.isArray(presignData.files)) {
        // Direct Single Hop from phone to Cloudflare R2 / S3
        const uploadedDocsList = [];
        const total = files.length;

        for (let i = 0; i < total; i++) {
          const file = files[i];
          const fileMeta = presignData.files[i];

          const putRes = await fetch(fileMeta.uploadUrl, {
            method: "PUT",
            headers: {
              "Content-Type": fileMeta.mimeType || file.type || "application/octet-stream",
            },
            body: file,
          });

          if (!putRes.ok) {
            throw new Error(`Direct upload failed for "${file.name}" (Status ${putRes.status}).`);
          }

          uploadedDocsList.push({
            id: fileMeta.docId,
            fileName: fileMeta.fileName,
            storageKey: fileMeta.storageKey,
            mimeType: fileMeta.mimeType,
            fileSize: file.size,
          });

          setUploadProgress(20 + Math.round(((i + 1) / total) * 60));
        }

        // Finalize metadata registration in database (<10ms)
        setUploadProgress(90);
        const compRes = await fetch(`/api/upload/${shopCode}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerName: trimmedName,
            documents: uploadedDocsList,
          }),
        });

        const compData = await compRes.json();
        if (!compRes.ok) throw new Error(compData.error || "Failed to finalize upload.");

        setUploadProgress(100);
        setUploadedDocs(compData.documents || uploadedDocsList);
      } else if (presignData.directMode === "uploadthing") {
        // Direct Single Hop from phone to UploadThing CDN
        setUploadProgress(30);
        const utResponse = await uploadFiles("docUploader", {
          files,
          onUploadProgress: ({ totalProgress }) => {
            setUploadProgress(30 + Math.round(totalProgress * 0.5));
          },
        });

        if (!utResponse || utResponse.length === 0) {
          throw new Error("Direct upload to storage failed. Please try again.");
        }

        setUploadProgress(85);
        const documentsToRegister = utResponse.map((res, idx) => ({
          fileName: files[idx]?.name || res.name,
          storageKey: `uploadthing:${res.key}`,
          mimeType: files[idx]?.type || "application/octet-stream",
          fileSize: res.size || files[idx]?.size || 0,
        }));

        const compRes = await fetch(`/api/upload/${shopCode}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerName: trimmedName,
            documents: documentsToRegister,
          }),
        });

        const compData = await compRes.json();
        if (!compRes.ok) throw new Error(compData.error || "Failed to finalize upload.");

        setUploadProgress(100);
        setUploadedDocs(compData.documents);
      } else {
        // Local fallback: multipart upload
        const formData = new FormData();
        formData.append("customerName", trimmedName);
        if (turnstileToken) {
          formData.append("turnstileToken", turnstileToken);
        }
        files.forEach((file) => {
          formData.append("files", file);
        });

        const progressTimer = setInterval(() => {
          setUploadProgress((p) => (p < 85 ? p + 15 : p));
        }, 250);

        const res = await fetch(`/api/upload/${shopCode}`, {
          method: "POST",
          body: formData,
        });

        clearInterval(progressTimer);
        setUploadProgress(100);

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to upload documents. Please try again.");
        }

        setUploadedDocs(data.documents || [data.document]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function handleReset() {
    setFiles([]);
    setUploadedDocs([]);
    setError("");
    setPreviewFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getFileIcon(filename: string) {
    const ext = filename.toLowerCase();
    if (ext.endsWith(".pdf")) return <FileText size={20} color="#dc2626" />;
    if (ext.endsWith(".docx") || ext.endsWith(".doc")) return <FileCode size={20} color="#2563eb" />;
    if (ext.endsWith(".png") || ext.endsWith(".jpg") || ext.endsWith(".jpeg") || ext.endsWith(".webp"))
      return <ImageIcon size={20} color="#059669" />;
    return <FileText size={20} color="#4b5563" />;
  }

  // Upload Complete Confirmation View
  if (uploadedDocs.length > 0) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "36px 24px" }}>
        <div style={{ display: "inline-flex", padding: 16, borderRadius: "50%", background: "#ecfdf3", color: "#027a48", marginBottom: 16 }}>
          <CheckCircle2 size={48} />
        </div>

        <h2 style={{ fontSize: 24, marginBottom: 8, color: "#101828" }}>
          {uploadedDocs.length === 1 ? "Document Uploaded Successfully!" : `${uploadedDocs.length} Documents Uploaded Successfully!`}
        </h2>
        <p className="muted" style={{ marginBottom: 24, fontSize: 15 }}>
          Your files have been sent to <strong>{shopName}</strong>.
        </p>

        <div style={{ background: "#f8fafc", border: "2px dashed #cbd5e1", borderRadius: 14, padding: "20px 16px", maxWidth: 460, margin: "0 auto 24px" }}>
          <span style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 1, color: "#64748b", fontWeight: 700 }}>
            Tell the shopkeeper this name:
          </span>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", marginTop: 6, letterSpacing: -0.5 }}>
            {uploadedDocs[0].customerName}
          </div>
        </div>

        {/* Uploaded files summary */}
        <div style={{ maxWidth: 480, margin: "0 auto 28px", textAlign: "left", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 18px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 10 }}>
            Uploaded Documents ({uploadedDocs.length})
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {uploadedDocs.map((doc) => (
              <div key={doc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
                  {getFileIcon(doc.fileName)}
                  <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {doc.fileName}
                  </span>
                </div>
                <span className="muted" style={{ fontSize: 12, flexShrink: 0, marginLeft: 12 }}>
                  {formatSize(doc.fileSize)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button type="button" className="btn btn-secondary" onClick={handleReset} style={{ margin: "0 auto" }}>
          <RefreshCw size={16} />
          Upload More Documents
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      {turnstileSiteKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="lazyOnload"
        />
      )}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="customerName">
            Your Full Name <span style={{ color: "#e11d48" }}>*</span>
          </label>
          <input
            id="customerName"
            type="text"
            required
            placeholder="e.g. Rahul Sharma"
            value={customerName}
            maxLength={80}
            onChange={(e) => setCustomerName(e.target.value)}
            disabled={busy}
            autoFocus
          />
          <span className="muted" style={{ fontSize: 12 }}>
            The shopkeeper will search this name on their computer to print your files.
          </span>
        </div>

        {/* Action Buttons: Choose from Files or Scan Document */}
        <div className="field">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <label style={{ margin: 0 }}>
              Select Documents <span style={{ color: "#e11d48" }}>*</span>
            </label>

            {/* Direct Phone Camera / Document Scanner Mode */}
            <button
              type="button"
              className="btn-camera"
              onClick={() => cameraInputRef.current?.click()}
              disabled={busy}
              title="Take a photo of a document or ID card"
            >
              <Camera size={15} />
              Take Photo / Scan
            </button>
          </div>

          {/* Hidden Camera Input with capture="environment" for rear camera */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            disabled={busy}
            onChange={(e) => handleFilesChange(e.target.files)}
          />

          {/* Drag & Drop Upload Zone */}
          <div
            className={`dropzone ${isDragging ? "dragging" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{ cursor: busy ? "not-allowed" : "pointer" }}
          >
            <Upload size={34} color={isDragging ? "#1d4ed8" : "#2563eb"} style={{ marginBottom: 8 }} />
            <strong>{isDragging ? "Drop your files here!" : "Click or drag documents here"}</strong>
            <span className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Supports PDF, Word (.docx), JPG, PNG, WebP, TXT (up to 20 MB each)
            </span>
            <span style={{ fontSize: 12, color: "#2563eb", marginTop: 4, fontWeight: 600 }}>
              You can select multiple files at once
            </span>
            <input
              id="docFiles"
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.webp,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*,text/plain"
              style={{ display: "none" }}
              disabled={busy}
              onChange={(e) => handleFilesChange(e.target.files)}
            />
          </div>
        </div>

        {/* Selected files list with PREVIEW BEFORE UPLOAD and REMOVE actions */}
        {files.length > 0 && (
          <div style={{ margin: "20px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
                Selected Files ({files.length}):
              </div>
              <span className="muted" style={{ fontSize: 12 }}>
                Preview before uploading
              </span>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {files.map((f, idx) => (
                <div
                  key={`${f.name}-${idx}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: "10px 14px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, overflow: "hidden" }}>
                    {getFileIcon(f.name)}
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }}>
                        {f.name}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                        <span className="muted" style={{ fontSize: 12 }}>
                          {formatSize(f.size)}
                        </span>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            fontSize: 11,
                            color: "#059669",
                            background: "#ecfdf3",
                            padding: "1px 6px",
                            borderRadius: 4,
                            fontWeight: 600,
                          }}
                          title="Validated via instant magic bytes inspect in 0s"
                        >
                          <ShieldCheck size={12} />
                          0s Validated
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {/* Preview action */}
                    <button
                      type="button"
                      onClick={() => openPreview(f)}
                      className="btn btn-secondary"
                      style={{ minHeight: 32, padding: "0 10px", fontSize: 12 }}
                      title="Preview document"
                    >
                      <Eye size={14} />
                      Preview
                    </button>

                    {/* Remove action */}
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      style={{
                        border: "1px solid #fee2e2",
                        background: "#fff",
                        color: "#ef4444",
                        cursor: "pointer",
                        padding: "6px 8px",
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                      }}
                      title="Remove file"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cloudflare Turnstile anti-bot challenge widget (if configured) */}
        {turnstileSiteKey && (
          <div style={{ margin: "14px 0", display: "flex", justifyContent: "center" }}>
            <div
              className="cf-turnstile"
              data-sitekey={turnstileSiteKey}
              data-callback="onTurnstileSuccess"
              data-theme="light"
            />
          </div>
        )}

        {/* Upload Progress Bar */}
        {busy && (
          <div style={{ margin: "18px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, fontWeight: 600, color: "#2563eb" }}>
              <span>Uploading documents...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div style={{ width: "100%", height: 8, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
              <div
                style={{
                  width: `${uploadProgress}%`,
                  height: "100%",
                  background: "#2563eb",
                  transition: "width 0.3s ease-in-out",
                }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="notice error" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          className="btn btn-full"
          disabled={busy || files.length === 0 || !customerName.trim()}
          style={{ marginTop: 22, fontSize: 16 }}
        >
          {busy
            ? `Uploading ${files.length} document${files.length > 1 ? "s" : ""}...`
            : `Upload & Send ${files.length ? `${files.length} Document${files.length > 1 ? "s" : ""}` : "Documents"}`}
        </button>
      </form>

      {/* Modal: Preview Before Upload */}
      {previewFile && (
        <div className="preview-modal-overlay" onClick={closePreview}>
          <div className="preview-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="preview-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
                {getFileIcon(previewFile.file.name)}
                <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {previewFile.file.name}
                </div>
              </div>
              <button
                type="button"
                onClick={closePreview}
                style={{ border: 0, background: "transparent", color: "#64748b", cursor: "pointer", padding: 6 }}
              >
                ✕
              </button>
            </div>

            <div className="preview-modal-body">
              {previewFile.isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewFile.url}
                  alt={previewFile.file.name}
                  style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: 8 }}
                />
              ) : previewFile.isPdf ? (
                <iframe
                  src={`${previewFile.url}#toolbar=0`}
                  title={previewFile.file.name}
                  style={{ width: "100%", height: "68vh", border: 0, borderRadius: 8 }}
                />
              ) : (
                <div style={{ padding: 48, textAlign: "center" }}>
                  <FileCode size={48} color="#2563eb" style={{ margin: "0 auto 16px" }} />
                  <h3 style={{ margin: "0 0 8px" }}>{previewFile.file.name}</h3>
                  <p className="muted" style={{ margin: 0, fontSize: 14 }}>
                    Ready for upload ({formatSize(previewFile.file.size)}).
                  </p>
                </div>
              )}
            </div>

            <div className="preview-modal-footer">
              <span className="muted" style={{ fontSize: 13 }}>
                Size: {formatSize(previewFile.file.size)}
              </span>
              <button type="button" className="btn btn-secondary" onClick={closePreview} style={{ minHeight: 36 }}>
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .btn-camera {
          border: 1px solid #cbd5e1;
          background: #f8fafc;
          color: #1e293b;
          font-size: 12px;
          font-weight: 700;
          padding: 6px 10px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }
        .btn-camera:hover {
          background: #f1f5f9;
          border-color: #94a3b8;
        }
        .dragging {
          border-color: #2563eb !important;
          background: #eff6ff !important;
        }
        .preview-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 20px;
        }
        .preview-modal-box {
          background: white;
          border-radius: 16px;
          max-width: 760px;
          width: 100%;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          max-height: 90vh;
        }
        .preview-modal-header {
          padding: 16px 20px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .preview-modal-body {
          padding: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f8fafc;
          overflow: auto;
        }
        .preview-modal-footer {
          padding: 14px 20px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: white;
        }
      `}</style>
    </div>
  );
}
