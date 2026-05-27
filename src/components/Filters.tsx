import React from 'react';
import { Search, X, Loader2, Calendar, Target, ShieldCheck, FileCheck2 } from 'lucide-react';
import { weeks } from '../utils/weeks';
import { CANONICAL_CATEGORIES } from '../utils/categoryUtils';

interface ProjectType {
  projectId: string;
  projectName: string;
}

interface FiltersProps {
  selectedWeek: string;
  setSelectedWeek: (week: string) => void;
  selectedStatus: string;
  setSelectedStatus: (status: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  selectedProject: string;
  setSelectedProject: (projectId: string) => void;
  selectedResponsible: string;
  setSelectedResponsible: (resp: string) => void;
  selectedUploadStatus: string;
  setSelectedUploadStatus: (status: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  projects: ProjectType[];
  isLoadingProjects?: boolean;
  totalTasksFiltered: number;
  completedTasksFiltered: number;
}

const STATUS_VALUES = ['DONE', 'NOT DONE', 'PARTIALLY DONE'];
const SUPERVISORS = ['Suraj Ubhare', 'Mangesh Kumbhar', 'Ganesh'];

export default function Filters({
  selectedWeek,
  setSelectedWeek,
  selectedStatus,
  setSelectedStatus,
  selectedCategory,
  setSelectedCategory,
  selectedProject,
  setSelectedProject,
  selectedResponsible,
  setSelectedResponsible,
  selectedUploadStatus,
  setSelectedUploadStatus,
  searchTerm,
  setSearchTerm,
  projects,
  isLoadingProjects = false,
  totalTasksFiltered,
  completedTasksFiltered,
}: FiltersProps) {
  
  const hasActiveFilters = 
    selectedWeek !== '' || 
    selectedStatus !== '' || 
    selectedCategory !== '' || 
    selectedProject !== '' || 
    selectedResponsible !== '' || 
    selectedUploadStatus !== '' || 
    searchTerm !== '';

  const handleClear = () => {
    setSelectedWeek('');
    setSelectedStatus('');
    setSelectedCategory('');
    setSelectedProject('');
    setSelectedResponsible('');
    setSelectedUploadStatus('');
    setSearchTerm('');
  };

  // Calculate percentage progress of currently filtered set
  const progressPercent = totalTasksFiltered > 0 
    ? Math.round((completedTasksFiltered / totalTasksFiltered) * 100) 
    : 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-xs">
      <div className="flex flex-col gap-3">

        {/* Row 1: Responsive Grid for Select Dropdowns */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          
          {/* Project Dropdown */}
          <div className="flex flex-col">
            <label htmlFor="filter-project" className="mb-1 text-[10px] font-black uppercase tracking-wider text-gray-400">
              Project Name
            </label>
            <div className="relative">
              <select
                id="filter-project"
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full rounded-lg border border-gray-350 bg-white py-1 px-2 text-xs text-gray-800 shadow-3xs outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer text-ellipsis overflow-hidden"
              >
                <option value="">All Projects</option>
                {projects.map((proj) => (
                  <option key={proj.projectId} value={proj.projectId}>
                    {proj.projectName || proj.projectId}
                  </option>
                ))}
              </select>
              {isLoadingProjects && (
                <div className="absolute top-1/2 right-2 -translate-y-1/2">
                  <Loader2 className="h-3 w-3 animate-spin text-indigo-500" />
                </div>
              )}
            </div>
          </div>

          {/* Week Dropdown */}
          <div className="flex flex-col">
            <label htmlFor="filter-week" className="mb-1 text-[10px] font-black uppercase tracking-wider text-gray-400">
              Planning Week
            </label>
            <select
              id="filter-week"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="w-full rounded-lg border border-gray-350 bg-white py-1 px-2 text-xs text-gray-800 shadow-3xs outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="">All Weeks</option>
              {Object.keys(weeks).map((wkKey) => (
                <option key={wkKey} value={wkKey}>
                  {wkKey} ({weeks[wkKey].start} to {weeks[wkKey].end})
                </option>
              ))}
            </select>
          </div>

          {/* Category Dropdown */}
          <div className="flex flex-col">
            <label htmlFor="filter-category" className="mb-1 text-[10px] font-black uppercase tracking-wider text-gray-400">
              Category
            </label>
            <select
              id="filter-category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-350 bg-white py-1 px-2 text-xs text-gray-800 shadow-3xs outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="">All Categories</option>
              {CANONICAL_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Status Dropdown */}
          <div className="flex flex-col">
            <label htmlFor="filter-status" className="mb-1 text-[10px] font-black uppercase tracking-wider text-gray-400">
              Status Order
            </label>
            <select
              id="filter-status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full rounded-lg border border-gray-350 bg-white py-1 px-2 text-xs text-gray-800 shadow-3xs outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="">All Statuses</option>
              {STATUS_VALUES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
              <option value="OVERDUE">⚠️ OVERDUE</option>
            </select>
          </div>

          {/* Upload Status Dropdown */}
          <div className="flex flex-col">
            <label htmlFor="filter-uploads" className="mb-1 text-[10px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1">
              <FileCheck2 className="h-2.5 w-2.5 text-indigo-500" />
              <span>Uploads Status</span>
            </label>
            <select
              id="filter-uploads"
              value={selectedUploadStatus}
              onChange={(e) => setSelectedUploadStatus(e.target.value)}
              className="w-full rounded-lg border border-gray-350 bg-white py-1 px-2 text-xs text-gray-800 shadow-3xs outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="">All Upload States</option>
              <option value="uploaded">Uploaded (Docs Attached)</option>
              <option value="pending">Pending Upload (No Docs)</option>
            </select>
          </div>

        </div>

        {/* Clear Filters Button Row (Only if something is filter active) */}
        {hasActiveFilters && (
          <div className="flex justify-end border-t border-gray-100 pt-2">
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 hover:bg-red-100 transition cursor-pointer"
            >
              <X className="h-3 w-3" />
              <span>Reset Filters</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
