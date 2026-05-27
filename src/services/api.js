/**
 * API Service for Site Planning Dashboard
 * Backend: Google Apps Script Web App
 */

const API_URL = typeof window !== 'undefined' ? `${window.location.origin}/api/proxy` : '/api/proxy';

/**
 * Generic request helper to handle GAS-specific quirks (CORS & Redirects)
 */
async function request(options = {}) {
  const { method = 'POST', action, data = null } = options;
  
  const url = new URL(API_URL);

  const fetchOptions = {
    method: method,
    redirect: 'follow', // Required for Google Apps Script redirects
  };

  if (method === 'POST') {
    // We use 'text/plain' to avoid CORS pre-flight OPTIONS request which GAS does not handle well
    fetchOptions.headers = {
      'Content-Type': 'text/plain;charset=utf-8',
    };
    fetchOptions.body = JSON.stringify({ action, ...data });
  } else {
    url.searchParams.append('action', action);
  }

  try {
    const response = await fetch(url.toString(), fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    if (result.status === 'error' || result.success === false) {
      throw new Error(result.message || 'API Action failed');
    }
    
    return result;
  } catch (error) {
    console.error(`API Error (${action}):`, error);
    throw error;
  }
}

/**
 * Fetches all site projects from Google Sheets
 * @returns {Promise<Object>} Response containing status and array of projects ({ projectId, projectName })
 */
export const getProjects = async () => {
  return request({ action: 'getProjects' });
};

/**
 * Fetches all tasks from the site_data Google Sheet
 * @returns {Promise<Object>} Response containing status and array of tasks
 */
export const getTasks = async () => {
  return request({ action: 'getTasks' });
};

/**
 * Adds one or multiple tasks
 * @param {Array|Object} tasks - A single task object or array of task objects
 * @returns {Promise<Object>} API Response
 */
export const addTasks = async (tasks) => {
  return request({ 
    method: 'POST', 
    action: 'addTasks', 
    data: { tasks: Array.isArray(tasks) ? tasks : [tasks] } 
  });
};

/**
 * Updates an existing task
 * @param {string|number} taskId - ID of the task to update (usually the sheet row number)
 * @param {Object} updates - Key-value map of columns to update
 * @returns {Promise<Object>} API Response
 */
export const updateTask = async (taskId, updates) => {
  const gasUpdates = {};
  
  if (updates) {
    Object.keys(updates).forEach(key => {
      const trimmedKey = key.trim().toUpperCase();
      
      // Map to exact Google Sheet column header names, populating both with/without space variations
      if (trimmedKey === 'PROJECT ID' || key === 'PROJECT ID  ') {
        gasUpdates['PROJECT ID  '] = updates[key];
        gasUpdates['PROJECT ID'] = updates[key];
      } else if (trimmedKey === 'TASK UPLOADS' || trimmedKey === 'UPLOAD') {
        gasUpdates['UPLOAD'] = updates[key];
        gasUpdates['UPLOAD '] = updates[key];
      } else if (trimmedKey === 'STATUS') {
        gasUpdates['STATUS'] = updates[key];
        gasUpdates['STATUS '] = updates[key];
      } else if (trimmedKey === 'ACTUAL TIME') {
        gasUpdates['ACTUAL TIME'] = updates[key];
        gasUpdates['ACTUAL TIME '] = updates[key];
      } else if (trimmedKey === 'REMARK') {
        // Col M is 'REMARK' (Supervisor/Final Comment). 
        // Col I is 'REMARK ' (Planner Remark, 1 space).
        // Let's safe-write to both so they sync and neither becomes empty.
        gasUpdates['REMARK'] = updates[key];
        gasUpdates['REMARK '] = updates[key];
      } else if (trimmedKey === 'REVISION DATE' || trimmedKey === 'REVISION_DATE' || trimmedKey.includes('REVISION')) {
        gasUpdates['REVISION DATE'] = updates[key];
        gasUpdates['REVISION DATE '] = updates[key];
      } else if (trimmedKey === 'REV 1' || trimmedKey === 'REV 1 ') {
        gasUpdates['REV 1'] = updates[key];
        gasUpdates['REV 1 '] = updates[key];
      } else if (trimmedKey === 'REV 2' || trimmedKey === 'REV 2 ') {
        gasUpdates['REV 2'] = updates[key];
        gasUpdates['REV 2 '] = updates[key];
      } else if (trimmedKey === 'REV 3' || trimmedKey === 'REV 3 ') {
        gasUpdates['REV 3'] = updates[key];
        gasUpdates['REV 3 '] = updates[key];
      } else {
        gasUpdates[key] = updates[key];
      }
    });
  }

  return request({ 
    method: 'POST', 
    action: 'updateTask', 
    data: { 
      id: Number(taskId),
      row: Number(taskId),
      updates: gasUpdates 
    } 
  });
};

/**
 * Deletes a task by ID (corresponds to row number or custom ID)
 * @param {string|number} taskId - Row number of the task to delete
 * @returns {Promise<Object>} API Response
 */
export const deleteTask = async (taskId) => {
  return request({ 
    method: 'POST', 
    action: 'deleteTask', 
    data: { 
      id: Number(taskId), 
      row: Number(taskId) 
    } 
  });
};

/**
 * Uploads a file to Google Drive via the Apps Script backend.
 * Converts the file input into a Base64 string for secure transmission.
 * @param {File} file - The raw File object from input, drag-and-drop, or camera
 * @param {string} [projectId="GENERAL"] - Optional project ID for creating/using target custom upload folder
 * @returns {Promise<Object>} Response containing uploaded file URL, ID, and name
 */
export const uploadFile = async (file, projectId = "GENERAL") => {
  const base64File = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // FileReader result formatting: "data:image/png;base64,iVBORw0KGgoAAA..." -> Extract only the raw Base64 data
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      } else {
        reject(new Error("Failed to read file as data string"));
      }
    };
    reader.onerror = (error) => reject(error);
  });

  return request({
    method: 'POST',
    action: 'uploadFile',
    data: {
      projectId: projectId,
      filename: file.name,
      mimeType: file.type,
      base64: base64File,
    }
  });
};
