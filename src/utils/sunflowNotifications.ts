// Sunflow O&M Pro - Email Notification Service
// Ready for SendGrid / Resend integration

import type { AlertSeverity } from '@/components/sunflow/StatusBadge';

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
        <tr>
          <td style="background:${BRAND_COLOR};padding:24px 32px;">
            <p style="margin:0;color:#FFFFFF;font-size:20px;font-weight:700;">☀️ ${BRAND_NAME}</p>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">${title}</p>
          </td>
        </tr>
        <tr><td style="padding:32px;">${content}</td></tr>
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

interface AlertEmailData {
  titulo: string;
  descricao?: string | null;
  severidade: AlertSeverity;
  plantName?: string;
  created_at: string;
}

export function buildAlertEmailHtml(alert: AlertEmailData): string {
  const emoji = severityEmoji[alert.severidade];
  const color = severityColor[alert.severidade];
  const alertUrl = `${PLATFORM_URL}/sunflow/alerts`;

  const content = `
    <div style="margin-bottom:24px;">
      <span style="display:inline-block;background:${color}1A;color:${color};border:1px solid ${color}40;border-radius:6px;padding:4px 10px;font-size:13px;font-weight:600;">
        ${emoji} ${alert.severidade.toUpperCase()}
      </span>
      ${alert.plantName ? `<span style="margin-left:8px;font-size:13px;color:#6B7280;">${alert.plantName}</span>` : ''}
    </div>
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">${alert.titulo}</h2>
    ${alert.descricao ? `<p style="margin:0 0 24px;font-size:15px;color:#4B5563;line-height:1.6;">${alert.descricao}</p>` : ''}
    <a href="${alertUrl}"
       style="display:inline-block;background:${BRAND_COLOR};color:#FFFFFF;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">
      Ver alertas na plataforma →
    </a>
  `;

  return baseTemplate(`Alerta ${alert.severidade.toUpperCase()}: ${alert.titulo}`, content);
}

// ============================================================
// SEND FUNCTIONS
// ============================================================

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  // Stub — plug in your email provider (Resend, SendGrid, etc.)
}

export async function notifyAlert(
  alert: AlertEmailData,
  recipients: string[]
): Promise<void> {
  if (!recipients.length) return;
  const html = buildAlertEmailHtml(alert);
  await sendEmail({
    to: recipients,
    subject: `${severityEmoji[alert.severidade]} [${alert.severidade.toUpperCase()}] ${alert.titulo}`,
    html,
  });
}
