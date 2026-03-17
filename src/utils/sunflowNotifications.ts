// Sunflow O&M Pro - Email Notification Service
// Ready for SendGrid / Resend integration

import type { Alert, WorkOrder, AlertSeverity } from '@/integrations/sunflow/types';

const BRAND_COLOR = '#F59E0B'; // Evolight amber
const BRAND_NAME = 'Sunflow O&M Pro';
const PLATFORM_URL = typeof window !== 'undefined' ? window.location.origin : '';

// ============================================================
// SEVERITY INDICATORS
// ============================================================

const severityEmoji: Record<AlertSeverity, string> = {
  info: '🔵',
  warning: '🟡',
  error: '🟠',
  critical: '🔴',
};

const severityColor: Record<AlertSeverity, string> = {
  info: '#3B82F6',
  warning: '#F59E0B',
  error: '#F97316',
  critical: '#EF4444',
};

// ============================================================
// HTML EMAIL TEMPLATES
// ============================================================

function baseTemplate(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr>
          <td style="background:${BRAND_COLOR};padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0;color:#FFFFFF;font-size:20px;font-weight:700;">☀️ ${BRAND_NAME}</p>
                  <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">${title}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Content -->
        <tr><td style="padding:32px;">${content}</td></tr>
        <!-- Footer -->
        <tr>
          <td style="background:#F3F4F6;padding:20px 32px;border-top:1px solid #E5E7EB;">
            <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;">
              ${BRAND_NAME} · Monitoramento de Usinas Solares<br/>
              <a href="${PLATFORM_URL}" style="color:${BRAND_COLOR};text-decoration:none;">Acessar plataforma</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildAlertEmailHtml(alert: Alert & { plantName?: string }): string {
  const emoji = severityEmoji[alert.severity];
  const color = severityColor[alert.severity];
  const alertUrl = `${PLATFORM_URL}/sunflow/alerts`;

  const content = `
    <div style="margin-bottom:24px;">
      <span style="display:inline-block;background:${color}1A;color:${color};border:1px solid ${color}40;border-radius:6px;padding:4px 10px;font-size:13px;font-weight:600;">
        ${emoji} ${alert.severity.toUpperCase()}
      </span>
      ${alert.plantName ? `<span style="margin-left:8px;font-size:13px;color:#6B7280;">${alert.plantName}</span>` : ''}
    </div>

    <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">${alert.title}</h2>
    <p style="margin:0 0 24px;font-size:15px;color:#4B5563;line-height:1.6;">${alert.message}</p>

    ${alert.metric_name ? `
    <table style="width:100%;background:#F9FAFB;border-radius:8px;padding:16px;margin-bottom:24px;" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:13px;color:#6B7280;">Métrica</td>
        <td style="font-size:13px;color:#6B7280;">Valor Atual</td>
        ${alert.threshold_value !== null ? '<td style="font-size:13px;color:#6B7280;">Threshold</td>' : ''}
      </tr>
      <tr>
        <td style="font-size:15px;font-weight:600;color:#111827;padding-top:4px;">${alert.metric_name}</td>
        <td style="font-size:15px;font-weight:600;color:${color};padding-top:4px;">${alert.metric_value ?? '—'}</td>
        ${alert.threshold_value !== null ? `<td style="font-size:15px;padding-top:4px;color:#6B7280;">${alert.threshold_value}</td>` : ''}
      </tr>
    </table>` : ''}

    <a href="${alertUrl}"
       style="display:inline-block;background:${BRAND_COLOR};color:#FFFFFF;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">
      Ver alertas na plataforma →
    </a>
  `;

  return baseTemplate(`Alerta ${alert.severity.toUpperCase()}: ${alert.title}`, content);
}

export function buildWorkOrderEmailHtml(wo: WorkOrder & { plantName?: string; assigneeName?: string }): string {
  const woUrl = `${PLATFORM_URL}/sunflow/work-orders`;

  const typeLabels: Record<string, string> = {
    preventive: 'Preventiva',
    corrective: 'Corretiva',
    inspection: 'Inspeção',
    emergency: 'Emergência',
    improvement: 'Melhoria',
  };

  const priorityLabels: Record<string, string> = {
    low: 'Baixa',
    medium: 'Média',
    high: 'Alta',
    critical: 'Crítica',
  };

  const content = `
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">${wo.title}</h2>
    <p style="margin:0 0 4px;font-size:13px;color:#6B7280;font-family:monospace;">${wo.wo_number}</p>
    ${wo.plantName ? `<p style="margin:0 0 24px;font-size:14px;color:#4B5563;">Usina: <strong>${wo.plantName}</strong></p>` : ''}

    <table style="width:100%;background:#F9FAFB;border-radius:8px;padding:16px;margin-bottom:24px;border-collapse:collapse;" cellpadding="8" cellspacing="0">
      <tr>
        <td style="font-size:13px;color:#6B7280;border-bottom:1px solid #E5E7EB;">Tipo</td>
        <td style="font-size:13px;font-weight:600;color:#111827;border-bottom:1px solid #E5E7EB;">${typeLabels[wo.type] ?? wo.type}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#6B7280;border-bottom:1px solid #E5E7EB;">Prioridade</td>
        <td style="font-size:13px;font-weight:600;color:#111827;border-bottom:1px solid #E5E7EB;">${priorityLabels[wo.priority] ?? wo.priority}</td>
      </tr>
      ${wo.assigneeName ? `
      <tr>
        <td style="font-size:13px;color:#6B7280;border-bottom:1px solid #E5E7EB;">Responsável</td>
        <td style="font-size:13px;font-weight:600;color:#111827;border-bottom:1px solid #E5E7EB;">${wo.assigneeName}</td>
      </tr>` : ''}
      ${wo.scheduled_date ? `
      <tr>
        <td style="font-size:13px;color:#6B7280;">Data Agendada</td>
        <td style="font-size:13px;font-weight:600;color:#111827;">${new Date(wo.scheduled_date).toLocaleDateString('pt-BR')}</td>
      </tr>` : ''}
    </table>

    ${wo.description ? `<p style="font-size:14px;color:#4B5563;line-height:1.6;margin-bottom:24px;">${wo.description}</p>` : ''}

    <a href="${woUrl}"
       style="display:inline-block;background:${BRAND_COLOR};color:#FFFFFF;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">
      Ver OS na plataforma →
    </a>
  `;

  return baseTemplate(`OS ${wo.wo_number}: ${wo.title}`, content);
}

// ============================================================
// SEND FUNCTIONS
// Ready to plug in SendGrid, Resend, or any SMTP provider
// ============================================================

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  // Replace this stub with your email provider:
  //
  // Option A – Resend:
  //   const resend = new Resend(process.env.RESEND_API_KEY);
  //   await resend.emails.send({ from: 'noreply@yourdomain.com', ...payload });
  //
  // Option B – SendGrid:
  //   await sgMail.send({ from: 'noreply@yourdomain.com', ...payload });
  //
  // Option C – Supabase Edge Function:
  //   await supabase.functions.invoke('send-email', { body: payload });

  console.log('[sunflowNotifications] sendEmail:', payload.subject, '→', payload.to);
}

export async function notifyAlert(
  alert: Alert & { plantName?: string },
  recipients: string[]
): Promise<void> {
  if (!recipients.length) return;
  const html = buildAlertEmailHtml(alert);
  await sendEmail({
    to: recipients,
    subject: `${severityEmoji[alert.severity]} [${alert.severity.toUpperCase()}] ${alert.title}`,
    html,
  });
}

export async function notifyWorkOrderAssignment(
  wo: WorkOrder & { plantName?: string; assigneeName?: string },
  assigneeEmail: string
): Promise<void> {
  const html = buildWorkOrderEmailHtml(wo);
  await sendEmail({
    to: assigneeEmail,
    subject: `[OS Atribuída] ${wo.wo_number} - ${wo.title}`,
    html,
  });
}
