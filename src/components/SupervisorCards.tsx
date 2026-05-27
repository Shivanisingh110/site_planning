import React from 'react';
import { UserCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { isTaskAssignedToSupervisor } from '../utils/supervisorMatcher';

interface TaskType {
  [key: string]: any; // Matches Google Sheets structure
}

interface SupervisorCardsProps {
  tasks: TaskType[];
  selectedSupervisor: string | null;
  setSelectedSupervisor: (supervisor: string | null) => void;
  selectedProject?: string;
}

export default function SupervisorCards({
  tasks,
  selectedSupervisor,
  setSelectedSupervisor,
  selectedProject,
}: SupervisorCardsProps) {
  const supervisors = [
    { name: 'Suraj Ubhare', role: 'Site Supervisor' },
    { name: 'Mangesh Kumbhar', role: 'Site Supervisor' },
    { name: 'Ganesh', role: 'Site Supervisor' },
  ];

  // Helper to compute stats for a specific supervisor
  const getSupervisorStats = (name: string) => {
    const supervisorTasks = tasks.filter(t => isTaskAssignedToSupervisor(t, name));

    const total = supervisorTasks.length;
    const done = supervisorTasks.filter(t => (t['STATUS'] || '').toUpperCase() === 'DONE').length;
    const pending = total - done;

    return { total, done, pending };
  };

  const handleToggle = (name: string) => {
    if (selectedSupervisor === name) {
      setSelectedSupervisor(null); // Clear filter
    } else {
      setSelectedSupervisor(name); // Apply filter
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400">
          Responsible Supervisors
        </h3>
        {selectedSupervisor && (
          <button
            onClick={() => setSelectedSupervisor(null)}
            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
          >
            Clear Filter
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {supervisors.map((sup) => {
          const stats = getSupervisorStats(sup.name);
          const isActive = selectedSupervisor === sup.name;

          const isWorkedOn = React.useMemo(() => {
            if (!selectedProject) return false;
            const selPid = String(selectedProject).trim().toUpperCase().replace(/\s+/g, '');
            const projectTasks = tasks.filter(t => {
              const tPid = String(t['PROJECT ID'] || '').trim().toUpperCase().replace(/\s+/g, '');
              return tPid === selPid;
            });
            return projectTasks.some(t => isTaskAssignedToSupervisor(t, sup.name));
          }, [tasks, selectedProject, sup.name]);

          let cardStyle = 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 shadow-3xs';
          let iconStyle = 'bg-gray-100 text-gray-500';

          if (isActive) {
            cardStyle = 'border-indigo-600 bg-indigo-50/70 text-indigo-900 shadow-2xs ring-2 ring-indigo-600/25';
            iconStyle = 'bg-indigo-100 text-indigo-700';
          } else if (isWorkedOn) {
            cardStyle = 'border-emerald-500 bg-emerald-50/40 text-emerald-950 shadow-2xs ring-2 ring-emerald-500/25';
            iconStyle = 'bg-emerald-100 text-emerald-700';
          }

          return (
            <button
              key={sup.name}
              onClick={() => handleToggle(sup.name)}
              className={`flex items-center justify-between rounded-lg border p-2 sm:p-2.5 text-left transition-all duration-200 hover:scale-[1.01] hover:shadow-3xs cursor-pointer ${cardStyle} w-full`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconStyle} transition-colors duration-150`}>
                  <UserCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="text-xs sm:text-xs font-black tracking-tight truncate text-gray-950 leading-tight">{sup.name}</h4>
                    {isWorkedOn && !isActive && (
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[7px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300/30 shrink-0 tracking-wider">
                        Worked
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] text-gray-400 font-bold tracking-tight truncate mt-0.5">{sup.role}</p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-0.5 shrink-0 pl-2">
                <span className="text-[9px] font-black text-gray-800 bg-gray-100 border border-gray-200/50 px-2 py-0.2 rounded-full shadow-3xs">
                  {stats.total} Tasks
                </span>
                <div className="flex items-center gap-1.5 text-[9px] font-black">
                  <span className="flex items-center gap-0.5 text-emerald-600">
                    <CheckCircle2 className="h-3 w-3" />
                    {stats.done}
                  </span>
                  <span className="flex items-center gap-0.5 text-amber-600">
                    <AlertCircle className="h-3 w-3" />
                    {stats.pending}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
