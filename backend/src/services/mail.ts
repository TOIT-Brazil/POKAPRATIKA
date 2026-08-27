import { env } from '../config/env';

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char] ?? char));
}

type ActionEmailOptions = {
  preheader: string;
  eyebrow: string;
  title: string;
  intro: string;
  actionLabel: string;
  actionUrl?: string;
  actionToken?: string;
  actionHint: string;
  expiry: string;
  footer: string;
  accent: string;
};

function renderActionEmail(options: ActionEmailOptions): string {
  const safePreheader = escapeHtml(options.preheader);
  const safeEyebrow = escapeHtml(options.eyebrow);
  const safeTitle = escapeHtml(options.title);
  const safeIntro = escapeHtml(options.intro);
  const safeActionLabel = escapeHtml(options.actionLabel);
  const safeActionHint = escapeHtml(options.actionHint);
  const safeExpiry = escapeHtml(options.expiry);
  const safeFooter = escapeHtml(options.footer);
  const safeAccent = escapeHtml(options.accent);
  const safeUrl = options.actionUrl ? escapeHtml(options.actionUrl) : '';
  const safeToken = options.actionToken ? escapeHtml(options.actionToken) : '';
  const actionBlock = safeUrl
    ? `<tr>
              <td style="padding:0 32px 28px 32px;">
                <a href="${safeUrl}" style="display:inline-block;padding:14px 24px;border-radius:14px;background:${safeAccent};color:#062032;font:800 15px 'Segoe UI',Arial,sans-serif;text-decoration:none;box-shadow:0 14px 30px rgba(15,23,42,.18);">
                  ${safeActionLabel}
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 20px 32px;">
                <div style="padding:14px 16px;border-radius:16px;background:#f4f8fb;border:1px solid #d8e5f0;word-break:break-word;color:#24415d;font:600 13px 'Segoe UI',Arial,sans-serif;">
                  ${safeUrl}
                </div>
              </td>
            </tr>`
    : `<tr>
              <td style="padding:0 32px 20px 32px;">
                <div style="padding:16px;border-radius:16px;background:#f4f8fb;border:1px solid #d8e5f0;color:#24415d;font:700 14px 'Segoe UI',Arial,sans-serif;word-break:break-word;">
                  ${safeToken}
                </div>
              </td>
            </tr>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#eef3f8;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${safePreheader}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:linear-gradient(180deg,#edf5ff 0%,#eef3f8 100%);">
      <tr>
        <td align="center" style="padding:32px 14px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #dbe5ef;border-radius:28px;overflow:hidden;box-shadow:0 24px 60px rgba(15,23,42,.12);">
            <tr>
              <td style="padding:0;background:linear-gradient(135deg,#082f49 0%,#0f766e 52%,${safeAccent} 100%);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">
                  <tr>
                    <td style="padding:32px 32px 24px 32px;color:#f8fbff;">
                      <div style="display:inline-block;padding:7px 12px;border-radius:999px;background:rgba(255,255,255,.16);font:800 11px 'Segoe UI',Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;">
                        ${safeEyebrow}
                      </div>
                      <div style="padding-top:18px;font:900 30px/1.02 'Segoe UI',Arial,sans-serif;letter-spacing:-0.03em;">PlayField</div>
                      <div style="padding-top:10px;max-width:420px;font:500 15px/1.6 'Segoe UI',Arial,sans-serif;color:rgba(248,251,255,.92);">
                        Sistema oficial do grupo para manter presenca, temporada e operacao em campo sem gambiarra.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 18px 32px;color:#0f172a;">
                <div style="font:900 28px/1.08 'Segoe UI',Arial,sans-serif;letter-spacing:-0.03em;">${safeTitle}</div>
                <div style="padding-top:14px;font:500 15px/1.7 'Segoe UI',Arial,sans-serif;color:#334155;">
                  ${safeIntro}
                </div>
              </td>
            </tr>
            ${actionBlock}
            <tr>
              <td style="padding:0 32px 20px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:separate;border-spacing:0;background:#f8fbfd;border:1px solid #dbe5ef;border-radius:18px;">
                  <tr>
                    <td style="padding:16px 18px 8px 18px;font:800 12px 'Segoe UI',Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#0f766e;">
                      Como usar
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 18px 10px 18px;font:500 14px/1.65 'Segoe UI',Arial,sans-serif;color:#334155;">
                      ${safeActionHint}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 18px 16px 18px;font:700 13px/1.6 'Segoe UI',Arial,sans-serif;color:#b45309;">
                      ${safeExpiry}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px 32px;font:500 13px/1.65 'Segoe UI',Arial,sans-serif;color:#64748b;">
                ${safeFooter}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendMail(email: string, subject: string, html: string): Promise<boolean> {
  const { microsoftClientId, microsoftClientSecret, microsoftGraphMailbox, microsoftTenantId } = env;

  if (!microsoftClientId || !microsoftClientSecret || !microsoftGraphMailbox || !microsoftTenantId) {
    return false;
  }

  const tokenResponse = await fetch(`https://login.microsoftonline.com/${microsoftTenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: microsoftClientId,
      client_secret: microsoftClientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials'
    })
  });

  if (!tokenResponse.ok) {
    return false;
  }

  const tokenPayload = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenPayload.access_token) {
    return false;
  }

  const message = {
    message: {
      subject,
      body: {
        contentType: 'HTML',
        content: html
      },
      toRecipients: [{ emailAddress: { address: email } }]
    },
    saveToSentItems: false
  };

  const sendResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${microsoftGraphMailbox}/sendMail`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenPayload.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(message)
  });

  return sendResponse.ok;
}

export async function sendPasswordResetEmail(email: string, name: string, token: string): Promise<boolean> {
  const resetUrl = env.frontendUrl ? `${env.frontendUrl}/resetar-senha?token=${encodeURIComponent(token)}` : undefined;
  const safeName = escapeHtml(name);

  return sendMail(
    email,
    'PlayField: ALTERE SUA SENHA',
    renderActionEmail({
      preheader: 'Redefina sua senha no PlayField.',
      eyebrow: 'Recuperacao de acesso',
      title: `Ola, ${safeName}. Vamos trocar sua senha?`,
      intro: 'Recebemos um pedido para redefinir a senha da sua conta. Toque no botao abaixo para criar uma nova senha e voltar para o jogo sem perder tempo.',
      actionLabel: 'Redefinir senha',
      actionUrl: resetUrl,
      actionToken: token,
      actionHint: 'Abra este link no mesmo navegador em que voce costuma acessar o sistema e defina sua nova senha na sequencia.',
      expiry: 'Este acesso expira em 30 minutos.',
      footer: 'Se voce nao pediu essa alteracao, pode ignorar este email com seguranca. Nenhuma senha sera alterada sem a confirmacao final.',
      accent: '#38bdf8'
    })
  );
}

export async function sendAccountActivationEmail(email: string, name: string, token: string): Promise<boolean> {
  const activationUrl = env.frontendUrl ? `${env.frontendUrl}/ativar-conta?token=${encodeURIComponent(token)}` : undefined;
  const safeName = escapeHtml(name);

  return sendMail(
    email,
    'PlayField: ATIVE SEU CADASTRO',
    renderActionEmail({
      preheader: 'Ative sua conta e defina sua senha inicial.',
      eyebrow: 'Convite oficial',
      title: `Fala, ${safeName}. Seu cadastro esta pronto.`,
      intro: 'Voce foi incluido no sistema oficial do PlayField. Ative sua conta agora para definir sua senha inicial e entrar no fluxo de confirmacoes, jogos e temporada.',
      actionLabel: 'Ativar minha conta',
      actionUrl: activationUrl,
      actionToken: token,
      actionHint: 'Clique no botao, crie sua senha inicial e finalize o acesso. Se estiver no celular, o processo funciona melhor abrindo o link diretamente pelo email.',
      expiry: 'Este convite expira em 7 dias. Depois disso, use a recuperacao de senha para gerar um novo acesso.',
      footer: 'Se este cadastro nao fazia sentido para voce, ignore este email. O acesso so sera concluido apos a definicao da senha.',
      accent: '#fbbf24'
    })
  );
}
