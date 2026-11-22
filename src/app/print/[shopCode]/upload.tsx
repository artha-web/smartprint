"use client";

import { FormEvent, useState, useRef, useEffect } from "react";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Image as ImageIcon,
  FileCode,
  X,
  Eye,
  Trash2,
} from "lucide-react";

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const MAX_MB = 20;

  // Cleanup object URLs when preview changes
  useEffect(() => {
    return () => {
      if (previewFile?.url) {
        URL.revokeObjectURL(previewFile.url);
      }
    };
  }, [previewFile]);

  function handleFilesChange(selectedList: FileList | null) {
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

      newFiles.push(file);
    }

    setFiles((prev) => [...prev, ...newFiles]);
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
    const isImage = file.type.startsWith("image/") || [".png", ".jpg", ".jpeg", ".webp"].some(e => ext.endsWith(e));
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
    setUploadProgress(15);

    try {
      const formData = new FormData();
      formData.append("customerName", trimmedName);
      files.forEach((file) => {
        formData.append("files", file);
      });

      // Simulated smooth progress while sending
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
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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

        {/* Drag & Drop Upload Zone */}
        <div className="field">
          <label>
            Select Documents (PDF, Word, Images, TXT) <span style={{ color: "#e11d48" }}>*</span>
          </label>
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
                      <div className="muted" style={{ fontSize: 12 }}>
                        {formatSize(f.size)}
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
                <X size={20} />
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
