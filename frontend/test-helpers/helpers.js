// Utilitários só dos testes (o Node não tem localStorage).
export function instalarLocalStorageFalso() {
  const dados = new Map();
  globalThis.localStorage = {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: (k) => dados.delete(k),
    clear: () => dados.clear(),
  };
}

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

// Gera um JWT de mentira (sem assinatura válida) que expira daqui a "segundos".
export function fazerToken(segundos, sub = '1') {
  const exp = Math.floor(Date.now() / 1000) + segundos;
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub, exp })}.assinatura`;
}
