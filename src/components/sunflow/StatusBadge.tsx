import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type {
  PlantStatus,
  EquipmentStatus,
  WorkOrderStatus,
  WorkOrderPriority,
  AlertSeverity,
  AlertStatus,
  InspectionStatus,
} from '@/integrations/sunflow/types';

type BadgeContext =
  | { context: 'plant'; value: PlantStatus }
  | { context: 'equipment'; value: EquipmentStatus }
  | { context: 'workOrder'; value: WorkOrderStatus }
  | { context: 'priority'; value: WorkOrderPriority }
  | { context: 'alert'; value: AlertSeverity }
  | { context: 'alertStatus'; value: AlertStatus }
  | { context: 'inspection'; value: InspectionStatus };

type StatusBadgeProps = BadgeContext & { className?: string };

interface StatusConfig {
  label: string;
  className: string;
}

const plantConfig: Record<PlantStatus, StatusConfig> = {
  active: { label: 'Ativa', className: 'bg-green-100 text-green-800 border-green-200' },
  inactive: { label: 'Inativa', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  maintenance: { label: 'Manutenção', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  decommissioned: { label: 'Descomissionada', className: 'bg-red-100 text-red-700 border-red-200' },
};

const equipmentConfig: Record<EquipmentStatus, StatusConfig> = {
  operational: { label: 'Operacional', className: 'bg-green-100 text-green-800 border-green-200' },
  degraded: { label: 'Degradado', className: 'bg-orange-100 text-orange-800 border-orange-200' },
  failed: { label: 'Falha', className: 'bg-red-100 text-red-800 border-red-200' },
  maintenance: { label: 'Manutenção', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  offline: { label: 'Offline', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const workOrderConfig: Record<WorkOrderStatus, StatusConfig> = {
  open: { label: 'Aberta', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  assigned: { label: 'Atribuída', className: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  in_progress: { label: 'Em Andamento', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  completed: { label: 'Concluída', className: 'bg-green-100 text-green-800 border-green-200' },
  cancelled: { label: 'Cancelada', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const priorityConfig: Record<WorkOrderPriority, StatusConfig> = {
  low: { label: 'Baixa', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  medium: { label: 'Média', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  high: { label: 'Alta', className: 'bg-orange-100 text-orange-800 border-orange-200' },
  critical: { label: 'Crítica', className: 'bg-red-100 text-red-800 border-red-200' },
};

const alertSeverityConfig: Record<AlertSeverity, StatusConfig> = {
  info: { label: 'Info', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  warning: { label: 'Aviso', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  error: { label: 'Erro', className: 'bg-orange-100 text-orange-800 border-orange-200' },
  critical: { label: 'Crítico', className: 'bg-red-100 text-red-800 border-red-200' },
};

const alertStatusConfig: Record<AlertStatus, StatusConfig> = {
  active: { label: 'Ativo', className: 'bg-red-100 text-red-800 border-red-200' },
  acknowledged: { label: 'Reconhecido', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  resolved: { label: 'Resolvido', className: 'bg-green-100 text-green-800 border-green-200' },
};

const inspectionConfig: Record<InspectionStatus, StatusConfig> = {
  scheduled: { label: 'Agendada', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  in_progress: { label: 'Em Andamento', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  completed: { label: 'Concluída', className: 'bg-green-100 text-green-800 border-green-200' },
  cancelled: { label: 'Cancelada', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

function resolveConfig(props: StatusBadgeProps): StatusConfig {
  switch (props.context) {
    case 'plant': return plantConfig[props.value];
    case 'equipment': return equipmentConfig[props.value];
    case 'workOrder': return workOrderConfig[props.value];
    case 'priority': return priorityConfig[props.value];
    case 'alert': return alertSeverityConfig[props.value];
    case 'alertStatus': return alertStatusConfig[props.value];
    case 'inspection': return inspectionConfig[props.value];
  }
}

export function StatusBadge(props: StatusBadgeProps) {
  const config = resolveConfig(props);
  return (
    <Badge
      variant="outline"
      className={cn('text-xs font-medium', config.className, props.className)}
    >
      {config.label}
    </Badge>
  );
}
