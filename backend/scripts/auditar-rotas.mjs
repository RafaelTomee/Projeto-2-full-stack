#!/usr/bin/env node
// Auditoria estática do isolamento por usuário (RF3).
//
// Complementa o teste de caixa-preta (test/isolamento.test.js): o teste prova
// que a API não vaza dados; esta auditoria prova que CADA consulta SQL e CADA
// rota carrega a proteção, mesmo quando outra camada (ex.: a rota que chama
// buscarPorId antes de atualizar) esconderia a falha.
//
// Regras:
//   R1  toda rota (exceto /auth/cadastro e /auth/login) usa o middleware autenticar;
//   R2  toda consulta SQL que toca tabela de dono (categorias, fontes_destinos,
//       lancamentos) filtra/insere por usuario_id;
//   R3  nenhum valor entra no SQL por interpolação: só constantes em MAIÚSCULAS
//       (lista de colunas), os fragmentos internos `condicao`/`where` e
//       placeholders `$${n}`;
//   R4  senha_hash só aparece em models/Usuario.js e routes/auth.routes.js, e
//       nunca em res.json/res.send;
//   R5  o dono vem do token (req.usuarioId): proibido ler usuarioId/usuario_id
//       de req.body, req.query ou req.params.
//
// Exceção justificada: comentário `// rf3-ok: motivo` na linha anterior à consulta.
//
// Uso: npm run audit:rotas   (sai com código 1 se houver violação)
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = process.env.AUDITAR_RAIZ ?? join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(RAIZ, 'src');
const TABELAS_DE_DONO = ['categorias', 'fontes_destinos', 'lancamentos'];
const ROTAS_PUBLICAS = new Set(['auth.routes.js:post /cadastro', 'auth.routes.js:post /login']);
const ARQUIVOS_SENHA_HASH = new Set(['models/Usuario.js', 'routes/auth.routes.js']);

const violacoes = [];
let consultas = 0;
let rotas = 0;
const falha = (arq, linha, regra, msg) => violacoes.push({ arq, linha, regra, msg });

function listar(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listar(join(dir, e.name)) : e.name.endsWith('.js') ? [join(dir, e.name)] : [],
  );
}
const linhaDe = (txt, i) => txt.slice(0, i).split('\n').length;

// Lê o literal (' " ou `) que começa em i; devolve { texto, fim } ou null.
function lerLiteral(txt, i) {
  const aspas = txt[i];
  if (!['`', "'", '"'].includes(aspas)) return null;
  let j = i + 1;
  let prof = 0;
  while (j < txt.length) {
    const c = txt[j];
    if (c === '\\') { j += 2; continue; }
    if (aspas === '`' && c === '$' && txt[j + 1] === '{') { prof++; j += 2; continue; }
    if (aspas === '`' && prof > 0 && c === '}') { prof--; j++; continue; }
    if (c === aspas && prof === 0) return { texto: txt.slice(i + 1, j), fim: j + 1 };
    j++;
  }
  return null;
}

function expressoesInterpoladas(sql) {
  const out = [];
  for (let i = 0; i < sql.length; i++) {
    if (sql[i] === '$' && sql[i + 1] === '{') {
      let prof = 1, j = i + 2;
      while (j < sql.length && prof > 0) { if (sql[j] === '{') prof++; if (sql[j] === '}') prof--; j++; }
      out.push({ expr: sql.slice(i + 2, j - 1).trim(), pos: i, antesDolar: sql[i - 1] === '$' });
      i = j;
    }
  }
  return out;
}
const INTERPOLACAO_OK = (e) =>
  /^[A-Z][A-Z0-9_]*$/.test(e.expr) || ['condicao', 'where'].includes(e.expr) ||
  (e.antesDolar && /^parametros\.length( \+ \d+)?$/.test(e.expr));

function auditarConsultas(arq, txt) {
  const re = /\b(?:query|client\.query|pool\.query)\s*\(\s*/g;
  let m;
  while ((m = re.exec(txt))) {
    const lit = lerLiteral(txt, re.lastIndex);
    if (!lit) continue; // argumento não literal (ex.: variável): coberto pelo teste
    consultas++;
    const linha = linhaDe(txt, m.index);
    const anterior = txt.slice(0, m.index).split('\n').slice(-2).join('\n');
    if (/rf3-ok:/.test(anterior)) continue;
    const sql = lit.texto;
    for (const e of expressoesInterpoladas(sql)) {
      if (!INTERPOLACAO_OK(e)) falha(arq, linha, 'R3', `interpolação insegura no SQL: \${${e.expr}}`);
    }
    const semInterp = sql.replace(/\$\{[^}]*\}/g, ' ');
    const toca = TABELAS_DE_DONO.some((t) => new RegExp(`\\b(from|join|update|into)\\s+${t}\\b`, 'i').test(semInterp));
    // `WHERE ${where}`: o fragmento é montado a partir de `condicoes`, que deve começar por usuario_id.
    const viaWhere = /\$\{where\}/.test(sql) && /const condicoes = \[\s*'usuario_id = \$1'/.test(txt);
    if (toca && !/\busuario_id\b/i.test(sql) && !viaWhere) {
      falha(arq, linha, 'R2', 'consulta em tabela de dono sem filtro/coluna usuario_id');
    }
  }
}

function auditarRotas(arq, txt) {
  const base = arq.split('/').pop();
  const usaGlobal = /router\.use\(\s*autenticar\s*[,)]/.test(txt);
  const re = /router\.(get|post|put|patch|delete)\(\s*(['"`])([^'"`]*)\2\s*,([^\n]*)/g;
  let m;
  while ((m = re.exec(txt))) {
    rotas++;
    const id = `${base}:${m[1]} ${m[3]}`;
    if (ROTAS_PUBLICAS.has(id)) continue;
    if (!usaGlobal && !/\bautenticar\b/.test(m[4])) {
      falha(arq, linhaDe(txt, m.index), 'R1', `rota ${m[1].toUpperCase()} ${m[3]} sem middleware autenticar`);
    }
  }
}

function auditarGerais(arq, txt) {
  txt.split('\n').forEach((l, i) => {
    if (/senha_hash|senhaHash/.test(l) && !ARQUIVOS_SENHA_HASH.has(arq) && !/^\s*(\/\/|\*)/.test(l)) {
      falha(arq, i + 1, 'R4', 'senha_hash fora de models/Usuario.js e routes/auth.routes.js');
    }
    if (/res\.(json|send)\([^)]*(senha_hash|senhaHash)/.test(l)) falha(arq, i + 1, 'R4', 'senha_hash enviado na resposta');
    if (/req\.(body|query|params)\.(usuarioId|usuario_id)\b/.test(l) || /\{[^}]*\b(usuarioId|usuario_id)\b[^}]*\}\s*=\s*req\.(body|query|params)/.test(l)) {
      falha(arq, i + 1, 'R5', 'dono lido da requisição em vez de req.usuarioId');
    }
  });
  if (arq === 'models/Usuario.js') {
    // buscarPorId (usado por /me) não pode selecionar senha_hash
    const bloco = txt.match(/buscarPorId[\s\S]*?\n  \},?/);
    if (bloco && /senha_hash/.test(bloco[0].replace(/\/\/.*$/gm, ''))) falha(arq, linhaDe(txt, bloco.index), 'R4', 'buscarPorId seleciona senha_hash');
  }
}

for (const caminho of listar(SRC)) {
  const arq = relative(SRC, caminho).split('\\').join('/');
  const txt = readFileSync(caminho, 'utf8');
  if (arq.startsWith('models/')) auditarConsultas(arq, txt);
  if (arq.startsWith('routes/')) auditarRotas(arq, txt);
  auditarGerais(arq, txt);
}

console.log(`Auditoria RF3: ${rotas} rotas, ${consultas} consultas SQL verificadas.`);
if (violacoes.length) {
  for (const v of violacoes) console.log(`  ✗ [${v.regra}] src/${v.arq}:${v.linha} — ${v.msg}`);
  console.log(`\n${violacoes.length} violação(ões).`);
  process.exit(1);
}
console.log('  ✓ nenhuma violação.');
