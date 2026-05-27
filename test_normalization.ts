import fetch from 'node-fetch';
import { isTaskAssignedToSupervisor } from './src/utils/supervisorMatcher';

const SUPERVISOR_MAP: Record<string, string> = {
  'ubharesuraj2000@gmail.com': 'Suraj Ubhare',
  'msskumbhar@gmail.com': 'Mangesh Kumbhar',
  'ganeshw110@gmail.com': 'Ganesh',
  'ganesh110@gmail.com': 'Ganesh',
  'sunily198980@gmail.com': 'Sunil',
};

function normalizeCategory(categoryStr: string): string {
  const c = String(categoryStr || '').trim().toUpperCase();
  if (c.includes('PHOTO') || c.includes('SITE PHOTO')) return 'Photo of Site (Mandatory)';
  if (c.includes('SAT') || c.includes('SATURDAY')) return 'Mandatory SAT Report';
  if (c.includes('SCHEDULE') || c.includes('SITE SCHEDULE')) return 'Site Schedule Mandatory';
  if (c.includes('DRAWING')) return 'DRAWING';
  if (c.includes('WORK')) return 'WORK';
  if (c.includes('SELECTION')) return 'SELECTION';
  if (c.includes('MANDATORY UPLOADS') || c.includes('MANDATORY')) return 'Mandatory Uploads';
  return 'WORK'; // default fallback
}

async function run() {
  const url = 'https://script.google.com/macros/s/AKfycbwvBHaljaztP7eZaOukQ1m0HN4hh2wkmc_Ovfj5B4VOItWsmI5yDgRcQ0IWYaF3Cb9yMA/exec?action=getTasks';
  const res = await fetch(url, { redirect: 'follow' });
  const taskRes: any = await res.json();
  
  if (taskRes.status !== 'success' || !Array.isArray(taskRes.data)) {
    console.log("Failed to fetch:", taskRes);
    return;
  }
  
  console.log("Fetched raw rows:", taskRes.data.length);
  
  const normalizedTasks = taskRes.data
    .map((t: any) => {
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
        } else if (cleanKey === 'ROWNUMBER' || cleanKey === 'SHEETROW' || cleanKey === 'ROW') {
          normalized.rowNumber = t[key];
        } else {
          normalized[key] = t[key];
        }
      });

      if (t.sheetRow !== undefined) {
        normalized.rowNumber = t.sheetRow;
      } else if (t.rowNumber !== undefined) {
        normalized.rowNumber = t.rowNumber;
      } else if (normalized.rowNumber === undefined) {
        normalized.rowNumber = Math.random();
      }

      normalized['STATUS'] = normalized['STATUS'] !== undefined && String(normalized['STATUS']).trim() !== ''
        ? String(normalized['STATUS']).trim().toUpperCase()
        : 'NOT DONE';

      normalized['CATEGORY'] = normalizeCategory(normalized['CATEGORY'] || normalized['category'] || '');

      if (normalized['week'] === undefined) {
        normalized['week'] = t['week'] || t['Week'] || t['WEEK'] || 'Week-20';
      }
      if (normalized['week']) {
        const weekValueStr = String(normalized['week']).trim();
        const match = weekValueStr.match(/^week[- ]?(\d+)$/i);
        if (match) {
          normalized['week'] = `Week-${match[1]}`;
        } else {
          normalized['week'] = weekValueStr;
        }
      }

      return normalized;
    })
    .filter((t: any) => t !== null);

  console.log("Normalized check, got valid tasks count:", normalizedTasks.length);
  
  // Let's filter like Site Supervisor: ubharesuraj2000@gmail.com
  const currentUserEmail = 'ubharesuraj2000@gmail.com';
  const activeSupName = SUPERVISOR_MAP[currentUserEmail.toLowerCase()] || "Suraj Ubhare";
  
  const surajTasks = normalizedTasks.filter(t => 
    isTaskAssignedToSupervisor(t, activeSupName) || 
    isTaskAssignedToSupervisor(t, currentUserEmail)
  );
  
  console.log("Total tasks assigned to Suraj:", surajTasks.length);
  
  const week19SurajTasks = surajTasks.filter(t => {
    const tWeek = String(t['week'] || '').trim().toLowerCase();
    const selWeek = 'Week-19'.trim().toLowerCase();
    return tWeek === selWeek || tWeek.replace(/\s+/g, '') === selWeek.replace(/\s+/g, '');
  });
  
  console.log("Total tasks assigned to Suraj in Week-19:", week19SurajTasks.length);
  if (week19SurajTasks.length > 0) {
    console.log("First matched task for Suraj in Week-19:", JSON.stringify(week19SurajTasks[0], null, 2));
  } else {
    // If none found, show details of some suraj tasks to see their weeks
    console.log("Sample 5 tasks for Suraj to check their weeks:");
    console.log(JSON.stringify(surajTasks.slice(0, 5), null, 2));
  }
}

run();
