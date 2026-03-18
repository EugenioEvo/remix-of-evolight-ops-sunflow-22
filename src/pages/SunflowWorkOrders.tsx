import React from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Work Orders page redirects to the existing OS system since
// there is no separate work_orders table — solar work is managed via tickets/ordens_servico.

export default function SunflowWorkOrders() {
  return (
    <div className="p-6 space-y-6 text-center">
      <div className="flex items-center justify-center gap-3">
        <ClipboardList className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Ordens de Serviço Solar</h1>
      </div>
      <p className="text-muted-foreground max-w-md mx-auto">
        As ordens de serviço de plantas solares são gerenciadas pelo sistema de tickets e OS existente.
        Alertas críticos geram tickets automaticamente.
      </p>
      <div className="flex gap-3 justify-center">
        <Button asChild variant="outline">
          <Link to="/tickets">Ver Tickets</Link>
        </Button>
        <Button asChild>
          <Link to="/visualizar-os">Ver Ordens de Serviço</Link>
        </Button>
      </div>
    </div>
  );
}
