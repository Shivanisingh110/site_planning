/**
 * Utility to determine if a task belongs to or was logged by a specific supervisor.
 * This checks both PERSON RESPONSIBLE and DOER fields dynamically and bidirectionally,
 * handling both name strings (like "Suraj Ubhare") and email addresses (like "ubharesuraj2000@gmail.com").
 */

const SUPERVISORS = [
  {
    name: 'Suraj Ubhare',
    short: 'suraj',
    fullName: 'suraj ubhare',
    email: 'ubharesuraj2000@gmail.com',
    prefix: 'ubharesuraj2000'
  },
  {
    name: 'Mangesh Kumbhar',
    short: 'mangesh',
    fullName: 'mangesh kumbhar',
    email: 'msskumbhar@gmail.com',
    prefix: 'msskumbhar'
  },
  {
    name: 'Ganesh',
    short: 'ganesh',
    fullName: 'ganesh',
    email: 'ganeshw110@gmail.com',
    prefix: 'ganeshw110',
    altEmail: 'ganesh110@gmail.com',
    altPrefix: 'ganesh110'
  }
];

const findSupervisor = (qStr: string): any => {
  if (!qStr) return null;
  const q = qStr.toLowerCase().trim();
  
  // Try direct matches first
  const directMatch = SUPERVISORS.find(sup => 
    q === sup.email || 
    q === sup.prefix || 
    q === sup.fullName || 
    q === sup.short ||
    (sup.altEmail && q === sup.altEmail) ||
    (sup.altPrefix && q === sup.altPrefix)
  );
  if (directMatch) return directMatch;
  
  // Try partial mapping
  return SUPERVISORS.find(sup => 
    q.includes(sup.short) || 
    q.includes(sup.prefix) || 
    (sup.altPrefix && q.includes(sup.altPrefix)) ||
    sup.fullName.includes(q) || 
    sup.email.includes(q) ||
    (sup.altEmail && sup.altEmail.includes(q))
  );
};

export const isTaskAssignedToSupervisor = (task: any, query: string): boolean => {
  if (!query) return false;
  
  const resp = (task['PERSON RESPONSIBLE'] || '').toLowerCase().trim();
  const doer = (task['DOER'] || '').toLowerCase().trim();

  // If both are empty, it's not assigned to anyone
  if (!resp && !doer) return false;

  const targetSupervisor = findSupervisor(query);
  
  // If query doesn't match any known supervisor, search by raw text containment
  if (!targetSupervisor) {
    const qLower = query.toLowerCase().trim();
    if (!qLower) return false;
    return (resp && resp.includes(qLower)) || 
           (doer && doer.includes(qLower)) || 
           (resp && qLower.includes(resp)) || 
           (doer && qLower.includes(doer));
  }
  
  // 1. If person responsible is a known supervisor, check if they are the target
  const respSupervisor = findSupervisor(resp);
  if (respSupervisor) {
    if (respSupervisor.email === targetSupervisor.email) {
      return true;
    }
  }
  
  // 2. If doer is a known supervisor, check if they are the target
  const doerSupervisor = findSupervisor(doer);
  if (doerSupervisor) {
    if (doerSupervisor.email === targetSupervisor.email) {
      return true;
    }
  }
  
  // 3. Last fallback: Check if any identifier string matches
  const identifiers = [
    targetSupervisor.short,
    targetSupervisor.fullName,
    targetSupervisor.prefix,
    targetSupervisor.email
  ];
  
  return identifiers.some(id => 
    (resp && resp.includes(id)) || 
    (doer && doer.includes(id)) || 
    (resp && id.includes(resp)) || 
    (doer && id.includes(doer))
  );
};
