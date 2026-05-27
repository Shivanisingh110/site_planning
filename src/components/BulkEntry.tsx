import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2, ChevronRight, Loader2, Info } from 'lucide-react';
import { weeks, getWeekFromStartDate } from '../utils/weeks';
import UploadBox from './UploadBox';
import { addTasks } from '../services/api';

interface ProjectType {
  projectId: string;
  projectName: string;
}

interface BulkEntryProps {
  projects: ProjectType[];
  userEmail: string;
  onSuccess: () => void;
  selectedSupervisor?: string | null;
  addRecentTask?: (tasks: any[]) => void;
}

interface TaskRow {
  rowId: string;
  projectId: string;
  projectName: string;
  category: string;
  task: string;
  week: string;
  startDate: string;
  endDate: string;
  revisionDate?: string;
  personResponsible: string;
  remark: string;
  uploads: any[];
  status: string;
  finalRemark: string;
  doer: string;
}

export default function BulkEntry({ projects, userEmail, onSuccess, selectedSupervisor, addRecentTask }: BulkEntryProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Default values templates
  const [globalProject, setGlobalProject] = useState<string>('');
  const [globalWeek, setGlobalWeek] = useState<string>('');
  const [globalResponsible, setGlobalResponsible] = useState<string>(selectedSupervisor || '');

  const createEmptyRow = (projId = '', wk = '', resp = ''): TaskRow => {
    const matchedProj = projects.find(p => p.projectId === projId);
    const projName = matchedProj ? matchedProj.projectName : '';
    const weekData = wk ? weeks[wk] : null;
    
    return {
      rowId: Math.random().toString(36).substring(2, 9),
      projectId: projId,
      projectName: projName,
      category: 'WORK',
      task: '',
      week: wk,
      startDate: weekData ? weekData.start : '',
      endDate: weekData ? weekData.end : '',
      revisionDate: '',
      personResponsible: resp,
      remark: '',
      uploads: [],
      status: 'NOT DONE',
      finalRemark: '',
      doer: userEmail,
    };
  };

  const [rows, setRows] = useState<TaskRow[]>([]);

  // Update globalResponsible and rows if selectedSupervisor changes
  useEffect(() => {
    if (selectedSupervisor) {
      setGlobalResponsible(selectedSupervisor);
      setRows(prev => prev.map(row => ({
        ...row,
        personResponsible: selectedSupervisor
      })));
    }
  }, [selectedSupervisor]);

  // Initialize with one empty row
  useEffect(() => {
    if (rows.length === 0) {
      const initialResp = selectedSupervisor || globalResponsible || '';
      setRows([createEmptyRow('', '', initialResp)]);
    }
  }, [projects]);

  // Update rows if global filters are modified (handy default booster)
  const applyGlobalProject = (projId: string) => {
    setGlobalProject(projId);
    const matchedProj = projects.find(p => p.projectId === projId);
    const projName = matchedProj ? matchedProj.projectName : '';
    setRows(prev => prev.map(row => ({
      ...row,
      projectId: projId,
      projectName: projName
    })));
  };

  const applyGlobalWeek = (wk: string) => {
    setGlobalWeek(wk);
    const weekData = wk ? weeks[wk] : null;
    setRows(prev => prev.map(row => ({
      ...row,
      week: wk,
      startDate: weekData ? weekData.start : '',
      endDate: weekData ? weekData.end : '',
    })));
  };

  const appendNewRow = () => {
    setRows(prev => [...prev, createEmptyRow(globalProject, globalWeek, globalResponsible)]);
  };

  const removeRowAt = (rowId: string) => {
    if (rows.length === 1) {
      alert("You should have at least one task row.");
      return;
    }
    setRows(prev => prev.filter(r => r.rowId !== rowId));
  };

  const updateField = (rowId: string, field: keyof TaskRow, value: any) => {
    setRows(prev => prev.map(row => {
      if (row.rowId !== rowId) return row;

      const updatedRow = { ...row, [field]: value };

      // Multi-step dependencies automation
      if (field === 'projectId') {
        const matched = projects.find(p => p.projectId === value);
        updatedRow.projectName = matched ? matched.projectName : '';
      } else if (field === 'week') {
        const weekData = weeks[value];
        if (weekData) {
          updatedRow.startDate = weekData.start;
          updatedRow.endDate = weekData.end;
        }
      } else if (field === 'startDate') {
        const computedWeek = getWeekFromStartDate(value);
        if (computedWeek && weeks[computedWeek]) {
          updatedRow.week = computedWeek;
          updatedRow.endDate = weeks[computedWeek].end;
        }
      } else if (field === 'revisionDate') {
        if (value) {
          const computedWeek = getWeekFromStartDate(value);
          if (computedWeek && weeks[computedWeek]) {
            updatedRow.week = computedWeek;
          }
        } else if (updatedRow.startDate) {
          const computedWeek = getWeekFromStartDate(updatedRow.startDate);
          if (computedWeek && weeks[computedWeek]) {
            updatedRow.week = computedWeek;
          }
        }
      }
      return updatedRow;
    }));
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    // Validate inputs
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.projectId) {
        setStatusMessage({ type: 'error', text: `Row #${i + 1}: Please select a valid project.` });
        return;
      }
      if (!r.task.trim()) {
        setStatusMessage({ type: 'error', text: `Row #${i + 1}: Task text description is required.` });
        return;
      }
      if (!r.week) {
        setStatusMessage({ type: 'error', text: `Row #${i + 1}: Week selection is required.` });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // Structure row objects matching standard Apps Script insert expectations
      const tasksToSubmit = rows.map(r => ({
        projectId: r.projectId,
        projectName: r.projectName,
        category: r.category,
        task: r.task,
        week: r.week,
        startDate: r.startDate,
        endDate: r.endDate,
        'REVISION DATE': r.revisionDate || '',
        personResponsible: r.personResponsible || 'civil',
        remark: r.remark,
        uploads: r.uploads,
        status: r.status,
        finalRemark: r.finalRemark,
        doer: userEmail || 'Dashboard User',
      }));

      const res = await addTasks(tasksToSubmit);
      const isSuccess = res.status === 'success' || res.success === true;
      if (isSuccess) {
        if (addRecentTask) {
          addRecentTask(tasksToSubmit.map(t => ({
            'PROJECT ID': t.projectId,
            'PROJECT NAME': t.projectName,
            'CATEGORY': t.category,
            'TASK': t.task,
            'week': t.week,
            'START DATE': t.startDate,
            'END DATE': t.endDate,
            'REVISION DATE': t['REVISION DATE'],
            'PERSON RESPONSIBLE': t.personResponsible,
            'REMARK': t.remark,
            'STATUS': t.status,
            'DOER': t.doer,
            'TASK UPLOADS': JSON.stringify(t.uploads || [])
          })));
        }
        setStatusMessage({ type: 'success', text: 'All tasks added to Google Sheet successfully!' });
        setRows([createEmptyRow(globalProject, globalWeek, globalResponsible)]); // Reset form
        onSuccess();
      } else {
        throw new Error(res.message || 'Failed to sync to Google Spreadsheet');
      }
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', text: err.message || 'Network error sync failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleBulkSubmit} className="space-y-6">
      {/* Visual Header helpers */}
      <div className="rounded-xl border border-blue-150 bg-blue-50/50 p-4">
        <div className="flex gap-3">
          <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-blue-900">Task Bulk Accelerator Panel</h3>
            <p className="text-xs text-blue-700 mt-1 leading-relaxed">
              Use the Global defaults selector below to auto-fill Projects, Weeks, or Supervisors for all rows instantly. Each row compiles separately, allowing fast editing prior to synchronizing with Sheets.
            </p>
          </div>
        </div>
      </div>

      {/* Global Defaults Fast Selector */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs">
        <span className="text-2xs font-extrabold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded">
          Row Auto-Fill Helper
        </span>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Set Global Project</label>
            <select
              value={globalProject}
              onChange={(e) => applyGlobalProject(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 px-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
            >
              <option value="">-- Apply Project To All Rows --</option>
              {projects.map((proj) => (
                <option key={proj.projectId} value={proj.projectId}>
                  {proj.projectName || proj.projectId}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Set Global Week Calendar</label>
            <select
              value={globalWeek}
              onChange={(e) => applyGlobalWeek(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 px-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition font-bold text-indigo-950"
            >
              <option value="">-- Apply Week To All Rows --</option>
              {Object.keys(weeks).map((wkKey) => (
                <option key={wkKey} value={wkKey}>
                  {wkKey} ({weeks[wkKey].start} to {weeks[wkKey].end})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Set Global Supervisor</label>
            <input
              type="text"
              placeholder="e.g. Suraj Ubhare"
              value={globalResponsible}
              onChange={(e) => {
                setGlobalResponsible(e.target.value);
                setRows(prev => prev.map(r => ({ ...r, personResponsible: e.target.value })));
              }}
              className="w-full rounded-lg border border-gray-300 py-2 px-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
            />
          </div>
        </div>
      </div>

      {/* Dynamic Task cards list */}
      <div className="space-y-4">
        {rows.map((row, index) => (
          <div
            key={row.rowId}
            className="rounded-xl border border-gray-200 bg-white p-3.5 sm:px-4 sm:py-4 shadow-sm relative group hover:border-gray-300 transition"
          >
            {/* Row index flag & Delete button */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                  {index + 1}
                </span>
                <span className="text-xs font-bold text-gray-600 uppercase">
                  Planning Row Details
                </span>
              </div>

              <button
                type="button"
                onClick={() => removeRowAt(row.rowId)}
                className="flex items-center gap-1.5 rounded-lg text-xs font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 transition cursor-pointer"
                title="Delete Row"
              >
                <Trash2 className="h-4 w-4" />
                <span>Remove Row</span>
              </button>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Project Selection */}
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Project Name *</label>
                <select
                  value={row.projectId}
                  onChange={(e) => updateField(row.rowId, 'projectId', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 px-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Select Project</option>
                  {projects.map(p => (
                    <option key={p.projectId} value={p.projectId}>{p.projectName}</option>
                  ))}
                </select>
                {row.projectId && (
                  <p className="mt-1 text-[10px] text-indigo-600 font-bold">
                    UNIQ ID: {row.projectId}
                  </p>
                )}
              </div>

              {/* Task Title */}
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Task Description *</label>
                <input
                  type="text"
                  placeholder="e.g. Master bedroom flooring completion"
                  value={row.task}
                  onChange={(e) => updateField(row.rowId, 'task', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2 px-3 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Category</label>
                <select
                  value={row.category}
                  onChange={(e) => updateField(row.rowId, 'category', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 px-2.5 text-sm outline-none"
                >
                  <option value="WORK">WORK</option>
                  <option value="MATERIAL">MATERIAL</option>
                  <option value="SELECTION">SELECTION</option>
                  <option value="DRAWING">DRAWING</option>
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Start Date</label>
                <input
                  type="date"
                  value={row.startDate}
                  onChange={(e) => updateField(row.rowId, 'startDate', e.target.value)}
                  className="w-full rounded-lg border border-slate-400 py-2 px-2.5 text-sm font-extrabold text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">End Date</label>
                <input
                  type="date"
                  value={row.endDate}
                  onChange={(e) => updateField(row.rowId, 'endDate', e.target.value)}
                  className="w-full rounded-lg border border-slate-400 py-2 px-2.5 text-sm font-extrabold text-red-750 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                />
              </div>

              {/* Revision Date */}
              <div>
                <label className="text-xs font-bold text-indigo-600 block mb-1">Revision Date</label>
                <input
                  type="date"
                  value={row.revisionDate || ''}
                  onChange={(e) => updateField(row.rowId, 'revisionDate', e.target.value)}
                  className="w-full rounded-lg border border-indigo-400 py-2 px-2.5 text-sm bg-indigo-50/20 text-indigo-900 focus:ring-1 focus:ring-indigo-500 font-extrabold outline-none"
                />
              </div>

              {/* Person Responsible */}
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Person Responsible</label>
                <input
                  type="text"
                  placeholder="e.g. Suraj Ubhare"
                  value={row.personResponsible}
                  onChange={(e) => updateField(row.rowId, 'personResponsible', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2 px-3 text-sm focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Initial Status */}
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Initial Status</label>
                {(() => {
                  const getWeekNum = (wStr: string): number => {
                    const match = String(wStr || '').match(/\d+/);
                    return match ? parseInt(match[0], 10) : 0;
                  };
                  const weekNum = getWeekNum(row.week);
                  const isRowStatusLocked = (weekNum >= 22) && (row.uploads || []).length === 0;

                  return (
                    <>
                      <select
                        value={isRowStatusLocked ? 'NOT DONE' : row.status}
                        disabled={isRowStatusLocked}
                        onChange={(e) => updateField(row.rowId, 'status', e.target.value)}
                        className={`w-full rounded-lg border py-2 px-2.5 text-sm outline-none ${
                          isRowStatusLocked 
                            ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed' 
                            : 'bg-white border-gray-300 text-gray-800'
                        }`}
                        title={isRowStatusLocked ? 'Upload is mandatory before selecting task status' : 'Select Initial Status'}
                      >
                        <option value="NOT DONE">NOT DONE</option>
                        <option value="PARTIALLY DONE">PARTIALLY DONE</option>
                        <option value="DONE">DONE</option>
                      </select>
                      {isRowStatusLocked && (
                        <p className="mt-1 text-[10px] font-bold text-red-500">
                          🔒 Status Locked: Upload file first
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Remark Area */}
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">User Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Optional site notes..."
                  value={row.remark}
                  onChange={(e) => updateField(row.rowId, 'remark', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              
              {/* Individual Row Upload Area */}
              <div>
                <UploadBox
                  projectId={row.projectId || 'GENERAL'}
                  label="Attachments / Photo uploads for this single task"
                  onUploadsChange={(uploadedFiles) => updateField(row.rowId, 'uploads', uploadedFiles)}
                  existingUploads={row.uploads}
                  maxFiles={3}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Helper trigger row counters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-gray-200 pt-5">
        <button
          type="button"
          onClick={appendNewRow}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 shadow-xs cursor-pointer"
        >
          <Plus className="h-4.5 w-4.5" />
          <span>Add Another Entry Row</span>
        </button>

        <div className="flex items-center gap-3">
          {statusMessage && (
            <div className={`rounded-lg px-4 py-2.5 text-xs font-semibold ${
              statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-rose-50 text-rose-800 border border-rose-100'
            }`}>
              {statusMessage.text}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving {rows.length} Rows...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>Save All Entries to Sheet</span>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
