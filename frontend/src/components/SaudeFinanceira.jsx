import { useEffect, useState } from 'react'
import { api, extrairErro } from '../services/api.js'

const moeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const percentual = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 2,
})

const formatoMes = new Intl.DateTimeFormat('pt-BR', {
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
})

function formatarPercentual(valor) {
  return valor === null ? 'Sem receitas no mês' : percentual.format(valor / 100)
}

function GraficoProjecao({ projecao }) {
  const escala = Math.max(1, ...projecao.map(({ saldo }) => Math.abs(saldo)))
  const pontos = projecao.map(({ mes, saldo }, indice) => ({
    mes,
    rotulo: formatoMes.format(new Date(`${mes}-01T00:00:00Z`)),
    saldo,
    x: 50 + indice * (260 / Math.max(1, projecao.length - 1)),
    y: 75 - (saldo / escala) * 45,
  }))
  const linha = pontos.map(({ x, y }) => `${x},${y}`).join(' ')

  return (
    <svg
      viewBox="0 0 360 155"
      width="100%"
      style={{ maxWidth: 560 }}
      role="img"
      aria-label={pontos
        .map(({ rotulo, saldo }) => `${rotulo}: ${moeda.format(saldo)}`)
        .join(', ')}
    >
      <line
        x1="50"
        y1="75"
        x2="310"
        y2="75"
        stroke="currentColor"
        strokeDasharray="4 4"
      />
      <text x="28" y="79" fontSize="12" fill="currentColor">0</text>
      <polyline points={linha} fill="none" stroke="#2563eb" strokeWidth="3" />

      {pontos.map(({ mes, rotulo, saldo, x, y }) => (
        <g key={mes}>
          <circle cx={x} cy={y} r="4" fill={saldo < 0 ? '#b91c1c' : '#2563eb'} />
          <text x={x} y={y - 9} textAnchor="middle" fontSize="11" fill="currentColor">
            {moeda.format(saldo)}
          </text>
          <text x={x} y="145" textAnchor="middle" fontSize="12" fill="currentColor">
            {rotulo}
          </text>
        </g>
      ))}
    </svg>
  )
}

export default function SaudeFinanceira() {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    const controle = new AbortController()

    async function carregar() {
      try {
        const { data } = await api.get('/saude-financeira', {
          signal: controle.signal,
        })
        if (!controle.signal.aborted) setDados(data)
      } catch (falha) {
        if (!controle.signal.aborted) {
          setErro(extrairErro(falha).mensagem)
        }
      }
    }

    carregar()
    return () => controle.abort()
  }, [tentativa])

  function tentarNovamente() {
    setErro('')
    setTentativa((anterior) => anterior + 1)
  }

  return (
    <section>
      <h1>Saúde financeira</h1>

      {!dados && !erro && <p role="status">Carregando indicadores…</p>}

      {erro && (
        <div>
          <p className="ui-erro" role="alert">{erro}</p>
          <button type="button" onClick={tentarNovamente}>Tentar novamente</button>
        </div>
      )}

      {dados && !dados.temLancamentos && (
        <p className="ui-vazio">Sem lançamentos suficientes para analisar este período.</p>
      )}

      {dados?.temLancamentos && (
        <>
          <section>
            <h2>Indicadores</h2>
            <div className="ui-cards">
              <div className="ui-card">
                <span>Taxa de poupança do mês</span>
                <strong>{formatarPercentual(dados.indicadores.taxaPoupanca)}</strong>
                {dados.dicasIndicadores.taxaPoupanca && <p>{dados.dicasIndicadores.taxaPoupanca}</p>}
              </div>
              <div className="ui-card">
                <span>Comprometimento com cartões no mês</span>
                <strong>
                  {formatarPercentual(dados.indicadores.comprometimentoCartoes)}
                </strong>
                {dados.dicasIndicadores.comprometimentoCartoes && <p>{dados.dicasIndicadores.comprometimentoCartoes}</p>}
              </div>
              <div className="ui-card">
                <span>Parcelas dos próximos três meses</span>
                <strong>{moeda.format(dados.indicadores.parcelasFuturas)}</strong>
                {dados.dicasIndicadores.parcelasFuturas && <p>{dados.dicasIndicadores.parcelasFuturas}</p>}
              </div>
            </div>
          </section>

          <section className="ui-painel ui-secao">
            <h2>Projeção de saldo</h2>
            {dados.projecao.length > 0 ? (
              <GraficoProjecao projecao={dados.projecao} />
            ) : (
              <p>Nenhum mês disponível para projeção.</p>
            )}
            {dados.temSaldoNegativo && (
              <p className="ui-erro" role="alert">A projeção indica saldo negativo.</p>
            )}
          </section>

          <section className="ui-painel ui-secao">
            <h2>Dicas</h2>
            {dados.dicas.length > 0 ? (
              <ul>
                {dados.dicas.map((dica) => <li key={dica}>{dica}</li>)}
              </ul>
            ) : (
              <p>Nenhuma dica gerada para este período.</p>
            )}
          </section>
        </>
      )}

      <p className="ui-dica ui-secao">
        As informações desta página são educativas e não constituem
        recomendação financeira profissional.
      </p>
    </section>
  )
}
