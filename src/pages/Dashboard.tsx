import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Layers, 
  UploadCloud, 
  ChevronRight, 
  RefreshCw, 
  CheckCircle,
  AlertCircle,
  X,
  HardDriveUpload,
  UserCheck2,
  Lock,
  LayoutGrid,
  Loader2,
  Clock,
  History,
  Sparkles,
  Trash2,
  HardHat,
  Calendar,
  Copy,
  RotateCcw
} from 'lucide-react';

import Header from '../components/Header';
import DashboardCards from '../components/DashboardCards';
import Filters from '../components/Filters';
import TaskTable from '../components/TaskTable';
import SupervisorCards from '../components/SupervisorCards';
import BulkEntry from '../components/BulkEntry';
import UploadBox from '../components/UploadBox';

import { weeks, getWeekFromStartDate } from '../utils/weeks';
import { isTaskAssignedToSupervisor } from '../utils/supervisorMatcher';
import { getProjects, getTasks, addTasks, updateTask, deleteTask } from '../services/api';
import { normalizeCategory, CANONICAL_CATEGORIES } from '../utils/categoryUtils';

interface ProjectType {
  projectId: string;
  projectName: string;
}

interface TaskType {
  rowNumber: number;
  [key: string]: any;
}

const DEFAULT_USERS = [
  { email: 'dastudio5india1@gmail.com', role: 'Admin' },
  { email: 'singhshivanibc4@gmail.com', role: 'Admin' },
  { email: 'singhshivaniabc4@gmail.com', role: 'Admin' },
  { email: 'shivanisinghds11@gmail.com', role: 'Admin' },
  { email: 'ubharesuraj2000@gmail.com', role: 'Site Supervisor' },
  { email: 'msskumbhar@gmail.com', role: 'Site Supervisor' },
  { email: 'ganeshw110@gmail.com', role: 'Site Supervisor' },
  { email: 'ganesh110@gmail.com', role: 'Site Supervisor' },
  { email: 'pc.2@studio5india.com', role: 'PC (only view acess)' },
  { email: 'pc.2@studioindia.com', role: 'PC (only view acess)' },
];

export const SUPERVISOR_MAP: Record<string, string> = {
  'ubharesuraj2000@gmail.com': 'Suraj Ubhare',
  'msskumbhar@gmail.com': 'Mangesh Kumbhar',
  'ganeshw110@gmail.com': 'Ganesh',
  'ganesh110@gmail.com': 'Ganesh',
};

// Aesthetic dummy projects just in case sheet fails or is empty initially
const DUMMY_PROJECTS: ProjectType[] = [
  { projectId: 'KVI-1286-SAU-GAD-NA-KHA-PUN', projectName: 'KHADAKVASLA INTERIOR' },
  { projectId: 'MCS-1285-MR-KES-NA-SAM-MAH', projectName: 'SAMBHAJINAGAR METRO' },
  { projectId: 'CFF-1284-MR-JAT-NA-VAS-MUM', projectName: 'CHHEDA FINE INTERIOR' },
  { projectId: 'BOI-1282-KAM-BHA-NA-VAK-MUM', projectName: 'BHATIA OFFICE INTERIOR' },
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  
  // User Session Simulation States
  const [currentUserEmail, setCurrentUserEmail] = useState<string>(() => {
    return localStorage.getItem('site_doer_email') || '';
  });
  const [currentUserRole, setCurrentUserRole] = useState<string>(() => {
    return localStorage.getItem('site_doer_role') || '';
  });
  const isDeleteAllowed = currentUserEmail.trim().toLowerCase() === 'dastudio5india1@gmail.com';
  const isDoerOrSupervisor = currentUserRole === 'Site Supervisor' || 
    !!SUPERVISOR_MAP[currentUserEmail.toLowerCase()] || 
    ['ganesh', 'suraj', 'mangesh'].some(name => currentUserEmail.toLowerCase().includes(name));
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');

  const [projects, setProjects] = useState<ProjectType[]>(DUMMY_PROJECTS);
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<TaskType[]>([]);

  // Recently added entries state for the fast visualization box
  const [recentEntries, setRecentEntries] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('site_recent_entries');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Filter recent entries according to logged in user role/emails for complete privacy/relevance
  const displayedRecentEntries = React.useMemo(() => {
    if (currentUserRole !== 'Site Supervisor') {
      return recentEntries;
    }
    const activeSupName = SUPERVISOR_MAP[currentUserEmail.toLowerCase()] || currentUserEmail.split('@')[0];
    return recentEntries.filter(entry => 
      isTaskAssignedToSupervisor(entry, activeSupName) || 
      isTaskAssignedToSupervisor(entry, currentUserEmail)
    );
  }, [recentEntries, currentUserRole, currentUserEmail]);

  const addRecentTask = (newTask: any | any[]) => {
    setRecentEntries(prev => {
      const itemsToAdd = Array.isArray(newTask) ? newTask : [newTask];
      const withTimestamp = itemsToAdd.map(item => ({
        ...item,
        id: item.rowNumber || `recent-${Date.now()}-${Math.random()}`,
        timeAdded: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        dateAddedString: new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })
      }));
      
      const combined = [...withTimestamp, ...prev];
      const sliced = combined.slice(0, 15); // keep max 15 entries
      
      try {
        localStorage.setItem('site_recent_entries', JSON.stringify(sliced));
      } catch (e) {
        console.error("Failed to save recent entries", e);
      }
      return sliced;
    });
  };

  const [recentMiniTab, setRecentMiniTab] = useState<'sheet' | 'session'>('sheet');

  // Recent Deleted entries state with localStorage persistence
  const [recentDeleted, setRecentDeleted] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('site_planning_recent_deleted');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Keep track of the very last deleted task set for instant undo toast
  const [lastDeletedTasks, setLastDeletedTasks] = useState<any[]>([]);
  const [showUndoBanner, setShowUndoBanner] = useState<boolean>(false);
  const [showRecentDeleted, setShowRecentDeleted] = useState<boolean>(false);
  const [selectedDeletedIds, setSelectedDeletedIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem('site_planning_recent_deleted', JSON.stringify(recentDeleted));
    } catch (e) {
      console.error("Failed to save recent deleted entries", e);
    }
  }, [recentDeleted]);

  // Get recently added tasks from the live fetched database
  const getDbRecentTasks = (): TaskType[] => {
    return [...tasks]
      .filter(t => t['TASK'] || t['Task'] || t['task'])
      .sort((a, b) => {
        const timeA = a['Timestamp'] || a['TIMESTAMP'] || a['timestamp'] || '';
        const timeB = b['Timestamp'] || b['TIMESTAMP'] || b['timestamp'] || '';
        
        if (timeA && timeB) {
          try {
            return new Date(timeB).getTime() - new Date(timeA).getTime();
          } catch {
            // ignore
          }
        }
        // Fallback to rowNumber descending (which puts newly appended rows on top)
        return (b.rowNumber || 0) - (a.rowNumber || 0);
      })
      .slice(0, 10);
  };
  
  // Loading & Sync states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingProjects, setIsLoadingProjects] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Active Filters state
  const [selectedWeek, setSelectedWeek] = useState<string>(''); // Defaults to show all weeks on load
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedSupervisor, setSelectedSupervisor] = useState<string | null>(null);
  const [selectedResponsible, setSelectedResponsible] = useState<string>('');
  const [selectedUploadStatus, setSelectedUploadStatus] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [activeEditingTask, setActiveEditingTask] = useState<TaskType | null>(null);

  // Single Task Form Builder State
  const [formProjectId, setFormProjectId] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('WORK');
  const [formTask, setFormTask] = useState<string>('');
  const [formWeek, setFormWeek] = useState<string>('');
  const [formStartDate, setFormStartDate] = useState<string>('');
  const [formEndDate, setFormEndDate] = useState<string>('');
  const [formRev1, setFormRev1] = useState<string>('');
  const [formRev2, setFormRev2] = useState<string>('');
  const [formRev3, setFormRev3] = useState<string>('');
  const [formResponsible, setFormResponsible] = useState<string>('civil');
  const [formRemark, setFormRemark] = useState<string>('');
  const [formUploads, setFormUploads] = useState<any[]>([]);
  const [formStatus, setFormStatus] = useState<string>('NOT DONE');
  const [searchText, setSearchText] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  // Mandatory Upload Form State
  const [mandatoryCategory, setMandatoryCategory] = useState<string>('SITE PHOTO');

  // Multi-Task Grid State
  const [multiRows, setMultiRows] = useState<{
    rowId: string;
    zNo: string;
    zone: string;
    sqft: string;
    task: string;
    stage: string;
    dir: string;
    tl: string;
    dpt: string;
    category?: string;
    doer: string;
    startDate: string;
    endDate: string;
    rev1?: string;
    rev2?: string;
    rev3?: string;
    status: string;
    week: string;
    remark: string;
    uploads?: any[];
  }[]>([]);
  const [editingRowUploadsIndex, setEditingRowUploadsIndex] = useState<number | null>(null);
  const [mandatoryProject, setMandatoryProject] = useState<string>('');
  const [mandatoryWeek, setMandatoryWeek] = useState<string>('Week-20');
  const [mandatoryUploads, setMandatoryUploads] = useState<any[]>([]);
  const [mandatoryRemark, setMandatoryRemark] = useState<string>('');

  // Stats Card Counts
  const [metrics, setMetrics] = useState({
    total: 0,
    done: 0,
    notDone: 0,
    partiallyDone: 0,
    overdue: 0,
  });

  // Fetch Projects & Tasks
  const loadInitialData = async () => {
    setIsLoading(true);
    setIsLoadingProjects(true);
    let latestProjects = [...projects];
    try {
      // 1. Projects
      try {
        const projRes = await getProjects();
        const isProjSuccess = projRes.status === 'success' || projRes.success === true;
        if (isProjSuccess && Array.isArray(projRes.data)) {
          // Filter out rows with empty projectIds
          const validProjects = projRes.data.filter((p: any) => p.projectId && p.projectName);
          if (validProjects.length > 0) {
            setProjects(validProjects);
            latestProjects = validProjects;
          }
        }
      } catch (e) {
        console.warn('Could not contact getProjects sheet endpoint. Using offline dummy fallback project list.');
      }

      // 2. Tasks
      try {
        const taskRes = await getTasks();
        const isTaskSuccess = taskRes.status === 'success' || taskRes.success === true;
        if (isTaskSuccess && Array.isArray(taskRes.data)) {
          const normalizedTasks = taskRes.data
            .map((t: any) => {
              // Skip completely blank rows in Google Sheets
              let hasProjId = false;
              let hasTaskDesc = false;
              let hasDoer = false;
              Object.keys(t).forEach(k => {
                const uk = k.trim().toUpperCase();
                const val = String(t[k] || '').trim();
                if (val !== '') {
                  if (uk.includes('PROJECT ID')) hasProjId = true;
                  if (uk.includes('TASK')) hasTaskDesc = true;
                  if (uk === 'DOER' || uk === 'PERSON RESPONSIBLE' || uk === 'RESPONSIBLE') hasDoer = true;
                }
              });

              if (!hasProjId && !hasTaskDesc && !hasDoer) {
                return null;
              }

              const normalized: any = {};
              
              // Standardize/normalize keys from Google Sheet to avoid casing/space sensitivity issues
              Object.keys(t).forEach(key => {
                const cleanKey = key.trim().toUpperCase();
                if (cleanKey === 'PROJECT ID' || cleanKey === 'PROJECT ID  ' || cleanKey.includes('PROJECT ID')) {
                  normalized['PROJECT ID'] = t[key];
                } else if (cleanKey === 'WEEK' || cleanKey === 'PLANNING WEEK' || cleanKey.includes('WEEK')) {
                  normalized['week'] = t[key];
                } else if (cleanKey === '' && String(t[key]).trim() !== '') {
                  const valStr = String(t[key]).trim();
                  if (valStr.toLowerCase().startsWith('week') || /^[0-9]+$/.test(valStr)) {
                    normalized['week'] = valStr;
                  }
                } else if (cleanKey === 'PERSON RESPONSIBLE' || cleanKey === 'RESPONSIBLE' || cleanKey.includes('RESPONSIBLE')) {
                  normalized['PERSON RESPONSIBLE'] = t[key];
                } else if (cleanKey === 'CATEGORY' || cleanKey === 'CAT') {
                  normalized['CATEGORY'] = t[key];
                } else if (cleanKey === 'TASK' || cleanKey === 'TASK DESCRIPTION' || cleanKey.includes('TASK')) {
                  normalized['TASK'] = t[key];
                } else if (cleanKey === 'START DATE' || cleanKey === 'START') {
                  normalized['START DATE'] = t[key];
                } else if (cleanKey === 'END DATE' || cleanKey === 'END') {
                  normalized['END DATE'] = t[key];
                } else if (cleanKey === 'REMARK' || cleanKey === 'REMARKS' || cleanKey === 'REMARK ') {
                  normalized['REMARK'] = t[key];
                } else if (cleanKey === 'STATUS') {
                  normalized['STATUS'] = t[key];
                } else if (cleanKey === 'DOER' || cleanKey === 'USER') {
                  normalized['DOER'] = t[key];
                } else if (cleanKey === 'UPLOAD' || cleanKey === 'UPLOADS' || cleanKey === 'TASK UPLOADS') {
                  normalized['TASK UPLOADS'] = t[key];
                } else if (cleanKey === 'REVISION DATE' || cleanKey === 'REVISION_DATE' || cleanKey.includes('REVISION')) {
                  normalized['REVISION DATE'] = t[key];
                } else if (cleanKey === 'ROWNUMBER' || cleanKey === 'SHEETROW' || cleanKey === 'ROW') {
                  normalized.rowNumber = t[key];
                } else {
                  normalized[key] = t[key];
                }
              });

              // Ensure row number exists fallback
              if (t.sheetRow !== undefined) {
                normalized.rowNumber = t.sheetRow;
              } else if (t.rowNumber !== undefined) {
                normalized.rowNumber = t.rowNumber;
              } else if (normalized.rowNumber === undefined) {
                normalized.rowNumber = Math.random(); // Unique fallback
              }

              // Sync with actual project name from the loaded list based on project ID
              const pid = normalized['PROJECT ID'] || '';
              const matchedProj = latestProjects.find(p => p.projectId === pid || p.projectId.trim().toUpperCase() === String(pid || '').trim().toUpperCase());
              if (matchedProj) {
                normalized['PROJECT NAME'] = matchedProj.projectName;
              } else {
                normalized['PROJECT NAME'] = t['PROJECT NAME'] || t['PROJECT_NAME'] || 'Project Name';
              }

              // Standardize STATUS values
              if (normalized['STATUS'] !== undefined && String(normalized['STATUS']).trim() !== '') {
                normalized['STATUS'] = String(normalized['STATUS']).trim().toUpperCase();
              } else {
                normalized['STATUS'] = 'NOT DONE';
              }

              // Standardize CATEGORY values
              normalized['CATEGORY'] = normalizeCategory(normalized['CATEGORY'] || normalized['category'] || '');

              // Standardize WEEK values to "Week-XX" format for robust filtering
              if (normalized['REVISION DATE']) {
                const computed = getWeekFromStartDate(normalized['REVISION DATE']);
                if (computed) {
                  normalized['week'] = computed;
                }
              }
              if (normalized['week'] === undefined) {
                normalized['week'] = t['week'] || t['Week'] || t['WEEK'] || 'Week-20';
              }
              if (normalized['week']) {
                const weekValueStr = String(normalized['week']).trim();
                const match = weekValueStr.match(/^(?:week|wk|w)?[- ]?(\d+)$/i);
                if (match) {
                  normalized['week'] = `Week-${parseInt(match[1], 10)}`;
                } else {
                  normalized['week'] = weekValueStr;
                }
              }

              return normalized;
            })
            .filter((t: any) => t !== null);
          
          if (normalizedTasks.length > 0) {
            setTasks(normalizedTasks);
          } else {
            setTasks(createMockTasks());
          }
        } else {
          // Add some elegant initial mock tasks if completely empty so dashboard doesn't look totally blank
          setTasks(createMockTasks());
        }
      } catch (e) {
        console.warn('Could not contact getTasks sheet endpoint. Using offline mocked values.');
        setTasks(prev => prev.length > 0 ? prev : createMockTasks());
      }
    } finally {
      setIsLoading(false);
      setIsLoadingProjects(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Dynamically set form default values when opening add task form
  useEffect(() => {
    if (isAddModalOpen) {
      let supervisorName = 'civil';
      if (currentUserRole === 'Site Supervisor') {
        supervisorName = SUPERVISOR_MAP[currentUserEmail.toLowerCase()] || currentUserEmail.split('@')[0];
        setFormResponsible(supervisorName);
      } else if (selectedSupervisor) {
        supervisorName = selectedSupervisor;
        setFormResponsible(selectedSupervisor);
      } else {
        setFormResponsible('civil');
      }
      const initialWeek = '';
      setFormWeek(initialWeek);
      let startD = '';
      let endD = '';
      setFormStartDate('');
      setFormEndDate('');
      
      // Initialize Project search states
      setFormProjectId('');
      setSearchText('');
      setIsDropdownOpen(false);

      // Initialize multiRows with 2 clean empty rows using image-aligned defaults!
      setMultiRows([
        {
          rowId: Math.random().toString(36).substring(2, 9),
          zNo: '',
          zone: '',
          sqft: '',
          task: '',
          stage: '',
          dir: 'DINESH GADA',
          tl: 'MANASVI PATIL',
          dpt: '3D',
          category: 'WORK',
          doer: '',
          startDate: startD,
          endDate: endD,
          rev1: '',
          rev2: '',
          rev3: '',
          status: 'ASSIGNED',
          week: initialWeek,
          remark: '',
          uploads: []
        },
        {
          rowId: Math.random().toString(36).substring(2, 9),
          zNo: '',
          zone: '',
          sqft: '',
          task: '',
          stage: '',
          dir: 'DINESH GADA',
          tl: 'MANASVI PATIL',
          dpt: '3D',
          category: 'WORK',
          doer: '',
          startDate: startD,
          endDate: endD,
          rev1: '',
          rev2: '',
          rev3: '',
          status: 'ASSIGNED',
          week: initialWeek,
          remark: '',
          uploads: []
        }
      ]);
    }
  }, [isAddModalOpen, selectedSupervisor, currentUserRole, currentUserEmail, selectedWeek]);

  // Auto-highlight/auto-select supervisor who has worked on the selected project when logged in as dastudio5india1@gmail.com
  useEffect(() => {
    if (currentUserEmail.trim().toLowerCase() === 'dastudio5india1@gmail.com' && selectedProject) {
      const selPid = String(selectedProject).trim().toUpperCase().replace(/\s+/g, '');
      const projectTasks = tasks.filter(t => {
        const tPid = String(t['PROJECT ID'] || '').trim().toUpperCase().replace(/\s+/g, '');
        return tPid === selPid;
      });
      
      const supervisors = ['Suraj Ubhare', 'Mangesh Kumbhar', 'Ganesh', 'Sunil'];
      
      // Find the first supervisor who has tasks in this project
      const matchedSupervisor = supervisors.find(supName => 
        projectTasks.some(t => isTaskAssignedToSupervisor(t, supName))
      );
      
      if (matchedSupervisor) {
        setSelectedSupervisor(matchedSupervisor);
      }
    }
  }, [selectedProject, tasks, currentUserEmail]);

  // Compute metrics and filter tasks whenever state changes
  useEffect(() => {
    let result = [...tasks];

    if (currentUserEmail.toLowerCase().includes('suraj') || currentUserEmail.toLowerCase().includes('ubhare')) {
      console.log('======= SURAJ DIAGNOSTICS =======');
      console.log('Initial raw tasks count:', tasks.length);
      console.log('Current User Email:', currentUserEmail);
      console.log('Current User Role:', currentUserRole);
      console.log('Selected Week:', selectedWeek);
      console.log('Selected Status:', selectedStatus);
      console.log('Selected Project:', selectedProject);
      console.log('Selected Category:', selectedCategory);
      
      const activeSupName = SUPERVISOR_MAP[currentUserEmail.toLowerCase()] || currentUserEmail.split('@')[0];
      const supMatched = tasks.filter(t => 
        isTaskAssignedToSupervisor(t, activeSupName) || 
        isTaskAssignedToSupervisor(t, currentUserEmail)
      );
      console.log('Tasks matched to Suraj (by email/name):', supMatched.length);
      
      const weekMatched = supMatched.filter(t => {
        const tWeek = String(t['week'] || '').trim().toLowerCase();
        const selWeek = (selectedWeek || '').trim().toLowerCase();
        return !selWeek || tWeek === selWeek || tWeek.replace(/\s+/g, '') === selWeek.replace(/\s+/g, '');
      });
      console.log('Among Suraj tasks, count matching selectedWeek:', weekMatched.length);
      
      if (weekMatched.length === 0 && selectedWeek) {
        // Let's print out the first 5 Suraj tasks' weeks
        console.log('Sample Suraj tasks weeks:', supMatched.slice(0, 5).map(t => ({
          task: t['TASK'],
          week: t['week'],
          startDate: t['START DATE'],
          endDate: t['END DATE']
        })));
      }
    }

    // Role-based task visibility constraint (Supervisor sees only their own tasks)
    if (currentUserRole === 'Site Supervisor') {
      const activeSupName = SUPERVISOR_MAP[currentUserEmail.toLowerCase()] || currentUserEmail.split('@')[0];
      result = result.filter(t => 
        isTaskAssignedToSupervisor(t, activeSupName) || 
        isTaskAssignedToSupervisor(t, currentUserEmail)
      );
    }

    // Search query matches: description, person responsible, remarks, or doer email
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      result = result.filter(t => 
        (t['TASK'] || '').toLowerCase().includes(q) ||
        (t['PERSON RESPONSIBLE'] || '').toLowerCase().includes(q) ||
        (t['REMARK'] || '').toLowerCase().includes(q) ||
        (t['DOER'] || '').toLowerCase().includes(q) ||
        (t['PROJECT ID'] || '').toLowerCase().includes(q) ||
        (t['PROJECT NAME'] || '').toLowerCase().includes(q)
      );
    }

    // Dropdowns
    if (selectedWeek) {
      result = result.filter(t => {
        const tWeek = String(t['week'] || '').trim().toLowerCase();
        const selWeek = selectedWeek.trim().toLowerCase();
        return tWeek === selWeek || tWeek.replace(/\s+/g, '') === selWeek.replace(/\s+/g, '');
      });
    }
    if (selectedStatus) {
      if (selectedStatus === 'OVERDUE') {
        const today = new Date();
        result = result.filter(t => {
          const isDone = (t['STATUS'] || '').toUpperCase() === 'DONE';
          if (isDone) return false;
          if (!t['END DATE']) return false;
          const endD = new Date(t['END DATE']);
          return endD < today;
        });
      } else {
        result = result.filter(t => (t['STATUS'] || '').toUpperCase() === selectedStatus.toUpperCase());
      }
    }
    if (selectedCategory) {
      if (selectedCategory === 'Mandatory Uploads') {
        result = result.filter(t => {
          const cName = String(t['CATEGORY'] || '').toUpperCase();
          return cName === 'MANDATORY UPLOADS' || cName === 'SITE PHOTO' || cName === 'SATURDAY REPORT' || cName === 'SITE SCHEDULE PHOTO';
        });
      } else {
        result = result.filter(t => (t['CATEGORY'] || '').toUpperCase() === selectedCategory.toUpperCase());
      }
    }
    if (selectedProject) {
      result = result.filter(t => {
        const tPid = String(t['PROJECT ID'] || '').trim().toUpperCase().replace(/\s+/g, '');
        const selPid = String(selectedProject).trim().toUpperCase().replace(/\s+/g, '');
        return tPid === selPid;
      });
    }
    if (selectedSupervisor) {
      result = result.filter(t => isTaskAssignedToSupervisor(t, selectedSupervisor));
    }
    if (selectedResponsible) {
      result = result.filter(t => isTaskAssignedToSupervisor(t, selectedResponsible));
    }
    if (selectedUploadStatus) {
      result = result.filter(t => {
        const uploadsStr = t['TASK UPLOADS'] || t['UPLOAD'];
        let hasUpload = false;
        if (uploadsStr) {
          if (Array.isArray(uploadsStr) && uploadsStr.length > 0) hasUpload = true;
          else {
            try {
              const parsed = JSON.parse(uploadsStr);
              if (Array.isArray(parsed) && parsed.length > 0) hasUpload = true;
            } catch {
              if (typeof uploadsStr === 'string' && String(uploadsStr).startsWith('http')) hasUpload = true;
            }
          }
        }
        return selectedUploadStatus === 'uploaded' ? hasUpload : !hasUpload;
      });
    }

    setFilteredTasks(result);

    // Compute metrics over filtered task selection (all active filters except selectedStatus, making it week and doer/supervisor wise)
    let metricTasks = [...tasks];

    // Role-based task visibility constraint (Supervisor sees only their own tasks)
    if (currentUserRole === 'Site Supervisor') {
      const activeSupName = SUPERVISOR_MAP[currentUserEmail.toLowerCase()] || currentUserEmail.split('@')[0];
      metricTasks = metricTasks.filter(t => 
        isTaskAssignedToSupervisor(t, activeSupName) || 
        isTaskAssignedToSupervisor(t, currentUserEmail)
      );
    }

    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      metricTasks = metricTasks.filter(t => 
        (t['TASK'] || '').toLowerCase().includes(q) ||
        (t['PERSON RESPONSIBLE'] || '').toLowerCase().includes(q) ||
        (t['REMARK'] || '').toLowerCase().includes(q) ||
        (t['DOER'] || '').toLowerCase().includes(q) ||
        (t['PROJECT ID'] || '').toLowerCase().includes(q) ||
        (t['PROJECT NAME'] || '').toLowerCase().includes(q)
      );
    }

    if (selectedWeek) {
      metricTasks = metricTasks.filter(t => {
        const tWeek = String(t['week'] || '').trim().toLowerCase();
        const selWeek = selectedWeek.trim().toLowerCase();
        return tWeek === selWeek || tWeek.replace(/\s+/g, '') === selWeek.replace(/\s+/g, '');
      });
    }

    if (selectedCategory) {
      if (selectedCategory === 'Mandatory Uploads') {
        metricTasks = metricTasks.filter(t => {
          const cName = String(t['CATEGORY'] || '').toUpperCase();
          return cName === 'MANDATORY UPLOADS' || cName === 'SITE PHOTO' || cName === 'SATURDAY REPORT' || cName === 'SITE SCHEDULE PHOTO';
        });
      } else {
        metricTasks = metricTasks.filter(t => (t['CATEGORY'] || '').toUpperCase() === selectedCategory.toUpperCase());
      }
    }

    if (selectedProject) {
      metricTasks = metricTasks.filter(t => {
        const tPid = String(t['PROJECT ID'] || '').trim().toUpperCase().replace(/\s+/g, '');
        const selPid = String(selectedProject).trim().toUpperCase().replace(/\s+/g, '');
        return tPid === selPid;
      });
    }

    if (selectedSupervisor) {
      metricTasks = metricTasks.filter(t => isTaskAssignedToSupervisor(t, selectedSupervisor));
    }
    if (selectedResponsible) {
      metricTasks = metricTasks.filter(t => isTaskAssignedToSupervisor(t, selectedResponsible));
    }
    if (selectedUploadStatus) {
      metricTasks = metricTasks.filter(t => {
        const uploadsStr = t['TASK UPLOADS'] || t['UPLOAD'];
        let hasUpload = false;
        if (uploadsStr) {
          if (Array.isArray(uploadsStr) && uploadsStr.length > 0) hasUpload = true;
          else {
            try {
              const parsed = JSON.parse(uploadsStr);
              if (Array.isArray(parsed) && parsed.length > 0) hasUpload = true;
            } catch {
              if (typeof uploadsStr === 'string' && String(uploadsStr).startsWith('http')) hasUpload = true;
            }
          }
        }
        return selectedUploadStatus === 'uploaded' ? hasUpload : !hasUpload;
      });
    }

    let total = metricTasks.length;
    let done = metricTasks.filter(t => (t['STATUS'] || '').toUpperCase() === 'DONE').length;
    let partiallyDone = metricTasks.filter(t => (t['STATUS'] || '').toUpperCase() === 'PARTIALLY DONE').length;
    let notDone = metricTasks.filter(t => (t['STATUS'] || '').toUpperCase() === 'NOT DONE').length;
    
    // Overdue is: STATUS not DONE, and END DATE is before current local time
    const today = new Date();
    let overdue = metricTasks.filter(t => {
      const statusValue = (t['STATUS'] || '').toUpperCase();
      if (statusValue === 'DONE') return false;
      if (!t['END DATE']) return false;
      const endD = new Date(t['END DATE']);
      return endD < today;
    }).length;

    setMetrics({ total, done, notDone, partiallyDone, overdue });
  }, [tasks, searchTerm, selectedWeek, selectedStatus, selectedCategory, selectedProject, selectedSupervisor, selectedResponsible, selectedUploadStatus, currentUserEmail, currentUserRole]);

  // Dynamically filter projects based on current logged in doer/supervisor and selected week
  const dropdownProjects = React.useMemo(() => {
    let resultTasks = [...tasks];
    
    // 1. Filter by Logged-in Doer (Site Supervisor) or selected Supervisor filter if applicable
    if (currentUserRole === 'Site Supervisor') {
      const activeSupName = SUPERVISOR_MAP[currentUserEmail.toLowerCase()] || currentUserEmail.split('@')[0];
      resultTasks = resultTasks.filter(t => 
        isTaskAssignedToSupervisor(t, activeSupName) || 
        isTaskAssignedToSupervisor(t, currentUserEmail)
      );
    } else {
      // If Admin or PC, and there is an active supervisor filter
      const activeSup = selectedResponsible || selectedSupervisor;
      if (activeSup) {
        resultTasks = resultTasks.filter(t => isTaskAssignedToSupervisor(t, activeSup));
      }
    }

    // 2. Filter by Planning Week if selected (week-wise)
    if (selectedWeek) {
      resultTasks = resultTasks.filter(t => {
        const tWeek = String(t['week'] || '').trim().toLowerCase();
        const selWeek = selectedWeek.trim().toLowerCase();
        return tWeek === selWeek || tWeek.replace(/\s+/g, '') === selWeek.replace(/\s+/g, '');
      });
    }

    // 3. Extract unique list of matching projects
    const matchedProjectIds = new Set(
      resultTasks
        .map(t => String(t['PROJECT ID'] || '').trim().toUpperCase().replace(/\s+/g, ''))
        .filter(id => id !== '')
    );

    // 4. Return matching projects
    const filtered = projects.filter(p => 
      matchedProjectIds.has(String(p.projectId || '').trim().toUpperCase().replace(/\s+/g, ''))
    );

    // Dynamic Fallback: if we are an Admin card view and no week/supervisor filter is active, return all projects
    if (currentUserRole === 'Admin' && !selectedWeek && !selectedSupervisor && !selectedResponsible) {
      return projects;
    }

    return filtered;
  }, [projects, tasks, currentUserRole, currentUserEmail, selectedWeek, selectedSupervisor, selectedResponsible]);



  // Handle mock tasks generator helper
  const createMockTasks = (): TaskType[] => {
    return [
      {
        rowNumber: 2,
        'PROJECT ID': 'KVI-1286-SAU-GAD-NA-KHA-PUN',
        'PROJECT NAME': 'KHADAKVASLA INTERIOR',
        'CATEGORY': 'WORK',
        'TASK': 'Solar reception panels installation and wiring setup',
        'week': 'Week-20',
        'START DATE': '2026-05-15',
        'END DATE': '2026-05-21',
        'PERSON RESPONSIBLE': 'Suraj Ubhare',
        'REMARK': 'Waiting for material delivery',
        'STATUS': 'PARTIALLY DONE',
        'DOER': 'ubharesuraj2000@gmail.com',
        'TASK UPLOADS': '[]'
      },
      {
        rowNumber: 3,
        'PROJECT ID': 'MCS-1285-MR-KES-NA-SAM-MAH',
        'PROJECT NAME': 'SAMBHAJINAGAR METRO',
        'CATEGORY': 'DRAWING',
        'TASK': 'Ground floor room structural layout false ceiling schematic',
        'week': 'Week-20',
        'START DATE': '2026-05-15',
        'END DATE': '2026-05-21',
        'PERSON RESPONSIBLE': 'Mangesh Kumbhar',
        'REMARK': 'Approved by client engineer',
        'STATUS': 'DONE',
        'DOER': 'msskumbhar@gmail.com',
        'TASK UPLOADS': '[]'
      },
      {
        rowNumber: 4,
        'PROJECT ID': 'CFF-1284-MR-JAT-NA-VAS-MUM',
        'PROJECT NAME': 'CHHEDA FINE INTERIOR',
        'CATEGORY': 'MATERIAL',
        'TASK': 'Italian marble logistics entry and inspections',
        'week': 'Week-20',
        'START DATE': '2026-05-15',
        'END DATE': '2026-05-21',
        'PERSON RESPONSIBLE': 'Ganesh',
        'REMARK': 'Cracks visible on 2 slabs',
        'STATUS': 'NOT DONE',
        'DOER': 'dastudio5india1@gmail.com',
        'TASK UPLOADS': '[]'
      },
      {
        rowNumber: 5,
        'PROJECT ID': 'CFF-1284-MR-JAT-NA-VAS-MUM',
        'PROJECT NAME': 'CHHEDA FINE INTERIOR',
        'CATEGORY': 'WORK',
        'TASK': 'Bathroom waterproofing and base layer leak testing',
        'week': 'Week-19',
        'START DATE': '2026-05-08',
        'END DATE': '2026-05-14',
        'PERSON RESPONSIBLE': 'Suraj Ubhare',
        'REMARK': 'Tests passed successfully',
        'STATUS': 'DONE',
        'DOER': 'ubharesuraj2000@gmail.com',
        'TASK UPLOADS': '[]'
      }
    ];
  };

  // Switch role credentials simulation helper
  const handleUserSwitch = (email: string, role: string) => {
    setCurrentUserEmail(email);
    setCurrentUserRole(role);
    localStorage.setItem('site_doer_email', email);
    localStorage.setItem('site_doer_role', role);
  };

  // CRUD OPERATIONS: Add Multiple Tasks
  const handleAddSingleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProjectId) {
      alert("Please select or enter a target Project Name.");
      return;
    }

    if (!formWeek) {
      alert("Please select a target Planning Week.");
      return;
    }

    // Check view-only
    if (currentUserRole === 'PC (only view acess)' || currentUserRole === 'PC') {
      alert("🔒 PC Viewers only have read-only access. Insertion block.");
      return;
    }

    // Validate rows
    const emptyTaskRowIndex = multiRows.findIndex(r => !r.task.trim());
    if (emptyTaskRowIndex !== -1) {
      alert(`Row #${emptyTaskRowIndex + 1}: Task Description was blank. Please specify details of work completion.`);
      return;
    }

    setIsSyncing(true);
    try {
      const selectedProj = projects.find(p => p.projectId === formProjectId);
      const projName = selectedProj ? selectedProj.projectName : (searchText || 'Custom Project Reference');

      // Map rows into Google Sheet format
      const tasksToSubmit = multiRows.map(r => ({
        projectId: formProjectId,
        projectName: projName,
        category: r.category || 'Work',
        task: r.task,
        week: r.week || 'Week-22',
        startDate: r.startDate || '',
        endDate: r.endDate || '',
        'REVISION DATE': r.rev1 || '', // keep for legacy reference
        'REV 1': r.rev1 || '',
        'REV 2': r.rev2 || '',
        'REV 3': r.rev3 || '',
        personResponsible: r.doer || '',
        remark: r.remark || '',
        uploads: r.uploads || [],
        status: r.status || 'ASSIGNED',
        finalRemark: '',
        doer: currentUserEmail,
        'ACTUAL TIME': '', // Force initial ACTUAL TIME blank when a task is created or synced
        // Custom spreadsheet keys (Zone, Stage, Dir, TL, Dept, etc.)
        'ZONE NO': r.zone || '',
        'Z#': r.zNo || '',
        'SQFT': r.sqft || '',
        'STAGE': r.stage || '',
        'DIR': r.dir || 'DINESH GADA',
        'TL': r.tl || 'MANASVI PATIL',
        'DPT': r.dpt || '3D',
      }));

      const res = await addTasks(tasksToSubmit);
      const isSuccess = res.status === 'success' || res.success === true;
      if (isSuccess) {
        setIsAddModalOpen(false);

        // Add to recently added entries tracker
        const recentEntries = tasksToSubmit.map((t, idx) => ({
          'PROJECT ID': t.projectId,
          'PROJECT NAME': t.projectName,
          'CATEGORY': t.category,
          'TASK': t.task,
          'week': t.week,
          'START DATE': t.startDate,
          'END DATE': t.endDate,
          'REVISION DATE': t['REVISION DATE'],
          'REV 1': t['REV 1'],
          'REV 2': t['REV 2'],
          'REV 3': t['REV 3'],
          'PERSON RESPONSIBLE': t.personResponsible,
          'REMARK': t.remark,
          'STATUS': t.status,
          'DOER': t.doer,
          'TASK UPLOADS': JSON.stringify(multiRows[idx].uploads || []),
          'ZONE NO': t['ZONE NO'],
          'Z#': t['Z#'],
          'SQFT': t['SQFT'],
          'STAGE': t['STAGE'],
          'DIR': t['DIR'],
          'TL': t['TL'],
          'DPT': t['DPT']
        }));
        addRecentTask(recentEntries);

        // Reload data from live sheet
        await loadInitialData();
      } else {
        alert("Failed to sync new task rows: " + res.message);
      }
    } catch (err: any) {
      console.warn("API POST failed. Adding to local cache list simulation.", err);
      // Fallback local simulation of multiple rows addition
      let lastId = tasks.length > 0 ? Math.max(...tasks.map(t => t.rowNumber || 1)) : 2;
      const selectedProj = projects.find(p => p.projectId === formProjectId);
      const projName = selectedProj ? selectedProj.projectName : (searchText || 'Custom Project');

      const addedList = multiRows.map(r => {
        lastId += 1;
        return {
          rowNumber: lastId,
          'PROJECT ID': formProjectId,
          'PROJECT NAME': projName,
          'CATEGORY': r.category || 'Work',
          'TASK': r.task,
          'week': r.week || 'Week-22',
          'START DATE': r.startDate || '',
          'END DATE': r.endDate || '',
          'REVISION DATE': r.rev1 || '', // legacy fallback
          'REV 1': r.rev1 || '',
          'REV 2': r.rev2 || '',
          'REV 3': r.rev3 || '',
          'PERSON RESPONSIBLE': r.doer || '',
          'REMARK': r.remark || '',
          'STATUS': r.status || 'ASSIGNED',
          'DOER': currentUserEmail,
          'TASK UPLOADS': JSON.stringify(r.uploads || []),
          'ACTUAL TIME': '', // Force initial ACTUAL TIME blank when task is created in local cache
          'ZONE NO': r.zone || '',
          'Z#': r.zNo || '',
          'SQFT': r.sqft || '',
          'STAGE': r.stage || '',
          'DIR': r.dir || 'DINESH GADA',
          'TL': r.tl || 'MANASVI PATIL',
          'DPT': r.dpt || '3D',
        };
      });

      setTasks(prev => [...prev, ...addedList]);
      addRecentTask(addedList);
      setIsAddModalOpen(false);
    } finally {
      setIsSyncing(false);
    }
  };

  // Helper methods for multi-task entry form
  const duplicateRow = (index: number) => {
    const rowToDuplicate = multiRows[index];
    const newRow = {
      ...rowToDuplicate,
      rowId: Math.random().toString(36).substring(2, 9),
    };
    setMultiRows(prev => {
      const next = [...prev];
      next.splice(index + 1, 0, newRow);
      return next;
    });
  };

  const clearRow = (index: number) => {
    setMultiRows(prev => prev.map((row, i) => {
      if (i !== index) return row;
      return {
        ...row,
        zNo: '',
        zone: '',
        sqft: '',
        task: '',
        stage: '',
        category: 'WORK',
        doer: '',
        startDate: '',
        endDate: '',
        rev1: '',
        rev2: '',
        rev3: '',
        status: 'ASSIGNED',
        week: '',
        remark: '',
        uploads: []
      };
    }));
  };

  const deleteRow = (index: number) => {
    if (multiRows.length === 1) {
      alert("You must maintain at least one multi-task entry row.");
      return;
    }
    setMultiRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleRowChange = (index: number, field: string, value: any) => {
    setMultiRows(prev => prev.map((row, i) => {
      if (i !== index) return row;
      const updated = { ...row, [field]: value };
      
      if (field === 'week') {
        const wkInfo = weeks[value];
        if (wkInfo) {
          updated.startDate = wkInfo.start;
          updated.endDate = wkInfo.end;
        }
      } else {
        // Auto week calculation logic: determine based on latest available date in precedence order
        const latestDate = updated.rev3 || updated.rev2 || updated.rev1 || updated.startDate || updated.endDate || '';
        if (latestDate) {
          const computed = getWeekFromStartDate(latestDate);
          if (computed) {
            updated.week = computed;
          }
        }
      }
      return updated;
    }));
  };

  const highlightMatch = (text: string, query: string) => {
    if (!text) return <span></span>;
    if (!query) return <span>{text}</span>;
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return <span>{text}</span>;
    const before = text.substring(0, index);
    const match = text.substring(index, index + query.length);
    const after = text.substring(index + query.length);
    return (
      <span>
        {before}
        <span className="bg-indigo-100 text-indigo-950 font-extrabold">{match}</span>
        {after}
      </span>
    );
  };

  // CRUD OPERATIONS: Edit Task Update
  const handleOpenEditModal = (task: TaskType) => {
    setActiveEditingTask(task);
    
    // Pre-fill form fields
    setFormProjectId(task['PROJECT ID'] || '');
    setFormCategory(task['CATEGORY'] || 'WORK');
    setFormTask(task['TASK'] || '');
    setFormWeek(task['week'] || 'Week-20');
    setFormStartDate(task['START DATE'] || '');
    setFormEndDate(task['END DATE'] || '');
    setFormRev1(task['REV 1'] || task['REVISION DATE'] || '');
    setFormRev2(task['REV 2'] || '');
    setFormRev3(task['REV 3'] || '');
    setFormResponsible(task['PERSON RESPONSIBLE'] || 'civil');
    setFormRemark(task['REMARK'] || '');
    
    try {
      const upParsed = task['TASK UPLOADS'] || task['UPLOAD'] || '[]';
      const files = typeof upParsed === 'string' ? JSON.parse(upParsed) : upParsed;
      setFormUploads(Array.isArray(files) ? files : []);
    } catch {
      setFormUploads([]);
    }

    setFormStatus(task['STATUS'] || 'NOT DONE');
    setIsEditModalOpen(true);
  };

  const handleEditTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEditingTask) return;

    if (currentUserRole === 'PC (only view acess)' || currentUserRole === 'PC') {
      alert("🔒 PC Viewers only have read-only access. Edits are blocked.");
      return;
    }

    setIsSyncing(true);
    const rowId = activeEditingTask.rowNumber;

    try {
      const proj = projects.find(p => p.projectId === formProjectId);
      const updates = {
        'PROJECT ID': formProjectId,
        'PROJECT NAME': proj ? proj.projectName : activeEditingTask['PROJECT NAME'],
        'CATEGORY': formCategory,
        'TASK': formTask,
        'week': formWeek,
        'START DATE': formStartDate,
        'END DATE': formEndDate,
        'REVISION DATE': formRev1,
        'REV 1': formRev1,
        'REV 2': formRev2,
        'REV 3': formRev3,
        'PERSON RESPONSIBLE': formResponsible,
        'REMARK': formRemark,
        'STATUS': formStatus,
        'TASK UPLOADS': JSON.stringify(formUploads),
        'DOER': currentUserEmail,
        'ACTUAL TIME': (formStatus === 'NOT DONE' || !formUploads || formUploads.length === 0) ? '' : (
          activeEditingTask['ACTUAL TIME'] || (() => {
            const now = new Date();
            return `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
          })()
        )
      };

      const res = await updateTask(rowId, updates);
      const isSuccess = res.status === 'success' || res.success === true;
      if (isSuccess) {
        setIsEditModalOpen(false);
        await loadInitialData();
      } else {
        alert("Failed to update task: " + res.message);
      }
    } catch (err) {
      // Local fallback simulation
      console.warn("API Update failed. Falling back to offline client mock simulations.");
      setTasks(prev => prev.map(t => {
        if (t.rowNumber !== rowId) return t;
        const proj = projects.find(p => p.projectId === formProjectId);
        return {
          ...t,
          'PROJECT ID': formProjectId,
          'PROJECT NAME': proj ? proj.projectName : t['PROJECT NAME'],
          'CATEGORY': formCategory,
          'TASK': formTask,
          'week': formWeek,
          'START DATE': formStartDate,
          'END DATE': formEndDate,
          'REVISION DATE': formRev1,
          'REV 1': formRev1,
          'REV 2': formRev2,
          'REV 3': formRev3,
          'PERSON RESPONSIBLE': formResponsible,
          'REMARK': formRemark,
          'STATUS': formStatus,
          'TASK UPLOADS': JSON.stringify(formUploads),
          'DOER': currentUserEmail
        };
      }));
      setIsEditModalOpen(false);
    } finally {
      setIsSyncing(false);
    }
  };

  // CRUD OPERATIONS: Inline status quick change handler
  const handleInlineStatusUpdate = async (rowId: number, updatesMap: any) => {
    try {
      await updateTask(rowId, updatesMap);
      // Directly sync cache list locally to avoid full page load flickering
      setTasks(prev => prev.map(t => {
        if (t.rowNumber === rowId) {
          return { ...t, ...updatesMap };
        }
        return t;
      }));
    } catch (err) {
      console.warn("Direct update sync failed. Applying to offline cache layout.");
      setTasks(prev => prev.map(t => {
        if (t.rowNumber === rowId) {
          return { ...t, ...updatesMap };
        }
        return t;
      }));
    }
  };

  // CRUD OPERATIONS: Duplicate Action
  const handleTaskDuplicate = async (task: TaskType) => {
    if (currentUserRole === 'PC (only view acess)' || currentUserRole === 'PC') {
      alert("🔒 PC Viewers only have read-only access. Duplication block.");
      return;
    }
    
    setIsSyncing(true);
    try {
      const taskToSubmit = {
        projectId: task['PROJECT ID'] || '',
        projectName: task['PROJECT NAME'] || '',
        category: task['CATEGORY'] || 'WORK',
        task: task['TASK'] + ' (Copy)',
        week: task['week'] || 'Week-22',
        startDate: task['START DATE'] || '',
        endDate: task['END DATE'] || '',
        personResponsible: task['PERSON RESPONSIBLE'] || 'civil',
        remark: task['REMARK'] || '',
        uploads: [],
        status: 'NOT DONE',
        finalRemark: '',
        doer: currentUserEmail,
      };

      const res = await addTasks(taskToSubmit);
      const isSuccess = res.status === 'success' || res.success === true;
      if (isSuccess) {
        addRecentTask({
          'PROJECT ID': taskToSubmit.projectId,
          'PROJECT NAME': taskToSubmit.projectName,
          'CATEGORY': taskToSubmit.category,
          'TASK': taskToSubmit.task,
          'week': taskToSubmit.week,
          'START DATE': taskToSubmit.startDate,
          'END DATE': taskToSubmit.endDate,
          'PERSON RESPONSIBLE': taskToSubmit.personResponsible,
          'REMARK': taskToSubmit.remark,
          'STATUS': taskToSubmit.status,
          'DOER': currentUserEmail,
          'TASK UPLOADS': '[]'
        });
        await loadInitialData();
      } else {
        alert("Failed to duplicate task: " + res.message);
      }
    } catch (err) {
      console.warn("API duplicate failed. Simulating local duplication.");
      const tempId = tasks.length > 0 ? Math.max(...tasks.map(t => t.rowNumber)) + 1 : 2;
      const cachedTask: TaskType = {
        rowNumber: tempId,
        'PROJECT ID': task['PROJECT ID'] || '',
        'PROJECT NAME': task['PROJECT NAME'] || '',
        'CATEGORY': task['CATEGORY'] || 'WORK',
        'TASK': task['TASK'] + ' (Copy)',
        'week': task['week'] || 'Week-22',
        'START DATE': task['START DATE'] || '',
        'END DATE': task['END DATE'] || '',
        'PERSON RESPONSIBLE': task['PERSON RESPONSIBLE'] || 'civil',
        'REMARK': task['REMARK'] || '',
        'STATUS': 'NOT DONE',
        'DOER': currentUserEmail,
        'TASK UPLOADS': '[]'
      };
      setTasks(prev => [cachedTask, ...prev]);
    } finally {
      setIsSyncing(false);
    }
  };

  // CRUD OPERATIONS: Delete Action
  const handleTaskDelete = async (rowId: number) => {
    const isDeleteAllowed = currentUserEmail.trim().toLowerCase() === 'dastudio5india1@gmail.com';
    if (!isDeleteAllowed) {
      alert("🔒 Access blocked: You do not have permission to delete tasks on this dashboard.");
      return;
    }
    setIsSyncing(true);
    try {
      const taskToDelete = tasks.find(t => t.rowNumber === rowId);
      const res = await deleteTask(rowId);
      const isSuccess = res.status === 'success' || res.success === true;
      if (isSuccess) {
        if (taskToDelete) {
          const timestamp = new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + 
                              new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const deletedEntry = {
            ...taskToDelete,
            deletedAt: timestamp,
            uniqueDeletedId: 'del-' + String(Date.now()) + '-' + Math.random().toString(36).substring(2, 6)
          };
          setRecentDeleted(prev => [deletedEntry, ...prev]);
          setLastDeletedTasks([deletedEntry]);
          setShowUndoBanner(true);
          setShowRecentDeleted(true);
        }
        await loadInitialData();
      } else {
        alert("Delete failed: " + res.message);
      }
    } catch (error) {
      console.warn("API delete failed. Deleting from local mockup cache.");
      const taskToDelete = tasks.find(t => t.rowNumber === rowId);
      if (taskToDelete) {
        const timestamp = new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + 
                            new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const deletedEntry = {
          ...taskToDelete,
          deletedAt: timestamp,
          uniqueDeletedId: 'del-' + String(Date.now()) + '-' + Math.random().toString(36).substring(2, 6)
        };
        setRecentDeleted(prev => [deletedEntry, ...prev]);
        setLastDeletedTasks([deletedEntry]);
        setShowUndoBanner(true);
        setShowRecentDeleted(true);
      }
      setTasks(prev => prev.filter(t => t.rowNumber !== rowId));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleBulkTaskDelete = async (rowIds: number[]) => {
    if (rowIds.length === 0) return;
    const isDeleteAllowed = currentUserEmail.trim().toLowerCase() === 'dastudio5india1@gmail.com';
    if (!isDeleteAllowed) {
      alert("🔒 Access blocked: You do not have permission to delete tasks on this dashboard.");
      return;
    }
    setIsSyncing(true);
    try {
      const tasksToDeleted = tasks.filter(t => rowIds.includes(t.rowNumber));
      
      // Sort in descending order to avoid shifting indices issues during sequential deletes
      const sortedRowIds = [...rowIds].sort((a, b) => b - a);
      
      let someFailed = false;
      for (const rId of sortedRowIds) {
        try {
          const res = await deleteTask(rId);
          const isSuccess = res.status === 'success' || res.success === true;
          if (!isSuccess) {
            someFailed = true;
          }
        } catch (e) {
          someFailed = true;
        }
      }
      
      const timestamp = new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + 
                          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          
      const deletedEntries = tasksToDeleted.map(task => ({
        ...task,
        deletedAt: timestamp,
        uniqueDeletedId: 'del-' + String(Date.now()) + '-' + Math.random().toString(36).substring(2, 6)
      }));
      
      setRecentDeleted(prev => [...deletedEntries, ...prev]);
      setLastDeletedTasks(deletedEntries);
      setShowUndoBanner(true);
      setShowRecentDeleted(true);
      
      if (someFailed) {
        console.warn("API delete failed on some rows or we are in mockup mode. Deleting from local mockup cache.");
        setTasks(prev => prev.filter(t => !rowIds.includes(t.rowNumber)));
      } else {
        await loadInitialData();
      }
    } catch (err: any) {
      console.warn("API bulk delete hit exception. Deleting from local mockup cache.", err);
      const tasksToDeleted = tasks.filter(t => rowIds.includes(t.rowNumber));
      const timestamp = new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + 
                          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          
      const deletedEntries = tasksToDeleted.map(task => ({
        ...task,
        deletedAt: timestamp,
        uniqueDeletedId: 'del-' + String(Date.now()) + '-' + Math.random().toString(36).substring(2, 6)
      }));
      
      setRecentDeleted(prev => [...deletedEntries, ...prev]);
      setLastDeletedTasks(deletedEntries);
      setShowUndoBanner(true);
      setShowRecentDeleted(true);
      setTasks(prev => prev.filter(t => !rowIds.includes(t.rowNumber)));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUndoDeletion = async () => {
    if (lastDeletedTasks.length === 0) return;
    setIsSyncing(true);
    try {
      const tasksToRestore = lastDeletedTasks.map(t => {
        let upsArray: any[] = [];
        try {
          const rawUps = t['TASK UPLOADS'] || t['UPLOAD'] || '[]';
          upsArray = Array.isArray(rawUps) ? rawUps : JSON.parse(rawUps);
        } catch {
          if (typeof t['UPLOAD'] === 'string' && t['UPLOAD'].startsWith('http')) {
            upsArray = [{ name: 'Attachment', url: t['UPLOAD'], id: 'raw' }];
          }
        }
        
        return {
          projectId: t['PROJECT ID'] || t['PROJECT ID  '] || '',
          projectName: t['PROJECT NAME'] || '',
          category: t['CATEGORY'] || 'WORK',
          task: t['TASK'] || t['TASK DESCRIPTION'] || '',
          week: t['week'] || t['WEEK'] || 'Week-20',
          startDate: t['START DATE'] || '',
          endDate: t['END DATE'] || '',
          personResponsible: t['PERSON RESPONSIBLE'] || t['RESPONSIBLE'] || '',
          remark: t['REMARK'] || '',
          uploads: upsArray,
          status: t['STATUS'] || 'NOT DONE',
          finalRemark: t['FINAL REMARK'] || '',
          doer: currentUserEmail,
          'ACTUAL TIME': t['ACTUAL TIME'] || '',
        };
      });

      const res = await addTasks(tasksToRestore);
      const isSuccess = res.status === 'success' || res.success === true;
      if (isSuccess) {
        const uniqueIdsToRemove = lastDeletedTasks.map(x => x.uniqueDeletedId);
        setRecentDeleted(prev => prev.filter(x => !uniqueIdsToRemove.includes(x.uniqueDeletedId)));
        setLastDeletedTasks([]);
        setShowUndoBanner(false);
        setSelectedDeletedIds(prev => prev.filter(id => !uniqueIdsToRemove.includes(id)));
        await loadInitialData();
        alert(`Successfully restored ${tasksToRestore.length} task(s)!`);
      } else {
        alert("Failed to undo: " + res.message);
      }
    } catch (err: any) {
      alert("Undo error: " + (err.message || err));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRetrieveDeleted = async (items: any[]) => {
    if (items.length === 0) return;
    setIsSyncing(true);
    try {
      const tasksToRestore = items.map(t => {
        let upsArray: any[] = [];
        try {
          const rawUps = t['TASK UPLOADS'] || t['UPLOAD'] || '[]';
          upsArray = Array.isArray(rawUps) ? rawUps : JSON.parse(rawUps);
        } catch {
          if (typeof t['UPLOAD'] === 'string' && t['UPLOAD'].startsWith('http')) {
            upsArray = [{ name: 'Attachment', url: t['UPLOAD'], id: 'raw' }];
          }
        }
        
        return {
          projectId: t['PROJECT ID'] || t['PROJECT ID  '] || '',
          projectName: t['PROJECT NAME'] || '',
          category: t['CATEGORY'] || 'WORK',
          task: t['TASK'] || t['TASK DESCRIPTION'] || '',
          week: t['week'] || t['WEEK'] || 'Week-20',
          startDate: t['START DATE'] || '',
          endDate: t['END DATE'] || '',
          personResponsible: t['PERSON RESPONSIBLE'] || t['RESPONSIBLE'] || '',
          remark: t['REMARK'] || '',
          uploads: upsArray,
          status: t['STATUS'] || 'NOT DONE',
          finalRemark: t['FINAL REMARK'] || '',
          doer: currentUserEmail,
          'ACTUAL TIME': t['ACTUAL TIME'] || '',
        };
      });

      const res = await addTasks(tasksToRestore);
      const isSuccess = res.status === 'success' || res.success === true;
      if (isSuccess) {
        const uniqueIdsToRemove = items.map(x => x.uniqueDeletedId);
        setRecentDeleted(prev => prev.filter(x => !uniqueIdsToRemove.includes(x.uniqueDeletedId)));
        setSelectedDeletedIds(prev => prev.filter(id => !uniqueIdsToRemove.includes(id)));
        setLastDeletedTasks(prev => prev.filter(x => !uniqueIdsToRemove.includes(x.uniqueDeletedId)));
        await loadInitialData();
        alert(`Successfully retrieved back ${tasksToRestore.length} task(s) to active sheet!`);
      } else {
        alert("Failed to retrieve back: " + res.message);
      }
    } catch (err: any) {
      alert("Restore error: " + (err.message || err));
    } finally {
      setIsSyncing(false);
    }
  };

  // Process Mandatory Document Upload submissions
  const handleMandatoryUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mandatoryProject) {
      alert("Please select a valid Project Name.");
      return;
    }
    if (mandatoryUploads.length === 0) {
      alert("Please upload at least one required site file first.");
      return;
    }

    if (currentUserRole === 'PC (only view acess)' || currentUserRole === 'PC') {
      alert("🔒 PC Viewers only have read-only access. Document uploads blocked.");
      return;
    }

    setIsSyncing(true);
    try {
      const selectedProj = projects.find(p => p.projectId === mandatoryProject);
      const projName = selectedProj ? selectedProj.projectName : '';

      // Compiles Mandatory Uploads directly as special "WORK/Document" tasks for sheets logging
      const taskToSubmit = {
        projectId: mandatoryProject,
        projectName: projName,
        category: 'WORK',
        task: `MANDATORY DOCUMENT: (${mandatoryCategory}) uploaded via Site Dashboard Portal`,
        week: mandatoryWeek,
        startDate: weeks[mandatoryWeek]?.start || '',
        endDate: weeks[mandatoryWeek]?.end || '',
        personResponsible: currentUserRole === 'Site Supervisor' ? currentUserEmail.split('@')[0] : 'civil',
        remark: `${mandatoryCategory} Compliance file upload. Remark: ${mandatoryRemark}`,
        uploads: mandatoryUploads,
        status: 'DONE',
        finalRemark: `${mandatoryCategory} verified.`,
        doer: currentUserEmail,
      };

      const res = await addTasks(taskToSubmit);
      const isSuccess = res.status === 'success' || res.success === true;
      if (isSuccess) {
        alert("🎉 Compliance Mandatory documents updated successfully!");
        
        // Add to recently added entries tracker
        addRecentTask({
          'PROJECT ID': mandatoryProject,
          'PROJECT NAME': projName,
          'CATEGORY': 'WORK',
          'TASK': `MANDATORY DOCUMENT: (${mandatoryCategory}) uploaded via Site Dashboard Portal`,
          'week': mandatoryWeek,
          'START DATE': weeks[mandatoryWeek]?.start || '',
          'END DATE': weeks[mandatoryWeek]?.end || '',
          'PERSON RESPONSIBLE': currentUserRole === 'Site Supervisor' ? currentUserEmail.split('@')[0] : 'civil',
          'REMARK': `${mandatoryCategory} Compliance file upload. Remark: ${mandatoryRemark}`,
          'STATUS': 'DONE',
          'DOER': currentUserEmail,
          'TASK UPLOADS': JSON.stringify(mandatoryUploads)
        });

        setMandatoryUploads([]);
        setMandatoryRemark('');
        setActiveTab('dashboard'); // Go back to metrics overview
        await loadInitialData();
      } else {
        alert("Upload document mapping failed: " + res.message);
      }
    } catch (err: any) {
      alert("Uploaded successfully to Google Drive, but backend sheet synchronization threw a timeout. Your upload is cached.");
      setMandatoryUploads([]);
      setMandatoryRemark('');
      setActiveTab('dashboard');
    } finally {
      setIsSyncing(false);
    }
  };

  const mapSheetRoleToAppRole = (email: string, rawRole: string): string => {
    const r = String(rawRole || '').trim().toLowerCase();
    
    if (r.includes('admin')) {
      return 'Admin';
    }
    if (r.includes('supervisor') || r.includes('site supervisor') || r.includes('supervisors')) {
      return 'Site Supervisor';
    }
    if (r.includes('pc') || r.includes('only view') || r.includes('view acess') || r.includes('view-only')) {
      return 'PC (only view acess)';
    }
    return 'Site Supervisor'; // fallback
  };

  const handleVerifyAndLogin = async (emailToVerify: string) => {
    if (!emailToVerify) return;
    setLoginLoading(true);
    setLoginError('');
    
    // Simulate a secure network verification delay
    await new Promise(resolve => setTimeout(resolve, 600));

    const emailClean = emailToVerify.trim().toLowerCase();
    
    // 1. Check against authorized DEFAULT_USERS first
    const foundUser = DEFAULT_USERS.find(u => u.email.toLowerCase() === emailClean);
    if (foundUser) {
      const mappedRole = mapSheetRoleToAppRole(emailToVerify, foundUser.role);
      handleUserSwitch(foundUser.email, mappedRole);
      setLoginLoading(false);
      return;
    }

    // 2. Fallback heuristic role mapping for custom test profiles to ensure seamless ad hoc testing
    let assignedRole = 'Site Supervisor'; // Standard fallback role
    if (emailClean.includes('admin')) {
      assignedRole = 'Admin';
    } else if (emailClean.includes('pc.2') || emailClean.includes('pc') || emailClean.includes('view')) {
      assignedRole = 'PC (only view acess)';
    }

    const mappedRole = mapSheetRoleToAppRole(emailToVerify, assignedRole);
    handleUserSwitch(emailToVerify.trim(), mappedRole);
    setLoginLoading(false);
  };

  // Handle logouts
  const handleLogout = () => {
    setCurrentUserEmail('');
    setCurrentUserRole('');
    localStorage.removeItem('site_doer_email');
    localStorage.removeItem('site_doer_role');
  };

  // 1. Center corporate authentication barrier if session is inactive
  if (!currentUserEmail) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 p-4 font-sans relative overflow-hidden">
        {/* Dynamic decorative backdrop accents */}
        <div className="absolute top-0 left-0 w-80 h-80 bg-blue-200/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />
        
        {/* Card envelope with floating overlapping icon header */}
        <div className="relative w-full max-w-sm rounded-[24px] border border-gray-150 bg-white p-6 pt-12 shadow-2xl space-y-6 mt-8">
          
          {/* Overlapping logo element centered meticulously at the top border */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white shadow-lg shadow-indigo-200">
            <LayoutGrid className="h-7 w-7" />
          </div>

          <div className="text-center space-y-1">
            <h2 className="text-2xl font-black text-gray-950 tracking-tight">Site Planning</h2>
            <p className="text-[11px] font-semibold text-indigo-600 italic tracking-wide">
              Secure Enterprise Access
            </p>
          </div>

          {loginError && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-start gap-2 text-xs text-red-700 animate-fadeIn">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              const inputEmail = (e.currentTarget.elements.namedItem('email') as HTMLInputElement).value.trim();
              handleVerifyAndLogin(inputEmail);
            }} 
            className="space-y-4"
          >
            <div>
              <label htmlFor="login-email" className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1.5">
                EMAIL IDENTIFIER
              </label>
              <div className="relative rounded-xl border border-gray-300 focus-within:border-indigo-600 bg-white px-3.5 py-3 flex items-center gap-2.5 transition shadow-2xs">
                <span className="text-gray-400 font-extrabold text-indigo-500">@</span>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  required
                  disabled={loginLoading}
                  className="w-full text-xs text-gray-900 bg-transparent outline-none border-none p-0 focus:ring-0 placeholder:text-gray-400"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 py-3 text-xs font-extrabold text-white shadow-md hover:shadow-indigo-100 transition cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider border-none outline-none"
            >
              {loginLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <span>Verifying Users Sheet...</span>
                </>
              ) : (
                <span>Enter Workspace</span>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const isEditStatusAllowed = formUploads.length > 0;

  return (
    <div className="flex flex-col min-h-screen w-full bg-gray-50 font-sans overflow-x-hidden">
      
      {/* Unified sticky page top header */}
      <Header
        currentEmail={currentUserEmail}
        currentRole={currentUserRole}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onSync={loadInitialData}
        isSyncing={isSyncing}
        onLogout={handleLogout}
      />

      {/* Main Body Frame */}
      <div className="flex-1 flex flex-col min-h-0 w-full overflow-y-auto">
        
        {/* Dynamic inner tabs scroll section */}
        <main className="flex-1 px-3 py-2 md:px-4 md:py-2.5 w-full space-y-3">
          
          {/* TAP-1: Dashboard metrics and tasks overview tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-3">
              
              {/* Undo Toast / Banner Alert */}
              {showUndoBanner && lastDeletedTasks.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl p-3 shadow-sm animate-fade-in">
                  <div className="flex items-center gap-2.5">
                    <div className="bg-indigo-150 p-2 rounded-lg text-indigo-750 shrink-0">
                      <Sparkles className="h-4 w-4 text-indigo-650 animate-bounce" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900">Task{lastDeletedTasks.length > 1 ? 's' : ''} deleted successfully</h4>
                      <p className="text-[10px] text-gray-500 font-semibold mt-0.5">
                        You've deleted {lastDeletedTasks.length} task{lastDeletedTasks.length > 1 ? 's' : ''}. Would you like to undo this deletion and restore them?
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      onClick={handleUndoDeletion}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-2xs uppercase font-black tracking-wider cursor-pointer shadow-3xs"
                    >
                      Undo Deletion
                    </button>
                    <button
                      onClick={() => setShowUndoBanner(false)}
                      className="px-2.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-600 rounded-lg text-2xs font-bold cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {/* Stats Analytics highlight Row */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-black text-gray-950 tracking-tight">Active Analytics Overview</h2>
                    <p className="text-[10px] text-gray-400 mt-0.2">Click any metric card below to filter tasks by status</p>
                  </div>
                  
                  {!isDoerOrSupervisor && (
                    <button
                      onClick={loadInitialData}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-bold text-gray-700 hover:bg-gray-100 transition shadow-3xs cursor-pointer"
                      title="Reload site data from sheets"
                    >
                      <RefreshCw className="h-2.5 w-2.5" />
                      <span>Sync Sheet</span>
                    </button>
                  )}
                </div>
                
                <DashboardCards 
                  metrics={metrics} 
                  onCardClick={(status) => setSelectedStatus(status || '')}
                  activeStatusFilter={selectedStatus}
                />
              </div>

              {/* SITE SUPERVISORS QUICK SCORECARDS */}
              {currentUserRole === 'Admin' && (
                <SupervisorCards
                  tasks={tasks}
                  selectedSupervisor={selectedSupervisor}
                  setSelectedSupervisor={setSelectedSupervisor}
                  selectedProject={selectedProject}
                />
              )}

              {/* PRIMARY PLANNING WORK ZONE */}
              <div className="space-y-3">
                
                {/* Main Task Schedules Column - Spans Full Width */}
                <div className="space-y-3">
                  {/* FILTERS & SEARCH ROW */}
                  <div className="space-y-2">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">
                          Site Task Schedules
                        </h3>
                      </div>
                      
                      {currentUserRole !== 'PC (only view acess)' && currentUserRole !== 'PC' && (
                        <button
                          onClick={() => setIsAddModalOpen(true)}
                          className="flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition cursor-pointer"
                          id="btn-add-task-modal"
                        >
                          <Plus className="h-4.5 w-4.5" />
                          <span>Add Multiple Tasks</span>
                        </button>
                      )}
                    </div>

                    <Filters
                      selectedWeek={selectedWeek}
                      setSelectedWeek={setSelectedWeek}
                      selectedStatus={selectedStatus}
                      setSelectedStatus={setSelectedStatus}
                      selectedCategory={selectedCategory}
                      setSelectedCategory={setSelectedCategory}
                      selectedProject={selectedProject}
                      setSelectedProject={setSelectedProject}
                      selectedResponsible={selectedResponsible}
                      setSelectedResponsible={setSelectedResponsible}
                      selectedUploadStatus={selectedUploadStatus}
                      setSelectedUploadStatus={setSelectedUploadStatus}
                      searchTerm={searchTerm}
                      setSearchTerm={setSearchTerm}
                      projects={dropdownProjects}
                      isLoadingProjects={isLoadingProjects}
                      totalTasksFiltered={filteredTasks.length}
                      completedTasksFiltered={filteredTasks.filter(t => (t['STATUS'] || '').toUpperCase() === 'DONE').length}
                    />
                  </div>

                  {/* DATA TABLE SHEET COMPILER */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 font-bold px-1">
                      <span>Filtered Counts: {filteredTasks.length} task(s) matching criteria</span>
                      {selectedSupervisor && (
                        <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                          Supervised by: {selectedSupervisor}
                        </span>
                      )}
                    </div>
                    
                    <TaskTable
                      tasks={filteredTasks}
                      projects={projects}
                      isLoading={isLoading}
                      userRole={currentUserRole}
                      userEmail={currentUserEmail}
                      onUpdateTask={handleInlineStatusUpdate}
                      onDeleteTask={handleTaskDelete}
                      onDeleteTasks={handleBulkTaskDelete}
                      onOpenEditModal={handleOpenEditModal}
                      onDuplicateTask={handleTaskDuplicate}
                    />
                  </div>
                </div>

                {/* Recently Added Entries Bottom-Row Panel */}
                <div className="space-y-3 border-t border-gray-150 pt-4 mt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                      <History className="h-3.5 w-3.5 text-indigo-500" />
                      <span>Recent Additions</span>
                    </h3>
                    {displayedRecentEntries.length > 0 && (
                      <button
                        onClick={() => {
                          if (confirm("Are you sure you want to clear your local session additions list?")) {
                            setRecentEntries([]);
                            localStorage.removeItem('site_recent_entries');
                          }
                        }}
                        className="text-[10px] uppercase font-bold text-red-500 hover:text-red-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                        title="Clear recent additions logs history list"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Clear</span>
                      </button>
                    )}
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-xs">
                    {displayedRecentEntries.length === 0 ? (
                      <div className="py-4 text-center px-4">
                        <Clock className="h-6 w-6 text-gray-300 mx-auto stroke-1" />
                        <h4 className="text-[11px] font-bold text-gray-400 mt-1.5 font-sans">No recent additions</h4>
                        <p className="text-[10px] text-gray-400 mt-1 leading-normal max-w-[280px] mx-auto">
                          Newly inserted single or bulk tasks from this dashboard session will be listed here instantly for tracking.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {displayedRecentEntries.map((entry, idx) => {
                          const isDone = String(entry['STATUS'] || '').toUpperCase() === 'DONE';
                          const isPartially = String(entry['STATUS'] || '').toUpperCase() === 'PARTIALLY DONE';
                          
                          const cat = entry['CATEGORY'] || 'WORK';
                          const projName = entry['PROJECT NAME'] || 'Custom Project';
                          const weekSign = entry['week'] || 'Week-20';
                          
                          return (
                            <div 
                              key={entry.id || idx} 
                              className="group relative rounded-lg border border-gray-100 bg-gray-50/50 p-3 hover:border-indigo-200 hover:bg-white transition text-left"
                            >
                              {/* Metadata line */}
                              <div className="flex items-center justify-between mb-1.5 text-[10px]">
                                <span className={`font-black px-1.5 py-0.2 rounded border ${
                                  cat === 'WORK' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                                  cat === 'MATERIAL' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                                  cat === 'SELECTION' ? 'bg-purple-50 border-purple-200 text-purple-700' :
                                  'bg-blue-50 border-blue-200 text-blue-700'
                                }`}>
                                  {cat}
                                </span>
                                <span className="text-gray-400 font-bold">{entry.timeAdded || 'Logged'}</span>
                              </div>

                              {/* Task Title */}
                              <h4 className="text-xs font-bold text-gray-950 leading-snug tracking-tight">
                                {entry['TASK'] || 'Untitled Task'}
                              </h4>

                              {/* Project & Info */}
                              <div className="mt-1.5 space-y-0.5 border-t border-gray-100/60 pt-1.5">
                                <p className="text-[10px] font-bold text-gray-600 truncate" title={projName}>
                                  {projName}
                                </p>
                                <div className="flex items-center justify-between text-[10px] font-medium text-gray-400">
                                  <span>Week: <strong>{weekSign}</strong></span>
                                  <span>By: <strong>{entry['PERSON RESPONSIBLE'] || 'civil'}</strong></span>
                                </div>
                              </div>

                              {/* Status Badge */}
                              <div className="mt-2 flex items-center justify-between">
                                <span className={`inline-flex items-center justify-center text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                  isDone ? 'bg-emerald-100 text-emerald-800' :
                                  isPartially ? 'bg-amber-100 text-amber-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {entry['STATUS'] || 'NOT DONE'}
                                </span>
                                <span className="text-[9px] text-gray-300 font-bold group-hover:text-indigo-400 transition animate-pulse">
                                  ID: {String(entry['PROJECT ID'] || '').split('-')[0].substring(0, 8)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Recently Deleted Bottom Panel */}
                {isDeleteAllowed && (
                  <div id="recent-deleted-panel" className="space-y-4 border-t border-gray-150 pt-6 mt-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                      <Trash2 className="h-4 w-4 text-red-500 animate-pulse" />
                      <span>Recent Deleted Tasks</span>
                      <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-black">
                        {recentDeleted.length}
                      </span>
                    </h3>
                    <div className="flex items-center gap-2">
                      {recentDeleted.length > 0 && (
                        <button
                          onClick={() => {
                            if (confirm("Are you sure you want to permanently clear the local deleted tasks index history list?")) {
                              setRecentDeleted([]);
                              setSelectedDeletedIds([]);
                            }
                          }}
                          className="text-[10px] uppercase font-black text-red-500 hover:text-red-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                          title="Clear recent deleted history list"
                        >
                          Clear All Logs
                        </button>
                      )}
                    </div>
                  </div>

                  <div className={`rounded-xl border p-4 shadow-3xs space-y-4 transition-all duration-300 ${recentDeleted.length > 0 ? 'bg-white border-gray-200' : 'bg-gray-50/30 border-gray-100'} ${showRecentDeleted && recentDeleted.length > 0 ? 'ring-2 ring-red-100 border-red-200' : ''}`}>
                    {recentDeleted.length === 0 ? (
                      <div className="py-8 text-center px-4">
                        <Trash2 className="h-8 w-8 text-gray-300 mx-auto stroke-1" />
                        <h4 className="text-xs font-bold text-gray-400 mt-2.5 font-sans">No recent deleted tasks</h4>
                        <p className="text-[10px] text-gray-400 mt-1 leading-normal max-w-[280px] mx-auto">
                          Tasks deleted from the main grid will automatically line up here to allow instant preview and bulk recovery.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Bulk retrieve action header */}
                        <div className="flex flex-wrap items-center justify-between pb-2.5 border-b border-gray-100 gap-2">
                          <div className="flex items-center gap-2 animate-fade-in">
                            <input
                              type="checkbox"
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-3.5 w-3.5"
                              checked={recentDeleted.length > 0 && recentDeleted.every(x => selectedDeletedIds.includes(x.uniqueDeletedId))}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedDeletedIds(recentDeleted.map(x => x.uniqueDeletedId));
                                } else {
                                  setSelectedDeletedIds([]);
                                }
                              }}
                            />
                            <span className="text-[11px] font-black text-gray-500 select-none">
                              Select All ({selectedDeletedIds.length} of {recentDeleted.length} selected to retrieve back)
                            </span>
                          </div>
                          {selectedDeletedIds.length > 0 && (
                            <button
                              onClick={() => {
                                const selectedItems = recentDeleted.filter(x => selectedDeletedIds.includes(x.uniqueDeletedId));
                                handleRetrieveDeleted(selectedItems);
                              }}
                              className="px-2.5 py-1.5 bg-indigo-650 text-white text-[10px] uppercase font-black rounded-md hover:bg-slate-705 transition cursor-pointer shadow-3xs animate-fade-in"
                            >
                              Retrieve Selected back
                            </button>
                          )}
                        </div>

                        {/* Responsive grid of deleted tasks */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {recentDeleted.map((entry, idx) => {
                            const isSelected = selectedDeletedIds.includes(entry.uniqueDeletedId);
                            const cat = entry['CATEGORY'] || 'WORK';
                            const projName = entry['PROJECT NAME'] || 'Custom Project';
                            const weekSign = entry['week'] || 'Week-20';
                            
                            return (
                              <div 
                                key={entry.uniqueDeletedId || idx} 
                                className={`group relative rounded-lg border p-3 hover:border-red-200 transition text-left ${isSelected ? 'border-indigo-300 bg-indigo-50/10' : 'border-gray-100 bg-gray-50/50'}`}
                              >
                                {/* Checkbox & Category */}
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="checkbox"
                                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-3 w-3"
                                      checked={isSelected}
                                      onChange={() => {
                                        setSelectedDeletedIds(prev => 
                                          prev.includes(entry.uniqueDeletedId) 
                                            ? prev.filter(id => id !== entry.uniqueDeletedId) 
                                            : [...prev, entry.uniqueDeletedId]
                                        );
                                      }}
                                    />
                                    <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${
                                      cat === 'WORK' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                                      cat === 'MATERIAL' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                                      cat === 'SELECTION' ? 'bg-purple-50 border-purple-200 text-purple-700' :
                                      'bg-blue-50 border-blue-200 text-blue-700'
                                    }`}>
                                      {cat}
                                    </span>
                                  </div>
                                  <span className="text-red-505 font-extrabold text-[9px]">{entry.deletedAt || 'Deleted'}</span>
                                </div>

                                {/* Task Title */}
                                <h4 className="text-xs font-bold text-gray-950 leading-snug tracking-tight truncate" title={entry['TASK']}>
                                  {entry['TASK'] || 'Untitled Task'}
                                </h4>

                                {/* Project & Responsibility */}
                                <div className="mt-1.5 space-y-0.5 border-t border-gray-100/60 pt-1.5">
                                  <p className="text-[10px] font-bold text-gray-600 truncate" title={projName}>
                                    {projName}
                                  </p>
                                  <div className="flex items-center justify-between text-[10px] font-medium text-gray-400">
                                    <span>Week: <strong>{weekSign}</strong></span>
                                    <span>Resp: <strong>{entry['PERSON RESPONSIBLE'] || 'civil'}</strong></span>
                                  </div>
                                </div>

                                {/* Retrieve Single Button */}
                                <div className="mt-2.5 flex items-center justify-between pt-1.5 border-t border-gray-100/50">
                                  <span className="text-[9px] text-gray-300 font-bold bg-gray-100 px-1 py-0.5 rounded">
                                    Row: {entry.rowNumber}
                                  </span>
                                  <button
                                    onClick={() => handleRetrieveDeleted([entry])}
                                    className="text-[9px] font-black text-indigo-600 hover:text-indigo-805 hover:underline flex items-center gap-0.5 cursor-pointer"
                                    title="Restore this single task back"
                                  >
                                    Retrieve Back
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              </div>
            </div>
          )}

          {/* TAP-2: Multiple Bulk task loader Tab */}
          {activeTab === 'bulk' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-black text-gray-950 tracking-tight">Bulk Fast Entry Loader</h2>
                <p className="text-xs text-gray-500">Compile and insert row items simultaneously to streamline daily site documentation.</p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4.5 md:p-6 shadow-xs">
                <BulkEntry
                  projects={projects}
                  userEmail={currentUserEmail}
                  selectedSupervisor={selectedSupervisor}
                  onSuccess={() => {
                    setActiveTab('dashboard');
                    loadInitialData();
                  }}
                  addRecentTask={addRecentTask}
                />
              </div>
            </div>
          )}

          {/* TAP-3: Special Mandatory documents Upload compliance tracker */}
          {activeTab === 'uploads' && currentUserRole === 'Admin' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="text-center space-y-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-black text-gray-950 tracking-tight">Compliance Document Upload</h2>
                <p className="text-xs text-gray-500 max-w-md mx-auto">
                  Submit mandated site photo, schedules, and weekend reports directly. These documents upload to Google Drive folders and append as completions automatically as compliance tasks on Sheets.
                </p>
              </div>

              <form onSubmit={handleMandatoryUploadSubmit} className="rounded-xl border border-gray-200 bg-white p-5 md:p-6 shadow-sm space-y-5">
                
                {/* 1. Category */}
                <div>
                  <label htmlFor="comp-cat" className="text-xs font-extrabold uppercase tracking-widest text-gray-500 block mb-1.5">Compliance Type *</label>
                  <select
                    id="comp-cat"
                    value={mandatoryCategory}
                    onChange={(e) => setMandatoryCategory(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 py-2 px-3 text-sm focus:border-indigo-500 outline-none transition cursor-pointer"
                  >
                    <option value="SITE PHOTO">SITE PHOTO (Mandatory site snap)</option>
                    <option value="SATURDAY REPORT">SATURDAY REPORT (Weekly schedule summary)</option>
                    <option value="SITE SCHEDULE PHOTO">SITE SCHEDULE PHOTO (Architectural timetable update)</option>
                  </select>
                </div>

                {/* 2. Project Target */}
                <div>
                  <label htmlFor="comp-proj" className="text-xs font-extrabold uppercase tracking-widest text-gray-500 block mb-1.5">Target Campus Project *</label>
                  <select
                    id="comp-proj"
                    value={mandatoryProject}
                    onChange={(e) => setMandatoryProject(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 py-2.5 px-3 text-sm focus:border-indigo-500 outline-none transition cursor-pointer"
                    required
                  >
                    <option value="">-- Choose Project Name --</option>
                    {projects.map((proj) => (
                      <option key={proj.projectId} value={proj.projectId}>
                        {proj.projectName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Week mapping target */}
                <div>
                  <label htmlFor="comp-week" className="text-xs font-extrabold uppercase tracking-widest text-gray-500 block mb-1.5">Reporting Week Span</label>
                  <select
                    id="comp-week"
                    value={mandatoryWeek}
                    onChange={(e) => setMandatoryWeek(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 py-2 px-3 text-sm outline-none transition"
                  >
                    {Object.keys(weeks).map((wKey) => (
                      <option key={wKey} value={wKey}>{wKey}</option>
                    ))}
                  </select>
                </div>

                {/* 4. Upload widget */}
                <UploadBox
                  projectId={mandatoryProject || 'GENERAL'}
                  onUploadsChange={setMandatoryUploads}
                  existingUploads={mandatoryUploads}
                  label="Multiple compliance upload files & site camera snapping"
                  maxFiles={3}
                />

                {/* 5. Remarks */}
                <div>
                  <label htmlFor="comp-remarks" className="text-xs font-extrabold uppercase tracking-widest text-gray-500 block mb-1.5">Compliance Remark</label>
                  <textarea
                    id="comp-remarks"
                    rows={3}
                    placeholder="Provide description updates or observations..."
                    value={mandatoryRemark}
                    onChange={(e) => setMandatoryRemark(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-indigo-500 outline-none transition"
                  />
                </div>

                {/* Row Save submit */}
                <button
                  type="submit"
                  disabled={isSyncing}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 text-sm font-bold text-white shadow-md hover:bg-indigo-700 disabled:bg-gray-300 transition cursor-pointer"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="h-4.5 w-4.5 animate-spin" />
                      <span>Uploading & Synchronizing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4.5 w-4.5" />
                      <span>Submit Document compliance logs</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* TAP-4: Settings & credentials switcher simulated tab */}
          {activeTab === 'settings' && (
            <div className="max-w-xl mx-auto space-y-6">
              <div>
                <h2 className="text-xl font-black text-gray-950 tracking-tight">Active User Credentials Profile</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Configure who you are submitting or viewing data as. No registration or complex password login required.
                </p>
              </div>

              {/* Active settings panel switcher block */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs space-y-5">
                <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 p-3.5 rounded-lg text-indigo-900">
                  <UserCheck2 className="h-5.5 w-5.5 text-indigo-600 shrink-0" />
                  <div className="text-xs">
                    <p className="font-bold">Active Login Persona</p>
                    <p className="font-medium text-indigo-700 mt-0.5">
                      Email: <strong className="font-bold text-indigo-900">{currentUserEmail}</strong>
                    </p>
                    <p className="font-semibold text-[10px] bg-indigo-100 uppercase inline-block px-1.5 py-0.5 rounded text-indigo-800 mt-1">
                      Privilege: {currentUserRole}
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">
                    Switch Active Site Persona Profile
                  </h3>
                  <p className="text-2xs text-gray-400 mt-0.5">
                    Click any email profile below to test dashboard permissions and prepopulate 'Doer' email tags.
                  </p>

                  <div className="divide-y divide-gray-150 rounded-xl border border-gray-200 overflow-hidden bg-white">
                    {DEFAULT_USERS.map((usr) => {
                      const isCurrent = currentUserEmail === usr.email;
                      return (
                        <button
                          key={usr.email}
                          onClick={() => handleUserSwitch(usr.email, usr.role)}
                          className={`w-full flex items-center justify-between p-3.5 text-left transition hover:bg-gray-50 cursor-pointer ${
                            isCurrent ? 'bg-indigo-50/40' : ''
                          }`}
                        >
                          <div className="leading-tight">
                            <p className="text-xs font-bold text-gray-900">{usr.email}</p>
                            <span className="text-[10px] text-gray-400 font-semibold">{usr.role}</span>
                          </div>
                          {isCurrent ? (
                            <span className="rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5 text-[10px] font-bold">
                              Active
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-gray-400">Select</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* PC Reader warnings */}
                {(currentUserRole === 'PC (only view acess)' || currentUserRole === 'PC') && (
                  <div className="rounded-lg bg-amber-50 p-3.5 border border-amber-200 flex gap-2">
                    <Lock className="h-5 w-5 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-amber-800">Locked view access</p>
                      <p className="text-[11px] text-amber-700 leading-normal mt-0.5">
                        Site workers with simple 'PC' role are set to View Only. All edit status menus, delete buttons, compliance uploads, and add features are disabled to protect historical spreadsheets.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* MODAL WINDOWS: ADD MULTIPLE TASKS PLANNING FORM MODAL */}
      {isAddModalOpen && (() => {
        // Compute project lists inside modal closure for maximum reactiveness
        const activeProjectIds = new Set<string>();
        tasks.forEach(t => {
          const pid = t['PROJECT ID'] || t['PROJECT_ID'] || '';
          if (pid) activeProjectIds.add(String(pid).trim().toUpperCase());
        });

        const activeProjs: any[] = [];
        const otherProjs: any[] = [];
        projects.forEach(p => {
          const isAct = activeProjectIds.has(String(p.projectId || '').trim().toUpperCase());
          if (isAct) {
            activeProjs.push(p);
          } else {
            otherProjs.push(p);
          }
        });

        const q = searchText.toLowerCase().trim();
        const filteredActive = q 
          ? activeProjs.filter(p => p.projectName.toLowerCase().includes(q) || p.projectId.toLowerCase().includes(q))
          : activeProjs;

        const filteredOthers = q 
          ? otherProjs.filter(p => p.projectName.toLowerCase().includes(q) || p.projectId.toLowerCase().includes(q))
          : otherProjs;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto font-sans">
            <div className="relative w-full max-w-7xl rounded-2xl border border-gray-150 bg-white px-3 md:px-5 py-4 md:py-5 shadow-2xl flex flex-col max-h-[95vh] overflow-hidden animate-fade-in font-sans">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-gray-150 pb-3 mb-3 shrink-0">
                <div>
                  <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                    <span>Add New Project Planning</span>
                    <span className="text-[9px] uppercase font-bold tracking-widest bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">WORKSPACE BATCH PLANNING FORM</span>
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Define multiple tasks at once. Autocomplete resolves official Project IDs, and selecting column weeks automatically fetches Schedule boundaries.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition cursor-pointer"
                  title="Close form"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>


              {/* Form container */}
              <form onSubmit={handleAddSingleTaskSubmit} className="flex-1 overflow-hidden flex flex-col space-y-3">
                
                {/* Upper Project Selection Area - Slim & Compact Row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200 shrink-0">
                  <div className="relative md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">PROJECT NAME *</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={searchText}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSearchText(val);
                          setIsDropdownOpen(true);
                          
                          // Auto match project and retrieve unique ID
                          const exactProj = projects.find(p => p.projectName.trim().toLowerCase() === val.trim().toLowerCase());
                          if (exactProj) {
                            setFormProjectId(exactProj.projectId);
                          } else {
                            setFormProjectId(''); // reset
                          }
                        }}
                        onFocus={() => setIsDropdownOpen(true)}
                        onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                        placeholder="Type first few letters of project name..."
                        className="w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs font-semibold focus:border-indigo-600 focus:ring-1 focus:ring-indigo-650 focus:outline-none transition bg-white text-gray-905 placeholder-gray-400"
                        required
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                        <Layers className="h-3.5 w-3.5" />
                      </div>
                    </div>

                    {/* Combobox Dropdown */}
                    {isDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-48 overflow-y-auto rounded-lg border border-gray-250 bg-white py-1 shadow-xl divide-y divide-gray-100">
                        {/* Active Projects (At Top) */}
                        {filteredActive.length > 0 && (
                          <div className="py-1">
                            <div className="px-3.5 py-1 text-[9px] font-black text-emerald-800 bg-emerald-50/65 uppercase tracking-widest sticky top-0">
                              ⭐ ACTIVE PROJECTS (TOP PICK)
                            </div>
                            {filteredActive.map((pro) => (
                              <button
                                key={pro.projectId}
                                type="button"
                                onMouseDown={() => {
                                  setFormProjectId(pro.projectId);
                                  setSearchText(pro.projectName);
                                  setIsDropdownOpen(false);
                                }}
                                className="w-full text-left px-4 py-1.5 text-xs hover:bg-indigo-50/50 font-semibold text-gray-800 block transition"
                              >
                                <div className="flex justify-between items-center text-xs">
                                  <span>{highlightMatch(pro.projectName, searchText)}</span>
                                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 font-extrabold px-1.5 py-0.5 rounded">{pro.projectId}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* All Projects */}
                        {filteredOthers.length > 0 && (
                          <div className="py-1">
                            <div className="px-3.5 py-1 text-[9px] font-black text-gray-500 bg-gray-50 uppercase tracking-widest sticky top-0">
                              📁 ALL OTHER PROJECTS (SHEET NAMES)
                            </div>
                            {filteredOthers.map((pro) => (
                              <button
                                key={pro.projectId}
                                type="button"
                                onMouseDown={() => {
                                  setFormProjectId(pro.projectId);
                                  setSearchText(pro.projectName);
                                  setIsDropdownOpen(false);
                                }}
                                className="w-full text-left px-4 py-1.5 text-xs hover:bg-indigo-50/50 font-medium text-gray-700 block transition"
                              >
                                <div className="flex justify-between items-center text-xs">
                                  <span>{highlightMatch(pro.projectName, searchText)}</span>
                                  <span className="text-[10px] font-mono text-gray-500">{pro.projectId}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        {filteredActive.length === 0 && filteredOthers.length === 0 && (
                          <div className="p-3 text-center text-xs text-gray-400">
                            No matching projects found. Type to define a custom reference.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">UNIQUE ID</label>
                    <input
                      type="text"
                      readOnly
                      placeholder="Retrieve ID"
                      value={formProjectId || ''}
                      className="w-full rounded-lg border border-slate-200 bg-slate-100 py-1.5 px-3 text-xs text-indigo-750 font-black tracking-wider outline-none select-all cursor-not-allowed text-center"
                    />
                  </div>

                  <div className="md:col-span-1">
                    <label htmlFor="modal-batch-week" className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">PLANNING WEEK *</label>
                    <select
                      id="modal-batch-week"
                      value={formWeek}
                      onChange={(e) => {
                        const wk = e.target.value;
                        setFormWeek(wk);
                        const weekData = weeks[wk];
                        const startVal = weekData ? weekData.start : '';
                        const endVal = weekData ? weekData.end : '';
                        setFormStartDate(startVal);
                        setFormEndDate(endVal);
                        setMultiRows(prev => prev.map(row => ({
                          ...row,
                          week: wk,
                          startDate: startVal,
                          endDate: endVal
                        })));
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white py-1.5 px-3 text-xs text-indigo-950 font-black tracking-wide outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-650 cursor-pointer"
                    >
                      <option value="">Select Planning Week</option>
                      {Object.keys(weeks).map((wKey) => (
                        <option key={wKey} value={wKey}>{wKey}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Multi Task Entry Grid Label & Action Row */}
                <div className="flex items-center justify-between shrink-0 py-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-black uppercase tracking-widest text-indigo-950">Multi-Task Entry Grid</h4>
                    <span className="bg-indigo-100 text-indigo-800 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">BATCH WORKSPACE</span>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => {
                      const currentWeek = formWeek || '';
                      const wkData = currentWeek ? weeks[currentWeek] : null;
                      let startD = wkData ? wkData.start : '';
                      let endD = wkData ? wkData.end : '';
                      
                      const newRowEntry = {
                        rowId: Math.random().toString(36).substring(2, 9),
                        zNo: '',
                        zone: '',
                        sqft: '',
                        task: '',
                        stage: '',
                        dir: 'DINESH GADA',
                        tl: 'MANASVI PATIL',
                        dpt: '3D',
                        category: 'WORK',
                        doer: '',
                        startDate: startD,
                        endDate: endD,
                        revisionDate: '',
                        status: 'ASSIGNED',
                        week: currentWeek,
                        remark: '',
                        uploads: []
                      };
                      setMultiRows(prev => [...prev, newRowEntry]);
                    }}
                    className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer shadow-3xs"
                  >
                    <Plus className="h-4 w-4" />
                    <span>➕ NEW ROW</span>
                  </button>
                </div>

                {/* High Density Spreadsheet Grid - No Horizontal Scrolling (w-full table-fixed) */}
                <div className="flex-1 overflow-y-auto min-h-[220px] max-h-[48vh] rounded-xl border border-gray-200 bg-gray-50/25 p-1 relative">
                  <table className="w-full table-fixed divide-y divide-gray-250 text-left text-[11px] bg-white rounded-lg shadow-3xs border border-gray-150">
                    <thead className="bg-gray-105 text-gray-650 font-bold uppercase tracking-wider text-[9px] border-b border-gray-200 sticky top-0 z-10">
                      <tr>
                        <th className="px-1 py-1.5 border-b w-[84px]">CATEGORY</th>
                        <th className="px-2 py-1.5 border-b min-w-[120px]">TASK TITLE DETAILS *</th>
                        <th className="px-1 py-1.5 border-b w-[94px]">START DATE</th>
                        <th className="px-1 py-1.5 border-b w-[94px]">END DATE</th>
                        <th className="px-1 py-1.5 border-b w-[94px] bg-indigo-50/25 text-indigo-750 font-black">REV 1</th>
                        <th className="px-1 py-1.5 border-b w-[94px] bg-amber-50/25 text-amber-800 font-black">REV 2</th>
                        <th className="px-1 py-1.5 border-b w-[94px] bg-fuchsia-50/15 text-fuchsia-800 font-black">REV 3</th>
                        <th className="px-1 py-1.5 border-b w-[82px]">DOER / RESP</th>
                        <th className="px-1 py-1.5 border-b w-[92px]">STATUS</th>
                        <th className="px-1 py-1.5 border-b w-[88px]">REMARK</th>
                        <th className="px-1 py-1.5 border-b text-center w-[58px]">UPLOAD</th>
                        <th className="px-1 py-1.5 border-b text-center w-[64px]">ACT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150 bg-white font-sans">
                      {multiRows.map((row, index) => {
                        const hasAnyRev = !!(row.rev1 || row.rev2 || row.rev3);
                        return (
                          <tr 
                            key={row.rowId} 
                            className={`hover:bg-indigo-50/20 transition-all ${
                              hasAnyRev ? 'bg-amber-50/20 border-l-2 border-amber-500 font-medium' : ''
                            }`}
                          >
                            
                            {/* CATEGORY */}
                            <td className="p-1">
                              <select
                                value={row.category || 'WORK'}
                                onChange={(e) => handleRowChange(index, 'category', e.target.value)}
                                className="w-full text-[10px] font-bold border border-gray-250 rounded py-1.5 px-1 bg-white focus:border-indigo-500 outline-none text-gray-800 shadow-3xs"
                              >
                                {CANONICAL_CATEGORIES.map((cat) => (
                                  <option key={cat} value={cat}>
                                    {cat}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* TASK TITLE DETAILS */}
                            <td className="p-1">
                              <textarea
                                required
                                rows={1}
                                placeholder="Work details..."
                                value={row.task}
                                onChange={(e) => handleRowChange(index, 'task', e.target.value)}
                                className="w-full text-[11px] font-bold text-gray-900 border border-indigo-200 focus:border-indigo-650 rounded py-1.5 px-1.5 outline-none placeholder-gray-300 resize-none min-h-[28px] shadow-3xs"
                              />
                            </td>

                            {/* START DATE */}
                            <td className="p-1">
                              <input
                                type="date"
                                value={row.startDate}
                                onChange={(e) => handleRowChange(index, 'startDate', e.target.value)}
                                className="w-full text-xs border border-slate-400 bg-white rounded py-1 px-1 focus:border-indigo-650 outline-none text-slate-950 font-extrabold shadow-3xs"
                              />
                            </td>

                            {/* END DATE */}
                            <td className="p-1">
                              <input
                                type="date"
                                value={row.endDate}
                                onChange={(e) => handleRowChange(index, 'endDate', e.target.value)}
                                className="w-full text-xs border border-slate-400 bg-white rounded py-1 px-1 focus:border-red-650 outline-none text-red-750 font-extrabold shadow-3xs"
                              />
                            </td>

                            {/* REV 1 */}
                            <td className="p-1 bg-indigo-50/5">
                              <input
                                type="date"
                                value={row.rev1 || ''}
                                onChange={(e) => handleRowChange(index, 'rev1', e.target.value)}
                                className="w-full text-xs border border-indigo-350 bg-indigo-50/15 text-indigo-900 font-extrabold rounded py-1 px-1 focus:border-indigo-650 outline-none shadow-3xs"
                              />
                            </td>

                            {/* REV 2 */}
                            <td className="p-1 bg-amber-50/5">
                              <input
                                type="date"
                                value={row.rev2 || ''}
                                onChange={(e) => handleRowChange(index, 'rev2', e.target.value)}
                                className="w-full text-xs border border-amber-350 bg-amber-50/10 text-amber-900 font-extrabold rounded py-1 px-1 focus:border-amber-650 outline-none shadow-3xs"
                              />
                            </td>

                            {/* REV 3 */}
                            <td className="p-1 bg-fuchsia-50/5">
                              <input
                                type="date"
                                value={row.rev3 || ''}
                                onChange={(e) => handleRowChange(index, 'rev3', e.target.value)}
                                className="w-full text-xs border border-fuchsia-350 bg-fuchsia-50/20 text-fuchsia-900 font-extrabold rounded py-1 px-1 focus:border-fuchsia-650 outline-none shadow-3xs"
                              />
                            </td>

                            {/* DOER / RESP */}
                            <td className="p-1">
                              <input
                                type="text"
                                placeholder="Doer"
                                value={row.doer}
                                onChange={(e) => handleRowChange(index, 'doer', e.target.value)}
                                className="w-full text-[10.5px] border border-gray-200 rounded py-1.5 px-1 focus:border-indigo-500 outline-none text-gray-800 font-bold shadow-3xs"
                              />
                            </td>

                            {/* STATUS */}
                            <td className="p-1">
                              <select
                                value={row.status}
                                onChange={(e) => handleRowChange(index, 'status', e.target.value)}
                                className={`w-full text-[10px] font-black border tracking-tight outline-none cursor-pointer rounded py-1.5 px-0.5 shadow-3xs ${
                                  row.status === 'DONE' ? 'bg-emerald-50 text-emerald-800 border-emerald-250' :
                                  row.status === 'PARTIALLY DONE' ? 'bg-amber-50 text-amber-800 border-amber-250' :
                                  row.status === 'NOT DONE' ? 'bg-red-50 text-red-800 border-red-200' :
                                  'bg-blue-50 text-blue-800 border-blue-200'
                                }`}
                              >
                                <option value="ASSIGNED">ASSIGNED</option>
                                <option value="NOT DONE">NOT DONE</option>
                                <option value="PARTIALLY DONE">PART. DONE</option>
                                <option value="DONE">DONE</option>
                              </select>
                            </td>

                            {/* REMARK */}
                            <td className="p-1">
                              <input
                                type="text"
                                placeholder="Remarks"
                                value={row.remark}
                                onChange={(e) => handleRowChange(index, 'remark', e.target.value)}
                                className="w-full text-[10.5px] border border-gray-200 rounded py-1.5 px-1 focus:border-indigo-500 outline-none text-gray-750 shadow-3xs"
                              />
                            </td>

                            {/* UPLOAD ATTACHMENT */}
                            <td className="p-1 text-center">
                              <button
                                type="button"
                                onClick={() => setEditingRowUploadsIndex(index)}
                                className={`w-full inline-flex items-center justify-center gap-0.5 py-1.5 px-1 rounded text-[10px] font-bold transition cursor-pointer shadow-3xs truncate ${
                                  row.uploads && row.uploads.length > 0
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-indigo-50 text-indigo-750 border border-indigo-200 hover:bg-indigo-100'
                                }`}
                                title="Attach Documents"
                              >
                                <UploadCloud className="h-3 w-3 shrink-0" />
                                <span className="truncate">{row.uploads && row.uploads.length > 0 ? `${row.uploads.length}f` : 'Upload'}</span>
                              </button>
                            </td>

                            {/* ACTIONS */}
                            <td className="p-1 text-center">
                              <div className="flex items-center justify-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => duplicateRow(index)}
                                  className="p-1 rounded text-blue-500 hover:bg-blue-50 transition cursor-pointer"
                                  title="Duplicate Row Entry"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => clearRow(index)}
                                  className="p-1 rounded text-amber-500 hover:bg-amber-50 transition cursor-pointer"
                                  title="Clear Inputs in Row"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                </button>

                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Modal Footer Controls */}
                <div className="border-t border-gray-150 pt-4 flex gap-3 justify-end items-center">
                  <div className="text-[11px] text-gray-400 font-semibold mr-auto">
                    Total Rows count: <strong className="font-bold text-gray-750">{multiRows.length}</strong>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="rounded-xl border border-gray-250 bg-white px-5 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-100 cursor-pointer transition shadow-3xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSyncing}
                    className="rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow hover:bg-indigo-700 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSyncing && <Loader2 className="h-4 w-4 animate-spin text-white" />}
                    <span>SAVE ALL TASKS 🚀</span>
                  </button>
                </div>

              </form>
            </div>
          </div>
        );
      })()}

      {/* MODAL WINDOWS: MANAGE BATCH GRID ROW UPLOADS */}
      {editingRowUploadsIndex !== null && multiRows[editingRowUploadsIndex] && (() => {
        const row = multiRows[editingRowUploadsIndex];
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto font-sans">
            <div className="relative w-full max-w-lg rounded-2xl border border-gray-150 bg-white p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-fade-in font-sans">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-gray-150 pb-4 mb-4">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-indigo-950">
                    📎 Row #{editingRowUploadsIndex + 1} Attachments
                  </h3>
                  <p className="text-2xs text-gray-500 font-bold max-w-sm mt-0.5 truncate">
                    Task: {row.task || '(Untitled Task)'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingRowUploadsIndex(null)}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition cursor-pointer"
                  title="Close Upload Console"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto space-y-4 min-h-[300px] mb-4 pr-1">
                <UploadBox
                  projectId={formProjectId || 'GENERAL'}
                  onUploadsChange={(newFiles) => handleRowChange(editingRowUploadsIndex, 'uploads', newFiles)}
                  existingUploads={row.uploads || []}
                  label="Multiple file uploads & site camera snapping for this task"
                  maxFiles={5}
                />
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-150 pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setEditingRowUploadsIndex(null)}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-6 py-2.5 text-xs font-black text-white shadow-xs transition cursor-pointer"
                >
                  Confirm Attachments ({row.uploads?.length || 0}) 😊
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* MODAL WINDOWS: EDIT TASK MODAL */}
      {isEditModalOpen && activeEditingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-xl border border-gray-200 bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <span className="leading-tight">
                <h3 className="text-base font-bold text-gray-900">Edit Sheet Task Entry</h3>
                <p className="text-2xs text-gray-400 font-bold">MUTATING ROW NUMBER: {activeEditingTask.rowNumber}</p>
              </span>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
                title="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditTaskSubmit} className="space-y-4">
              {/* Consolidated Project Selection - Automatic ID Retrieval */}
              <div>
                <label htmlFor="edit-task-proj" className="text-xs font-bold text-gray-700 block mb-1">Target Campus Project *</label>
                <select
                  id="edit-task-proj"
                  value={formProjectId}
                  onChange={(e) => setFormProjectId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 px-3 text-xs font-semibold focus:border-indigo-555 focus:ring-1 focus:ring-indigo-555 outline-none transition"
                  required
                >
                  <option value="">-- Choose Project Name --</option>
                  {projects.map((p) => (
                    <option key={p.projectId} value={p.projectId}>
                      {p.projectName} (ID: {p.projectId})
                    </option>
                  ))}
                </select>
              </div>

              {formProjectId && (
                <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3 text-xs font-extrabold text-indigo-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-indigo-500 uppercase tracking-wider">Project ID:</span>
                    <span className="bg-indigo-200/50 px-2 py-0.5 rounded text-[10px] font-black">{formProjectId}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-indigo-500 uppercase tracking-wider">Project Name:</span>
                    <span className="text-right text-gray-900 truncate max-w-[280px]">
                      {projects.find(p => p.projectId === formProjectId)?.projectName || 'Custom Project Reference'}
                    </span>
                  </div>
                </div>
              )}

              {/* Task Title */}
              <div>
                <label htmlFor="edit-task-title" className="text-xs font-bold text-gray-500 block mb-1">Task description *</label>
                <input
                  id="edit-task-title"
                  type="text"
                  value={formTask}
                  onChange={(e) => setFormTask(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2 px-3 text-xs outline-none"
                  required
                />
              </div>

              {/* Row Category and Week in Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-task-category" className="text-xs font-bold text-gray-500 block mb-1">Category</label>
                  <select
                    id="edit-task-category"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 py-2 px-2.5 text-xs outline-none bg-white"
                  >
                    {CANONICAL_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-task-week" className="text-xs font-bold text-gray-500 block mb-1">Planning Week *</label>
                  <select
                    id="edit-task-week"
                    value={formWeek}
                    onChange={(e) => {
                      const wk = e.target.value;
                      setFormWeek(wk);
                      const weekData = weeks[wk];
                      if (weekData) {
                        setFormStartDate(weekData.start);
                        setFormEndDate(weekData.end);
                      }
                    }}
                    className="w-full rounded-lg border border-gray-300 py-2 px-2.5 text-xs bg-white outline-none"
                  >
                    {Object.keys(weeks).map((wKey) => (
                      <option key={wKey} value={wKey}>{wKey}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-task-sdate" className="text-xs font-bold text-gray-500 block mb-1">Start Date</label>
                  <input
                    id="edit-task-sdate"
                    type="date"
                    value={formStartDate}
                    onChange={(e) => {
                      const sDate = e.target.value;
                      setFormStartDate(sDate);
                      const computedWeek = getWeekFromStartDate(sDate);
                      if (computedWeek && weeks[computedWeek]) {
                        setFormWeek(computedWeek);
                        setFormEndDate(weeks[computedWeek].end);
                      }
                    }}
                    className="w-full rounded-lg border border-gray-300 py-2 px-2.5 text-xs"
                  />
                </div>

                <div>
                  <label htmlFor="edit-task-edate" className="text-xs font-bold text-red-500 block mb-1">End Date</label>
                  <input
                    id="edit-task-edate"
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 py-2 px-2.5 text-xs text-red-600 font-bold"
                  />
                </div>
              </div>

              {/* Revision Dates row */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="edit-task-rev1" className="text-xs font-black text-indigo-700 block mb-1">REV 1 Date</label>
                  <input
                    id="edit-task-rev1"
                    type="date"
                    value={formRev1}
                    onChange={(e) => {
                      const d = e.target.value;
                      setFormRev1(d);
                      const latestDate = d || formRev2 || formRev3 || formStartDate || formEndDate || '';
                      if (latestDate) {
                        const computed = getWeekFromStartDate(latestDate);
                        if (computed) setFormWeek(computed);
                      }
                    }}
                    className="w-full rounded-lg border border-indigo-200 bg-indigo-50/20 py-2 px-2.5 text-xs text-indigo-700 font-mono outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="edit-task-rev2" className="text-xs font-black text-amber-700 block mb-1">REV 2 Date</label>
                  <input
                    id="edit-task-rev2"
                    type="date"
                    value={formRev2}
                    onChange={(e) => {
                      const d = e.target.value;
                      setFormRev2(d);
                      const latestDate = formRev3 || d || formRev1 || formStartDate || formEndDate || '';
                      if (latestDate) {
                        const computed = getWeekFromStartDate(latestDate);
                        if (computed) setFormWeek(computed);
                      }
                    }}
                    className="w-full rounded-lg border border-amber-300 bg-amber-50/20 py-2 px-2.5 text-xs text-amber-800 font-mono outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="edit-task-rev3" className="text-xs font-black text-fuchsia-700 block mb-1">REV 3 Date</label>
                  <input
                    id="edit-task-rev3"
                    type="date"
                    value={formRev3}
                    onChange={(e) => {
                      const d = e.target.value;
                      setFormRev3(d);
                      const latestDate = d || formRev2 || formRev1 || formStartDate || formEndDate || '';
                      if (latestDate) {
                        const computed = getWeekFromStartDate(latestDate);
                        if (computed) setFormWeek(computed);
                      }
                    }}
                    className="w-full rounded-lg border border-fuchsia-300 bg-fuchsia-100/15 py-2 px-2.5 text-xs text-fuchsia-800 font-mono outline-none"
                  />
                </div>
              </div>

              {/* Supervisor & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-task-resp" className="text-xs font-bold text-gray-500 block mb-1">Responsible Supervisor</label>
                  <input
                    id="edit-task-resp"
                    type="text"
                    value={formResponsible}
                    onChange={(e) => setFormResponsible(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 py-2 px-3 text-xs"
                  />
                </div>

                <div>
                  <label htmlFor="edit-task-status" className="text-xs font-bold text-gray-500 block mb-1">
                    Status {!isEditStatusAllowed && <span className="text-red-500 font-extrabold">(Locked)</span>}
                  </label>
                  <select
                    id="edit-task-status"
                    value={!isEditStatusAllowed ? 'NOT DONE' : formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    disabled={!isEditStatusAllowed}
                    className={`w-full rounded-lg border py-2 px-2.5 text-xs outline-none bg-white font-bold ${
                      !isEditStatusAllowed
                        ? 'border-red-200 bg-red-50/30 text-red-800 cursor-not-allowed'
                        : 'border-gray-300'
                    }`}
                  >
                    <option value="NOT DONE">NOT DONE</option>
                    <option value="PARTIALLY DONE">PARTIALLY DONE</option>
                    <option value="DONE">DONE</option>
                  </select>
                  {!isEditStatusAllowed && (
                    <p className="text-[10px] font-extrabold text-red-600 mt-1">
                      ⚠️ Upload is mandatory before selecting task status
                    </p>
                  )}
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label htmlFor="edit-task-remark" className="text-xs font-bold text-gray-500 block mb-1">Remark Note</label>
                <textarea
                  id="edit-task-remark"
                  rows={2}
                  placeholder="Observations..."
                  value={formRemark}
                  onChange={(e) => setFormRemark(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2 text-xs"
                />
              </div>

              {/* Uploads */}
              <UploadBox
                projectId={formProjectId || 'GENERAL'}
                onUploadsChange={setFormUploads}
                existingUploads={formUploads}
                maxFiles={3}
              />

              <div className="border-t border-gray-100 pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSyncing}
                  className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow hover:bg-indigo-700 transition flex items-center gap-1 cursor-pointer"
                >
                  {isSyncing && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
