// Utilitários para ler o JWT no navegador. NÃO valida a assinatura (isso é papel do
// servidor): serve só para saber quando o token expira e evitar requisições inúteis.

export function lerPayload(token) {
  try {
    const parte = String(token).split('.')[1];
    const base64 = parte.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

// Em milissegundos, quanto falta para o token expirar (0 se já expirou ou for ilegível).
export function msParaExpirar(token, agora = Date.now()) {
  const exp = lerPayload(token)?.exp;
  if (typeof exp !== 'number') return 0;
  return Math.max(0, exp * 1000 - agora);
}

export function tokenExpirado(token, agora = Date.now()) {
  return msParaExpirar(token, agora) === 0;
}
