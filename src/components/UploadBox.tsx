import React, { useRef, useState } from 'react';
import { 
  UploadCloud, 
  Camera, 
  FileText, 
  X, 
  CheckCircle, 
  Loader2, 
  Image as ImageIcon,
  FileSpreadsheet
} from 'lucide-react';
import { uploadFile } from '../services/api';

interface UploadedFile {
  name: string;
  url: string;
  id: string;
}

interface UploadBoxProps {
  projectId: string;
  onUploadsChange: (files: UploadedFile[]) => void;
  existingUploads?: UploadedFile[];
  label?: string;
  maxFiles?: number;
}

export default function UploadBox({
  projectId = 'GENERAL',
  onUploadsChange,
  existingUploads = [],
  label = 'Upload Site Documents, Photos or Reports',
  maxFiles = 5,
}: UploadBoxProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<{ name: string; progress: number; error?: string }[]>([]);
  const [uploadedList, setUploadedList] = useState<UploadedFile[]>(() => {
    // Attempt parsing if existing uploads comes as stringified JSON or standard array
    try {
      if (typeof existingUploads === 'string') {
        return JSON.parse(existingUploads);
      }
      return Array.isArray(existingUploads) ? existingUploads : [];
    } catch {
      return [];
    }
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const triggerFileSelect = () => fileInputRef.current?.click();
  const triggerCameraSelect = () => cameraInputRef.current?.click();

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // Check limit
    if (uploadedList.length + files.length > maxFiles) {
      alert(`You can only upload up to ${maxFiles} files.`);
      return;
    }

    const filesToUpload = Array.from(files);
    
    // Add to placeholder loading tracker
    const newPendingTrackers = filesToUpload.map(f => ({ name: f.name, progress: 10 }));
    setUploadingFiles(prev => [...prev, ...newPendingTrackers]);

    const completedUploads: UploadedFile[] = [...uploadedList];

    for (const file of filesToUpload) {
      try {
        // Update mock progress
        setUploadingFiles(prev => prev.map(p => p.name === file.name ? { ...p, progress: 40 } : p));
        
        // Execute Google Apps Script backend upload base64
        const response = await uploadFile(file, projectId);
        
        const isSuccess = response.status === 'success' || response.success === true;
        if (isSuccess && response.data) {
          const item: UploadedFile = {
            name: response.data.name || file.name,
            url: response.data.url,
            id: response.data.id,
          };
          completedUploads.push(item);
          
          // Clear file from uploading list
          setUploadingFiles(prev => prev.filter(p => p.name !== file.name));
        } else {
          throw new Error('Upload request failed on server');
        }
      } catch (err: any) {
        console.error(err);
        setUploadingFiles(prev => 
          prev.map(p => p.name === file.name ? { ...p, error: 'Upload failed', progress: 100 } : p)
        );
      }
    }

    setUploadedList(completedUploads);
    onUploadsChange(completedUploads);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleUploadFiles(e.dataTransfer.files);
  };

  const handleRemoveFile = (index: number) => {
    const updated = uploadedList.filter((_, i) => i !== index);
    setUploadedList(updated);
    onUploadsChange(updated);
  };

  const getFileIcon = (mimeTypeOrName: string) => {
    const name = mimeOrName => (mimeOrName || '').toLowerCase();
    const target = name(mimeTypeOrName);
    if (target.match(/\.(xls|xlsx)$/) || target.includes('excel') || target.includes('sheet')) {
      return <FileSpreadsheet className="h-8 w-8 text-emerald-600" />;
    }
    if (target.match(/\.(pdf)$/) || target.includes('pdf')) {
      return <FileText className="h-8 w-8 text-red-600" />;
    }
    return <ImageIcon className="h-8 w-8 text-indigo-500" />;
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
        {label}
      </label>

      {/* Main Drag&Drop Canvas */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all ${
          isDragging
            ? 'border-indigo-600 bg-indigo-50/50'
            : 'border-gray-200 bg-white hover:border-gray-300'
        }`}
      >
        <UploadCloud className="mx-auto h-10 w-10 text-gray-400" />
        <p className="mt-2 text-sm font-semibold text-gray-900">
          Drag & Drop file to upload, or select option
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Accepts Photos (jpg/png), PDF, or Excel sheets up to {maxFiles} files
        </p>

        {/* Buttons Row with direct mobile support */}
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {/* Gallery / File Browse */}
          <button
            type="button"
            onClick={triggerFileSelect}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-1.5 text-xs font-bold text-gray-700 shadow-xs hover:bg-gray-50 cursor-pointer"
          >
            Browse Gallery
          </button>

          {/* Camera (Mobile-Only Optimized with environment flag) */}
          <button
            type="button"
            onClick={triggerCameraSelect}
            className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 text-xs font-bold text-indigo-700 shadow-xs hover:bg-indigo-100 cursor-pointer"
          >
            <Camera className="h-4 w-4" />
            <span>Capture Site Camera</span>
          </button>
        </div>

        {/* Secret Inputs */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => handleUploadFiles(e.target.files)}
          accept="image/*,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          multiple
        />

        <input
          type="file"
          ref={cameraInputRef}
          onChange={(e) => handleUploadFiles(e.target.files)}
          accept="image/*"
          capture="environment"
          className="hidden"
          multiple
        />
      </div>

      {/* Uploading Progress List state */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2 rounded-xl bg-gray-50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Uploading File(s)...</p>
          {uploadingFiles.map((pf, i) => (
            <div key={pf.name + i} className="flex items-center justify-between gap-3 text-xs">
              <div className="flex flex-1 items-center gap-2 truncate text-gray-600">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                <span className="truncate">{pf.name}</span>
              </div>
              <span className="text-2xs font-bold text-indigo-600">
                {pf.error ? <span className="text-red-500">{pf.error}</span> : `${pf.progress}%`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Uploaded File List Display with Thumbnails */}
      {uploadedList.length > 0 && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {uploadedList.map((file, idx) => (
            <div
              key={file.id || idx}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-2.5 shadow-2xs hover:shadow-xs transition"
            >
              <div className="flex flex-1 items-center gap-2.5 truncate">
                {getFileIcon(file.name)}
                <div className="truncate leading-tight">
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-gray-900 hover:text-indigo-600 hover:underline block truncate"
                  >
                    {file.name}
                  </a>
                  <p className="text-[10px] text-gray-400 font-medium">Uploaded to Google Drive</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-4.5 w-4.5 text-emerald-500" />
                <button
                  type="button"
                  onClick={() => handleRemoveFile(idx)}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500"
                  title="Remove File Attachment"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
