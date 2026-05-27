import React, { useState } from 'react';
import { 
  Pencil,
  Trash2, 
  FileCheck, 
  ExternalLink, 
  CheckCircle, 
  Loader2, 
  Paperclip,
  Calendar,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Lock,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Upload,
  Camera,
  Link,
  Copy
} from 'lucide-react';
import { uploadFile } from '../services/api';
import { normalizeCategory } from '../utils/categoryUtils';

const formatActualTime = (val: any): string => {
  if (!val) return '-';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) {
      return String(val);
    }
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const year = d.getFullYear();
    const hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
  } catch {
    return String(val);
  }
};

interface TaskType {
  rowNumber: number;
  [key: string]: any;
}

interface ProjectType {
  projectId: string;
  projectName: string;
}

interface TaskTableProps {
  tasks: TaskType[];
  projects: ProjectType[];
  isLoading: boolean;
  userRole: string;
  userEmail?: string;
  onUpdateTask: (rowId: number, updates: any) => Promise<void>;
  onDeleteTask: (rowId: number) => Promise<void>;
  onDeleteTasks?: (rowIds: number[]) => Promise<void>;
  onOpenEditModal: (task: TaskType) => void;
  onDuplicateTask?: (task: TaskType) => Promise<void>;
}

const getTaskResponsible = (task: any): string => {
  const resp = task['PERSON RESPONSIBLE'];
  if (resp !== undefined && resp !== null && String(resp).trim() !== '') {
    return String(resp).trim();
  }
  return '';
};

export default function TaskTable({
  tasks,
  projects,
  isLoading,
  userRole,
  userEmail = '',
  onUpdateTask,
  onDeleteTask,
  onDeleteTasks,
  onOpenEditModal,
  onDuplicateTask,
}: TaskTableProps) {
  const [updatingRow, setUpdatingRow] = useState<number | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<number[]>([]);
  const [uploadingRowId, setUploadingRowId] = useState<number | null>(null);
  const [uploadingProgress, setUploadingProgress] = useState<string>('');

  // Confirmation Modal state for iframe compatibility and gorgeous UI
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteRowId, setDeleteRowId] = useState<number | null>(null);
  const [deleteMode, setDeleteMode] = useState<'single' | 'bulk'>('single');

  const isImage = (url: string) => {
    if (!url) return false;
    return !!url.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i) || url.includes('/uploads/') || url.includes('data:image');
  };
  
  const handleRowFileUpload = async (rowId: number, projectId: string, files: FileList | null, currentUploads: any[]) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    
    setUploadingRowId(rowId);
    setUploadingProgress('Uploading...');
    
    try {
      const response = await uploadFile(file, projectId || 'GENERAL');
      const isSuccess = response.status === 'success' || response.success === true;
      if (isSuccess && response.data) {
        const newFileItem = {
          name: response.data.name || file.name,
          url: response.data.url,
          id: response.data.id || String(Date.now()),
        };
        // Replace completely with just one item (single upload preference)
        const nextUploads = [newFileItem];
        const actualTimeStr = (() => {
          const now = new Date();
          return `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        })();
        
        // Direct inline update of Google Sheets database via props callback
        // Also set STATUS to DONE upon uploading of PDF/image proof
        await onUpdateTask(rowId, {
          'TASK UPLOADS': JSON.stringify(nextUploads),
          'ACTUAL TIME': actualTimeStr,
          'STATUS': 'DONE'
        });
      } else {
        throw new Error(response.message || 'Upload failed');
      }
    } catch (err: any) {
      console.error(err);
      alert(`❌ Upload failed: ${err.message || 'Check network connection'}`);
    } finally {
      setUploadingRowId(null);
      setUploadingProgress('');
    }
  };

  // Interactive sorting state
  const [sortField, setSortField] = useState<string>('rowNumber');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Simple client-side pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 8;

  // Render variables helper
  const emailLower = String(userEmail || '').trim().toLowerCase();
  
  // Only dastudio5india1@gmail.com can delete
  const canDelete = emailLower === 'dastudio5india1@gmail.com';
  
  const isReadOnlyPrivilege = 
    (userRole === 'PC (only view acess)' || userRole === 'PC' || emailLower.includes('pc.')) && 
    emailLower !== 'pc.2@studio5india.com';

  // Parse attached uploads safely
  const parseUploads = (uploadsData: any): { name: string; url: string; id: string }[] => {
    if (!uploadsData) return [];
    if (Array.isArray(uploadsData)) return uploadsData;
    try {
      const parsed = JSON.parse(uploadsData);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      if (typeof uploadsData === 'string' && uploadsData.startsWith('http')) {
        return [{ name: 'Drive Attachment', url: uploadsData, id: 'raw' }];
      }
      return [];
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const handleStatusChange = async (rowNumber: number, newStatus: string) => {
    if (isReadOnlyPrivilege) {
      alert("🔒 View-Only Role block: Only Admin role can modify task status values.");
      return;
    }

    setUpdatingRow(rowNumber);
    try {
      const updates: any = {
        'STATUS': newStatus,
      };
      const t = paginatedTasks.find(x => x.rowNumber === rowNumber);
      const uploads = t ? parseUploads(t['TASK UPLOADS'] || t['UPLOAD']) : [];
      const hasUpload = uploads.length > 0;

      if (newStatus === 'NOT DONE' || !hasUpload) {
        updates['ACTUAL TIME'] = '';
      } else {
        if (t && !t['ACTUAL TIME']) {
          const now = new Date();
          updates['ACTUAL TIME'] = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        }
      }
      await onUpdateTask(rowNumber, updates);
    } catch (err) {
      alert('Failed to update status.');
    } finally {
      setUpdatingRow(null);
    }
  };

  const handleDeleteClick = (rowNumber: number) => {
    if (!canDelete) {
      alert("🔒 Access blocked: Only permitted admin roles can delete tasks.");
      return;
    }
    setDeleteRowId(rowNumber);
    setDeleteMode('single');
    setDeleteConfirmOpen(true);
  };

  const handleBulkDelete = () => {
    if (!canDelete) {
      alert("🔒 Access blocked: Only permitted admin roles can delete tasks.");
      return;
    }

    if (selectedRowIds.length === 0) {
      alert("⚠️ No rows selected! Please check one or more boxes in the 'ACT' column first to delete them in bulk.");
      return;
    }

    setDeleteMode('bulk');
    setDeleteConfirmOpen(true);
  };

  const executeDelete = async () => {
    setDeleteConfirmOpen(false);
    
    if (deleteMode === 'single') {
      if (deleteRowId === null) return;
      setUpdatingRow(deleteRowId);
      try {
        await onDeleteTask(deleteRowId);
        setSelectedRowIds(prev => prev.filter(id => id !== deleteRowId));
      } catch (err: any) {
        alert('Failed to delete task: ' + (err.message || err));
      } finally {
        setUpdatingRow(null);
        setDeleteRowId(null);
      }
    } else {
      if (selectedRowIds.length === 0) return;
      setUpdatingRow(99999);
      try {
        if (onDeleteTasks) {
          await onDeleteTasks(selectedRowIds);
        } else {
          // Fallback descending rowIds deletion to avoid shift anomalies
          const sortedDesc = [...selectedRowIds].sort((a, b) => b - a);
          for (const rowId of sortedDesc) {
            await onDeleteTask(rowId);
          }
        }
        setSelectedRowIds([]);
      } catch (err: any) {
        alert('Failed to delete selected tasks: ' + (err.message || err));
      } finally {
        setUpdatingRow(null);
      }
    }
  };

  const getCategoryColor = (cat: string) => {
    const c = (cat || '').toUpperCase();
    if (c === 'WORK') return 'text-sky-700 bg-sky-50 border-sky-100';
    if (c === 'MATERIAL') return 'text-purple-700 bg-purple-50 border-purple-100';
    if (c === 'SELECTION') return 'text-amber-700 bg-amber-50 border-amber-100';
    if (c === 'DRAWING') return 'text-pink-700 bg-pink-50 border-pink-100';
    if (c.includes('SAT REPORT')) return 'text-emerald-700 bg-emerald-50 border-emerald-100';
    if (c.includes('SCHEDULE MANDATORY')) return 'text-blue-700 bg-blue-50 border-blue-100';
    if (c.includes('PHOTO OF SITE') || c.includes('SITE PHOTO') || c.includes('MANDATORY UPLOADS')) {
      return 'text-rose-700 bg-rose-50 border-rose-100';
    }
    if (c.includes('SNAG')) return 'text-red-700 bg-red-50 border-red-150';
    return 'text-gray-700 bg-gray-50 border-gray-150';
  };

  const formatDateString = (dtStr: any) => {
    if (!dtStr) return '-';
    try {
      const d = new Date(dtStr);
      if (isNaN(d.getTime())) return String(dtStr).split('T')[0];
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return String(dtStr);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-14 text-gray-500 rounded-xl bg-white border border-gray-200">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-3" />
        <p className="text-sm font-semibold text-gray-700">Synchronizing database entries with Google Sheets...</p>
        <p className="text-2xs text-gray-400 mt-1">Fetching live records, computing schemas, and loading attachments</p>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-14 text-center rounded-xl bg-white border border-gray-200">
        <AlertCircle className="h-10 w-10 text-gray-400 mb-3" />
        <h4 className="text-sm font-bold text-gray-905">No Matches Found For Active Selection</h4>
        <p className="text-xs text-gray-500 max-w-sm mt-1">
          No database records matched your search terms or supervisor filters.
        </p>
      </div>
    );
  }

  // Execute sorting
  const sortedTasks = [...tasks].sort((a, b) => {
    let valA = a[sortField] !== undefined ? a[sortField] : '';
    let valB = b[sortField] !== undefined ? b[sortField] : '';

    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Execute pagination
  const totalItems = sortedTasks.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTasks = sortedTasks.slice(startIndex, startIndex + itemsPerPage);

  const prevPage = () => setCurrentPage(p => Math.max(p - 1, 1));
  const nextPage = () => setCurrentPage(p => Math.min(p + 1, totalPages));

  return (
    <div className="space-y-4">
      
      {/* Dynamic Bulk Actions Panel - Always visible to ensure discoverability */}
      {canDelete && (
        <div id="bulk-delete-banner" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl p-4 transition-all duration-300 bg-red-50 border border-red-200 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg shrink-0 bg-red-100 text-red-700 font-bold">
              <Trash2 className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-red-950 font-black">Bulk Task Actions</h4>
              <p className="text-[10px] font-semibold mt-0.5 text-red-600">
                {selectedRowIds.length > 0 
                  ? `You have selected ${selectedRowIds.length} row${selectedRowIds.length > 1 ? 's' : ''} to delete together.` 
                  : "Select task rows using the 'ACT' checkbox columns below to perform bulk delete actions."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              onClick={handleBulkDelete}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-red-700 transition cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Selected Rows</span>
            </button>
            {selectedRowIds.length > 0 && (
              <button
                onClick={() => setSelectedRowIds([])}
                className="px-3 py-2 bg-white text-gray-750 text-xs font-bold rounded-lg border border-gray-200 hover:bg-gray-100 transition cursor-pointer shadow-xs"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
       {/* 1. Desktop Excel Spreadsheet Layout */}
      <div className="hidden lg:block rounded-xl border border-gray-200 bg-white shadow-xs overflow-x-auto w-full relative">
        <table className="min-w-full table-auto divide-y divide-gray-200 text-left text-[11px] md:text-xs text-gray-700 font-sans">
          <thead className="bg-gray-50 font-bold text-gray-750 uppercase tracking-wider text-[9.5px] border-b border-gray-200 sticky top-0 z-10">
            <tr>
              <th className="px-1.5 py-1 w-[85px]">
                <div className="flex items-center gap-1">
                  {canDelete && (
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-3 w-3"
                      checked={paginatedTasks.length > 0 && paginatedTasks.every(t => selectedRowIds.includes(t.rowNumber))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const pageRowIds = paginatedTasks.map(t => t.rowNumber);
                          setSelectedRowIds(prev => Array.from(new Set([...prev, ...pageRowIds])));
                        } else {
                          const pageRowIds = paginatedTasks.map(t => t.rowNumber);
                          setSelectedRowIds(prev => prev.filter(id => !pageRowIds.includes(id)));
                        }
                      }}
                    />
                  )}
                  <span>ACT</span>
                </div>
              </th>
              <th className="px-1.5 py-1 cursor-pointer hover:bg-gray-100 transition" onClick={() => handleSort('PROJECT ID')}>
                <div className="flex items-center gap-1">
                  <span>Project</span>
                </div>
              </th>
              <th className="px-1.5 py-1 cursor-pointer hover:bg-gray-100 transition" onClick={() => handleSort('week')}>
                <div className="flex items-center gap-1">
                  <span>Week</span>
                </div>
              </th>
              <th className="px-1.5 py-1 cursor-pointer hover:bg-gray-100 transition" onClick={() => handleSort('CATEGORY')}>
                <div className="flex items-center gap-1">
                  <span>Category</span>
                </div>
              </th>
              <th className="px-1.5 py-1 cursor-pointer hover:bg-gray-100 transition" onClick={() => handleSort('TASK')}>
                <div className="flex items-center gap-1">
                  <span>Task Description</span>
                </div>
              </th>
              <th className="px-1.5 py-1 cursor-pointer hover:bg-gray-100 transition" onClick={() => handleSort('START DATE')}>
                <div className="flex items-center gap-1">
                  <span>Start Date</span>
                </div>
              </th>
              <th className="px-1.5 py-1 cursor-pointer hover:bg-gray-100 transition" onClick={() => handleSort('END DATE')}>
                <div className="flex items-center gap-1">
                  <span>End Date</span>
                </div>
              </th>
              <th className="px-1.5 py-1 cursor-pointer hover:bg-gray-100 transition" onClick={() => handleSort('REV 1')}>
                <div className="flex items-center gap-1">
                  <span>REV 1</span>
                </div>
              </th>
              <th className="px-1.5 py-1 cursor-pointer hover:bg-gray-100 transition" onClick={() => handleSort('REV 2')}>
                <div className="flex items-center gap-1">
                  <span>REV 2</span>
                </div>
              </th>
              <th className="px-1.5 py-1 cursor-pointer hover:bg-gray-100 transition" onClick={() => handleSort('REV 3')}>
                <div className="flex items-center gap-1">
                  <span>REV 3</span>
                </div>
              </th>
              <th className="px-1.5 py-1 cursor-pointer hover:bg-gray-100 transition" onClick={() => handleSort('PERSON RESPONSIBLE')}>
                <div className="flex items-center gap-1">
                  <span>Responsible</span>
                </div>
              </th>
              <th className="px-1.5 py-1 cursor-pointer hover:bg-gray-100 transition" onClick={() => handleSort('ACTUAL TIME')}>
                <div className="flex items-center gap-1">
                  <span>Actual Time</span>
                </div>
              </th>
              <th className="px-1.5 py-1">Upload Link</th>
              <th className="px-1.5 py-1 cursor-pointer hover:bg-gray-100 transition" onClick={() => handleSort('STATUS')}>
                <div className="flex items-center gap-1 border-l pl-2 border-indigo-200">
                  <span>Status</span>
                </div>
              </th>
              <th className="px-1.5 py-1 cursor-pointer hover:bg-gray-100 transition" onClick={() => handleSort('REMARK')}>
                <div className="flex items-center gap-1 border-l pl-2 border-indigo-200">
                  <span>Remark</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white font-sans">
            {paginatedTasks.map((task) => {
              const uploads = parseUploads(task['TASK UPLOADS'] || task['UPLOAD']);
              const hasUpload = uploads.length > 0;
              
              const getWeekNum = (wStr: string): number => {
                const match = String(wStr || '').match(/\d+/);
                return match ? parseInt(match[0], 10) : 0;
              };
              const weekNum = getWeekNum(task['week'] || '');
              const isStatusAllowed = (weekNum < 22) || hasUpload;
              const rowId = task.rowNumber;

              const matchedProj = projects.find(p => p.projectId === task['PROJECT ID']) || 
                                  projects.find(p => p.projectId.trim().toUpperCase() === String(task['PROJECT ID'] || '').trim().toUpperCase());
              const resolvedProjectName = matchedProj ? matchedProj.projectName : (task['PROJECT NAME'] || 'Enterprise Campus Site');

              const hasAnyRev = !!(task['REV 1'] || task['REV 2'] || task['REV 3'] || task['REVISION DATE']);

              return (
                <tr key={rowId} className={`hover:bg-gray-50/40 transition group text-[10.5px] md:text-[11px] ${selectedRowIds.includes(rowId) ? 'bg-indigo-50/20' : ''} ${hasAnyRev ? 'bg-amber-50/25 border-l-2 border-amber-500 font-semibold' : ''}`}>
                  {/* LEFTMOST ACTION ZONE (ACT) */}
                  <td className="px-1.5 py-1 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {canDelete && (
                        <>
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-505 cursor-pointer h-3 w-3"
                            checked={selectedRowIds.includes(rowId)}
                            onChange={() => {
                              setSelectedRowIds(prev =>
                                prev.includes(rowId) ? prev.filter(id => id !== rowId) : [...prev, rowId]
                              );
                            }}
                          />
                          <span className="text-gray-355 font-bold text-[10px] select-none">›</span>
                        </>
                      )}
                      
                      {isReadOnlyPrivilege ? (
                        <span className="p-0.5 text-gray-350" title="Locked: Read-only access">
                          <Lock className="h-3 w-3" />
                        </span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onOpenEditModal(task)}
                            className="rounded p-0.5 bg-gray-50 hover:bg-indigo-55 border border-gray-200 hover:text-indigo-600 hover:border-indigo-200 transition cursor-pointer"
                            title="Edit Task Details"
                            id={`btn-edit-task-${rowId}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          {onDuplicateTask && (
                            <button
                              onClick={() => onDuplicateTask(task)}
                              className="rounded p-0.5 bg-gray-50 hover:bg-indigo-55 border border-gray-200 hover:text-teal-600 hover:border-teal-200 transition cursor-pointer"
                              title="Duplicate Task Row"
                              id={`btn-duplicate-task-${rowId}`}
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteClick(rowId)}
                              className="rounded p-0.5 bg-gray-50 hover:bg-indigo-55 border border-gray-200 hover:text-red-650 hover:border-red-200 transition cursor-pointer"
                              title="Delete Row"
                              id={`btn-delete-task-${rowId}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* PROJECT REF */}
                  <td className="px-1.5 py-1">
                    <p className="font-extrabold text-gray-905 truncate max-w-[150px] text-[10.5px] md:text-[11px]" title={resolvedProjectName}>
                      {resolvedProjectName}
                    </p>
                    <span className="text-[9px] md:text-[9.5px] font-bold text-indigo-600 block mt-0.5">
                      {task['PROJECT ID'] || 'GEN-REF'}
                    </span>
                  </td>

                  {/* WEEK */}
                  <td className="px-1.5 py-1 whitespace-nowrap">
                    <span className="font-black text-gray-750 bg-gray-50 px-1.5 py-0.2 rounded border border-gray-150 text-[9.5px] md:text-[10px]">
                      {task['week'] || 'Week-22'}
                    </span>
                  </td>

                  {/* CATEGORY */}
                  <td className="px-1.5 py-1">
                    <span className={`inline-block text-[8px] md:text-[9px] font-black px-1 py-0.2 rounded border tracking-wider ${getCategoryColor(task['CATEGORY'])}`}>
                      {normalizeCategory(task['CATEGORY'] || 'WORK')}
                    </span>
                  </td>

                  {/* DESCRIPTION */}
                  <td className="px-1.5 py-1">
                    <div className="min-w-[150px] md:min-w-[200px] whitespace-normal break-words">
                      <p className="font-semibold text-gray-950 leading-normal text-[10.5px] md:text-[11px]" id={`task-desc-${rowId}`}>
                        {task['TASK'] || 'Untitled Task'}
                      </p>
                    </div>
                  </td>

                  {/* START DATE */}
                  <td className="px-1.5 py-1 font-bold text-gray-700 whitespace-nowrap text-[10.5px] md:text-[11px]">
                    {formatDateString(task['START DATE'])}
                  </td>

                  {/* END DATE */}
                  <td className="px-1.5 py-1 font-black text-red-600 whitespace-nowrap text-[10.5px] md:text-[11px]">
                    {formatDateString(task['END DATE'])}
                  </td>

                  {/* REV 1 */}
                  <td className="px-1.5 py-1 font-black text-indigo-700 bg-indigo-50/40 whitespace-nowrap text-[10.5px] md:text-[11px]">
                    {formatDateString(task['REV 1'] || task['REVISION DATE']) || <span className="text-gray-300 font-normal italic">-</span>}
                  </td>

                  {/* REV 2 */}
                  <td className="px-1.5 py-1 font-black text-amber-805 bg-amber-50/30 whitespace-nowrap text-[10.5px] md:text-[11px]">
                    {formatDateString(task['REV 2']) || <span className="text-gray-300 font-normal italic">-</span>}
                  </td>

                  {/* REV 3 */}
                  <td className="px-1.5 py-1 font-black text-fuchsia-800 bg-fuchsia-50/20 whitespace-nowrap text-[10.5px] md:text-[11px]">
                    {formatDateString(task['REV 3']) || <span className="text-gray-300 font-normal italic">-</span>}
                  </td>

                  {/* RESPONSIBLE */}
                  <td className="px-1.5 py-1 font-black text-gray-750 whitespace-nowrap text-[10.5px] md:text-[11px]">
                    {getTaskResponsible(task)}
                  </td>

                  {/* ACTUAL TIME */}
                  <td className="px-1.5 py-1 font-bold text-gray-700 whitespace-nowrap text-[10.5px] md:text-[11px]">
                    {task['ACTUAL TIME'] && 
                     hasUpload && 
                     (String(task['STATUS'] || '').toUpperCase() === 'DONE' || String(task['STATUS'] || '').toUpperCase() === 'PARTIALLY DONE') ? (
                       formatActualTime(task['ACTUAL TIME'])
                     ) : (
                       <span className="text-gray-350 italic font-medium">-</span>
                     )}
                  </td>

                  {/* SINGLE OPTION OF UPLOAD WITH INLINE PREVIEW */}
                  <td className="px-1.5 py-1">
                    <div className="flex items-center gap-1.5">
                      {hasUpload && (
                        <div className="shrink-0 font-bold">
                          {isImage(uploads[0].url) ? (
                            <a href={uploads[0].url} target="_blank" rel="noreferrer" className="block relative group outline-none">
                              <img 
                                src={uploads[0].url} 
                                alt="Image proof" 
                                className="h-5 w-7 object-cover rounded border border-gray-200 shadow-3xs hover:border-indigo-400 transition"
                                referrerPolicy="no-referrer"
                              />
                            </a>
                          ) : (
                            <a 
                              href={uploads[0].url} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="bg-indigo-50 border border-indigo-250 text-indigo-700 text-[8px] md:text-[9.5px] font-bold px-1 py-0.2 rounded inline-flex items-center gap-0.5 hover:bg-indigo-100 transition shadow-3xs"
                              title={uploads[0].name}
                            >
                              <Paperclip className="h-2.5 w-2.5 shrink-0" />
                              <span>Link</span>
                            </a>
                          )}
                        </div>
                      )}

                      {uploadingRowId === rowId ? (
                        <div className="flex items-center gap-1 text-[9px] md:text-[9.5px] font-bold text-indigo-600">
                          <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          <span>{uploadingProgress || 'Saving...'}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => document.getElementById(`row-file-input-${rowId}`)?.click()}
                            className="p-1 rounded bg-white hover:bg-indigo-55 border border-gray-200 hover:border-indigo-300 text-gray-550 hover:text-indigo-600 transition cursor-pointer shadow-3xs"
                            title="Upload Site Image proof"
                          >
                            <Upload className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => document.getElementById(`row-camera-input-${rowId}`)?.click()}
                            className="p-1 rounded bg-white hover:bg-teal-55 border border-gray-200 hover:border-teal-300 text-gray-550 hover:text-teal-600 transition cursor-pointer shadow-3xs"
                            title="Direct Site Camera Capture"
                          >
                            <Camera className="h-3 w-3" />
                          </button>

                          <input
                            type="file"
                            id={`row-file-input-${rowId}`}
                            className="hidden"
                            accept="image/*,application/pdf"
                            onChange={(e) => handleRowFileUpload(rowId, task['PROJECT ID'], e.target.files, uploads)}
                          />
                          <input
                            type="file"
                            id={`row-camera-input-${rowId}`}
                            className="hidden"
                            accept="image/*"
                            capture="environment"
                            onChange={(e) => handleRowFileUpload(rowId, task['PROJECT ID'], e.target.files, uploads)}
                          />
                        </div>
                      )}
                    </div>
                  </td>

                  {/* STATUS SELECTOR */}
                  <td className="px-1.5 py-1 border-l border-indigo-100 pl-1">
                    {updatingRow === rowId ? (
                      <div className="flex items-center gap-1 text-indigo-600">
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        <span className="text-[9px] md:text-[9.5px] font-bold">Saving...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-0.5 items-start">
                        <select
                          id={`select-status-${rowId}`}
                          disabled={isReadOnlyPrivilege || !isStatusAllowed}
                          value={(task['STATUS'] || 'NOT DONE').toUpperCase()}
                          onChange={(e) => handleStatusChange(rowId, e.target.value)}
                          className={`rounded py-0.2 px-1 text-[9px] md:text-[9.5px] font-black border tracking-wider outline-hidden cursor-pointer ${
                            !isStatusAllowed ? 'bg-gray-150 text-gray-400 border-gray-200 cursor-not-allowed opacity-65' :
                            (task['STATUS'] || '').toUpperCase() === 'DONE' ? 'bg-emerald-50 text-emerald-800 border-emerald-250' :
                            (task['STATUS'] || '').toUpperCase() === 'PARTIALLY DONE' ? 'bg-amber-100/70 text-amber-800 border-amber-250' :
                            'bg-red-50 text-red-800 border-red-200'
                          }`}
                          title={!isStatusAllowed ? 'Upload is mandatory before selecting task status' : 'Select target status'}
                        >
                          <option value="NOT DONE">NOT DONE</option>
                          <option value="PARTIALLY DONE">PARTIALLY DONE</option>
                          <option value="DONE">DONE</option>
                        </select>
                        
                        {!isStatusAllowed && (
                          <span className="text-[8px] md:text-[9px] font-bold text-red-500 bg-red-55 px-1 py-0.2 rounded mt-0.5 max-w-[110px] leading-tight-none whitespace-nowrap">
                            Needs proof
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* REMARK */}
                  <td className="px-1.5 py-1 border-l border-indigo-100 pl-1 max-w-[155px] truncate" title={task['REMARK'] || task['remark'] || ''}>
                    <span className="text-gray-700 font-bold text-[10.5px] md:text-[11px]">
                      {task['REMARK'] || task['remark'] || '-'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 2. Mobile Stacked Matrix Layout */}
      <div className="grid grid-cols-1 gap-4 lg:hidden font-sans">
        {paginatedTasks.map((task) => {
          const uploads = parseUploads(task['TASK UPLOADS'] || task['UPLOAD']);
          const hasUpload = uploads.length > 0;
          
          const getWeekNum = (wStr: string): number => {
            const match = String(wStr || '').match(/\d+/);
            return match ? parseInt(match[0], 10) : 0;
          };
          const weekNum = getWeekNum(task['week'] || '');
          const isStatusAllowed = (weekNum < 22) || hasUpload;
          const rowId = task.rowNumber;

          const matchedProj = projects.find(p => p.projectId === task['PROJECT ID']) || 
                              projects.find(p => p.projectId.trim().toUpperCase() === String(task['PROJECT ID'] || '').trim().toUpperCase());
          const resolvedProjectName = matchedProj ? matchedProj.projectName : (task['PROJECT NAME'] || 'Enterprise Campus Site');

          return (
            <div
              key={rowId}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs relative hover:border-indigo-250 transition"
            >
              {/* Mobile Title strip */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-2.5 mb-2.5">
                <span className={`inline-block text-[10.5px] font-black px-2 py-0.5 rounded-sm border ${getCategoryColor(task['CATEGORY'])}`}>
                  {normalizeCategory(task['CATEGORY'] || 'WORK')}
                </span>
                <span className="bg-indigo-55 border border-indigo-150 inline-block text-[10.5px] font-black px-2 py-0.5 rounded text-indigo-750">
                  {task['week'] || 'Week-22'}
                </span>
                <span className="text-[11.5px] font-black text-gray-400">Row {rowId}</span>
              </div>

              {/* Core description details */}
              <div className="space-y-1.5">
                <h4 className="font-extrabold text-[13.5px] text-gray-950 block truncate">{resolvedProjectName}</h4>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">ID: {task['PROJECT ID'] || '-'}</p>
                <p className="font-bold text-gray-900 leading-snug text-[13.5px] mt-1">{task['TASK']}</p>
                
                {task['REMARK'] && (
                  <p className="text-xs text-gray-600 bg-gray-50 rounded p-2.5 font-bold italic mt-2">
                    Remark: &ldquo;{task['REMARK']}&rdquo;
                  </p>
                )}
              </div>

              {/* Timeline Info (Separate columns styled neatly) */}
              <div className="grid grid-cols-3 gap-3 py-2.5 my-2 border-t border-b border-gray-100 text-[11.5px] text-gray-700">
                <div>
                  <span className="text-[9.5px] uppercase font-black text-gray-400 block pb-0.5">Start Date</span>
                  <strong className="font-bold text-gray-700">{formatDateString(task['START DATE'])}</strong>
                </div>
                <div>
                  <span className="text-[9.5px] uppercase font-black text-gray-400 block pb-0.5">End Date</span>
                  <strong className="font-extrabold text-red-655">{formatDateString(task['END DATE'])}</strong>
                </div>
                <div>
                  <span className="text-[9.5px] uppercase font-black text-indigo-400 block pb-0.5">Rev Date</span>
                  <strong className="font-extrabold text-indigo-700">{formatDateString(task['REVISION DATE']) || <span className="text-gray-300 font-normal italic">-</span>}</strong>
                </div>
              </div>

              {/* Upload compliance status inline check with mobile direct upload/camera options */}
              <div className="flex flex-col gap-2.5 border-t border-gray-100 pt-2 mt-2">
                <div className="flex items-center justify-between text-[11.5px]">
                  <div>
                    <span className="text-[9.5px] uppercase font-black text-gray-400 block">Responsible User</span>
                    <strong className="font-bold text-gray-700">{getTaskResponsible(task)}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-[9.5px] uppercase font-black text-gray-400 block">Actual Time</span>
                    {task['ACTUAL TIME'] && 
                     hasUpload && 
                     (String(task['STATUS'] || '').toUpperCase() === 'DONE' || String(task['STATUS'] || '').toUpperCase() === 'PARTIALLY DONE') ? (
                      <strong className="font-bold text-teal-650">{formatActualTime(task['ACTUAL TIME'])}</strong>
                    ) : (
                      <span className="text-gray-300 font-medium italic">-</span>
                    )}
                  </div>
                </div>

                {/* Direct Upload Buttons for Field Supervisors (Mobile optimized) */}
                <div className="rounded-lg bg-gray-50 border border-gray-200/60 p-2.5 text-[11.5px] space-y-1.5">
                  <span className="text-[9px] font-black text-gray-450 uppercase block tracking-wider">Proof of Work (Single Upload)</span>
                  
                  {hasUpload && (
                    <div className="mb-2">
                      {isImage(uploads[0].url) ? (
                        <a href={uploads[0].url} target="_blank" rel="noreferrer" className="block relative group max-w-max">
                          <img 
                            src={uploads[0].url} 
                            alt="Uploaded mobile proof" 
                            className="h-16 w-28 object-cover rounded-md border border-gray-300 shadow-3xs"
                            referrerPolicy="no-referrer"
                          />
                        </a>
                      ) : (
                        <a 
                          key={uploads[0].id}
                          href={uploads[0].url}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded inline-flex items-center gap-1"
                          title={uploads[0].name}
                        >
                          <Paperclip className="h-3 w-3" />
                          <span>View Doc Attachment</span>
                        </a>
                      )}
                    </div>
                  )}

                  {uploadingRowId === rowId ? (
                    <div className="flex items-center gap-1.5 text-indigo-600 font-bold py-1">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{uploadingProgress || 'Saving...'}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => document.getElementById(`row-file-input-mobile-${rowId}`)?.click()}
                        className="inline-flex items-center gap-1 rounded bg-white hover:bg-gray-50 border border-gray-300 px-2.5 py-1 text-[11px] text-gray-700 font-black shadow-3xs cursor-pointer"
                      >
                        📁 File/Drive
                      </button>
                      <button
                        type="button"
                        onClick={() => document.getElementById(`row-camera-input-mobile-${rowId}`)?.click()}
                        className="inline-flex items-center gap-1 rounded bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 text-[11px] text-indigo-700 font-black shadow-3xs cursor-pointer"
                      >
                        📷 Camera
                      </button>

                      <input
                        type="file"
                        id={`row-file-input-mobile-${rowId}`}
                        className="hidden"
                        accept="image/*,application/pdf"
                        onChange={(e) => handleRowFileUpload(rowId, task['PROJECT ID'], e.target.files, uploads)}
                      />
                      <input
                        type="file"
                        id={`row-camera-input-mobile-${rowId}`}
                        className="hidden"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handleRowFileUpload(rowId, task['PROJECT ID'], e.target.files, uploads)}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Status selectors and Actions strip */}
              <div className="border-t border-gray-100 pt-3 mt-3.5 flex items-center justify-between">
                {/* Mobile status rating selector */}
                {updatingRow === rowId ? (
                  <div className="flex items-center gap-1 text-xs text-indigo-600 font-bold">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <select
                      id={`select-status-mobile-${rowId}`}
                      disabled={isReadOnlyPrivilege || !isStatusAllowed}
                      value={(task['STATUS'] || 'NOT DONE').toUpperCase()}
                      onChange={(e) => handleStatusChange(rowId, e.target.value)}
                      className={`rounded-md py-1 px-2.5 text-[11.5px] font-black border tracking-wider outline-hidden ${
                        !isStatusAllowed ? 'bg-gray-150 text-gray-400 border-gray-200 cursor-not-allowed opacity-65' :
                        (task['STATUS'] || '').toUpperCase() === 'DONE' ? 'bg-emerald-50 text-emerald-800 border-emerald-250' :
                        (task['STATUS'] || '').toUpperCase() === 'PARTIALLY DONE' ? 'bg-amber-100 text-amber-800 border-amber-250' :
                        'bg-red-50 text-red-800 border-red-195'
                      }`}
                    >
                      <option value="NOT DONE">NOT DONE</option>
                      <option value="PARTIALLY DONE">PARTIALLY DONE</option>
                      <option value="DONE">DONE</option>
                    </select>
                    {!isStatusAllowed && (
                      <span className="text-[9px] font-black text-red-500 bg-red-55 px-1 py-0.2 rounded mt-0.5 max-w-[125px]">
                        🔒 Status Locked (Needs proof upload)
                      </span>
                    )}
                  </div>
                )}

                {/* Mobile action button icons */}
                {isReadOnlyPrivilege ? (
                  <span className="text-[10px] text-gray-400 font-bold italic flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    <span>View Only</span>
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onOpenEditModal(task)}
                      className="rounded-md p-2 text-indigo-600 bg-gray-50 border border-gray-200 cursor-pointer hover:bg-indigo-50"
                      title="Edit Row"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {onDuplicateTask && (
                      <button
                        onClick={() => onDuplicateTask(task)}
                        className="rounded-md p-2 text-teal-600 bg-gray-50 border border-gray-200 cursor-pointer"
                        title="Duplicate Row"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDeleteClick(rowId)}
                        className="rounded-md p-2 text-red-500 bg-gray-50 border border-gray-200 cursor-pointer"
                        title="Delete Row"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

            </div>
          );
        })}
      </div>

      {/* 3. Pagination Controls with stats overview counters */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-gray-200 pt-4 px-1 text-xs font-semibold text-gray-500">
          <span>
            Showing <strong className="text-gray-900">{startIndex + 1}</strong> to <strong className="text-gray-900">{Math.min(startIndex + itemsPerPage, totalItems)}</strong> of <strong className="text-gray-900">{totalItems}</strong> entries matching filter
          </span>
          
          <div className="flex items-center gap-1">
            <button
              onClick={prevPage}
              disabled={currentPage === 1}
              className="rounded-lg border border-gray-300 bg-white p-1.5 text-gray-700 hover:bg-gray-100 disabled:opacity-45 disabled:cursor-not-allowed transition cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 py-1 bg-indigo-50 border-indigo-200 rounded-lg text-indigo-700 font-bold text-xs">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={nextPage}
              disabled={currentPage === totalPages}
              className="rounded-lg border border-gray-300 bg-white p-1.5 text-gray-700 hover:bg-gray-100 disabled:opacity-45 disabled:cursor-not-allowed transition cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {deleteConfirmOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-[2px] transition-opacity duration-300"
          id="custom-delete-confirmation-backdrop"
        >
          <div 
            className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden border border-gray-100 transition-all duration-300 transform scale-100"
            id="custom-delete-confirmation-box"
          >
            <div className="p-5">
              <div className="flex items-center gap-3 text-red-600 mb-3">
                <div className="p-2.5 bg-red-50 rounded-lg text-red-600 shrink-0">
                  <Trash2 className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-wider">Confirm Deletion</h3>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                {deleteMode === 'single' ? (
                  <>Are you sure you want to delete this task? This action will permanently remove the record from the database.</>
                ) : (
                  <>Are you sure you want to delete the <strong className="text-red-700 font-extrabold">{selectedRowIds.length} selected tasks</strong> together? This action will permanently remove all selected records from the database.</>
                )}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 bg-gray-50 px-5 py-3 border-t border-gray-150">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setDeleteRowId(null);
                }}
                className="px-3.5 py-1.5 bg-white text-gray-700 text-xs font-bold rounded-lg border border-gray-200 hover:bg-gray-100 transition cursor-pointer shadow-3xs"
                id="cancel-delete-modal-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="px-4 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition cursor-pointer shadow-xs flex items-center gap-1.5"
                id="confirm-delete-modal-btn"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Yes, Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
