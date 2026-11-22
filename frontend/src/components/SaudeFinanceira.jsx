const indicadores = [
  { nome: 'Receitas do mês', valor: 2000 },
  { nome: 'Despesas do mês', valor: 1800 },
  { nome: 'Saldo do mês', valor: 200 },
]

const dicas = [
  'Revise as despesas recorrentes do mês.',
  'Confira os vencimentos das próximas contas.',
]

const projecao = [
  { mes: 'Mês 1', saldo: 200 },
  { mes: 'Mês 2', saldo: 50 },
  { mes: 'Mês 3', saldo: -100 },
]

const moeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const escala = Math.max(1, ...projecao.map(({ saldo }) => Math.abs(saldo)))
const pontos = projecao.map(({ mes, saldo }, indice) => ({
  mes,
  saldo,
  x: 40 + indice * (280 / Math.max(1, projecao.length - 1)),
  y: 75 - (saldo / escala) * 50,
}))

const linha = pontos.map(({ x, y }) => `${x},${y}`).join(' ')
const temSaldoNegativo = projecao.some(({ saldo }) => saldo < 0)

export default function SaudeFinanceira() {
  return (
    <section>
      <h1>Saúde financeira</h1>
      <p>Dados de exemplo</p>

      <section>
        <h2>Indicadores do mês</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
            gap: '1rem',
          }}
        >
          {indicadores.map(({ nome, valor }) => (
            <article
              key={nome}
              style={{
                border: '1px solid currentColor',
                borderRadius: '8px',
                padding: '1rem',
              }}
            >
              <h3>{nome}</h3>
              <p>{moeda.format(valor)}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2>Projeção de saldo</h2>
        <svg
          viewBox="0 0 360 155"
          width="100%"
          style={{ maxWidth: 560 }}
          role="img"
          aria-label={projecao
            .map(({ mes, saldo }) => `${mes}: ${moeda.format(saldo)}`)
            .join(', ')}
        >
          <line
            x1="40"
            y1="75"
            x2="320"
            y2="75"
            stroke="currentColor"
            strokeDasharray="4 4"
          />
          <text x="20" y="79" fontSize="12" fill="currentColor">0</text>
          <polyline points={linha} fill="none" stroke="#2563eb" strokeWidth="3" />

          {pontos.map(({ mes, saldo, x, y }) => (
            <g key={mes}>
              <circle cx={x} cy={y} r="4" fill={saldo < 0 ? '#b91c1c' : '#2563eb'} />
              <text
                x={x}
                y={y - 9}
                textAnchor="middle"
                fontSize="11"
                fill="currentColor"
              >
                {moeda.format(saldo)}
              </text>
              <text
                x={x}
                y="149"
                textAnchor="middle"
                fontSize="12"
                fill="currentColor"
              >
                {mes}
              </text>
            </g>
          ))}
        </svg>

        {temSaldoNegativo && (
          <p role="alert">A projeção indica saldo negativo.</p>
        )}
      </section>

      <section>
        <h2>Dicas</h2>
        <ul>
          {dicas.map((dica) => (
            <li key={dica}>{dica}</li>
          ))}
        </ul>
      </section>

      <p>
        As informações desta página são educativas e não são recomendação
        financeira profissional.
      </p>
    </section>
  )
}
