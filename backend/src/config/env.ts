const requiredKeys = ['DATABASE_URL', 'JWT_SECRET', 'NODE_ENV', 'PORT', 'ALLOWED_ORIGINS', 'FRONTEND_URL'] as const;

for (const key of requiredKeys) {
  if (!process.env[key]) {
    throw new Error(`Variável obrigatória ausente no serviço Railway: ${key}`);
  }
}

const port = Number(process.env.PORT);

function parseProductionUrl(value: string, key: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${key} precisa ser uma URL absoluta válida.`);
  }

  if (url.protocol !== 'https:') {
    throw new Error(`${key} precisa usar HTTPS em produção.`);
  }

  if (url.username || url.password) {
    throw new Error(`${key} não pode conter usuário/senha na URL.`);
  }

  return url;
}

function parseAllowedOrigins(value: string): string[] {
  return value.split(',').map((origin) => origin.trim()).filter(Boolean).map((origin) => {
    if (origin === '*') throw new Error('ALLOWED_ORIGINS não pode usar wildcard em produção.');
    const url = parseProductionUrl(origin, 'ALLOWED_ORIGINS');
    return url.origin;
  });
}

if (process.env.NODE_ENV !== 'production') {
  throw new Error('NODE_ENV precisa ser production no serviço Railway do backend.');
}

if (port !== 8080) {
  throw new Error('PORT precisa ser exatamente 8080 no serviço Railway do backend.');
}

const frontendUrl = parseProductionUrl(process.env.FRONTEND_URL as string, 'FRONTEND_URL');
const allowedOrigins = Array.from(new Set(parseAllowedOrigins(process.env.ALLOWED_ORIGINS as string)));

if (!allowedOrigins.includes(frontendUrl.origin)) {
  throw new Error('ALLOWED_ORIGINS precisa incluir exatamente a origem configurada em FRONTEND_URL.');
}

export const env = {
  databaseUrl: process.env.DATABASE_URL as string,
  jwtSecret: process.env.JWT_SECRET as string,
  nodeEnv: process.env.NODE_ENV as 'production',
  port,
  allowedOrigins,
  microsoftClientId: process.env.MICROSOFT_CLIENT_ID,
  microsoftClientSecret: process.env.MICROSOFT_CLIENT_SECRET,
  microsoftGraphMailbox: process.env.MICROSOFT_GRAPH_MAILBOX,
  microsoftTenantId: process.env.MICROSOFT_TENANT_ID,
  frontendUrl: frontendUrl.origin
};
