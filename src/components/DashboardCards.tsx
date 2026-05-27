import React from 'react';
import { 
  ClipboardList, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle 
} from 'lucide-react';

interface MetricType {
  total: number;
  done: number;
  notDone: number;
  partiallyDone: number;
  overdue: number;
}

interface DashboardCardsProps {
  metrics: MetricType;
  onCardClick?: (filterStatus: string | null) => void;
  activeStatusFilter: string | null | 'OVERDUE';
}

export default function DashboardCards({ 
  metrics, 
  onCardClick,
  activeStatusFilter 
}: DashboardCardsProps) {
  const cards = [
    {
      id: 'ALL',
      title: 'Total Tasks',
      value: metrics.total,
      icon: ClipboardList,
      color: 'bg-indigo-50 border-indigo-100 text-indigo-700',
      iconColor: 'bg-indigo-100 text-indigo-600',
      statusValue: null,
      description: 'Listed works assigned'
    },
    {
      id: 'DONE',
      title: 'Done',
      value: metrics.done,
      icon: CheckCircle2,
      color: 'bg-emerald-50 border-emerald-100 text-emerald-700',
      iconColor: 'bg-emerald-100 text-emerald-600',
      statusValue: 'DONE',
      description: 'Work completed'
    },
    {
      id: 'PARTIALLY DONE',
      title: 'Partially Done',
      value: metrics.partiallyDone,
      icon: Clock,
      color: 'bg-amber-50 border-amber-100 text-amber-700',
      iconColor: 'bg-amber-100 text-amber-600',
      statusValue: 'PARTIALLY DONE',
      description: 'Ongoing work in progress'
    },
    {
      id: 'NOT DONE',
      title: 'Not Done',
      value: metrics.notDone,
      icon: XCircle,
      color: 'bg-rose-50 border-rose-100 text-rose-700',
      iconColor: 'bg-rose-100 text-rose-600',
      statusValue: 'NOT DONE',
      description: 'Unstarted tasks'
    }
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-4">
      {cards.map((card) => {
        const IconComponent = card.icon;
        const isSelected = activeStatusFilter === card.statusValue;

        return (
          <button
            key={card.title}
            onClick={() => onCardClick && onCardClick(card.statusValue)}
            className={`flex flex-col justify-between rounded-lg border p-2.5 text-left transition hover:scale-[1.01] hover:shadow-2xs cursor-pointer ${
              card.color
            } ${
              isSelected 
                ? 'ring-2 ring-indigo-600 ring-offset-1 font-semibold shadow-xs' 
                : 'shadow-3xs shadow-black/[0.01]'
            }`}
          >
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-inherit/80">
                {card.title}
              </span>
              <div className={`rounded-md p-1 ${card.iconColor}`}>
                <IconComponent className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-1.5">
              <span className="text-lg font-black tracking-tight leading-none">
                {card.value}
              </span>
              <p className="mt-0.5 text-[9.5px] text-inherit/70 font-bold truncate">
                {card.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
