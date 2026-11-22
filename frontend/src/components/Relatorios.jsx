import { useEffect, useState } from 'react'
import { api, extrairErro } from '../services/api.js'

const moeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})
const percentual = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 1,
})

function periodoDoMes() {
  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mes = String(hoje.getMonth() + 1).padStart(2, '0')
  const ultimoDia = new Date(ano, hoje.getMonth() + 1, 0).getDate()
  return { inicio: `${ano}-${mes}-01`, fim: `${ano}-${mes}-${ultimoDia}` }
}

async function carregarRelatorio(modo, periodo, signal) {
  const recurso = modo === 'categoria' ? 'categorias' : 'fontes-destinos'
  const { data } = await api.get('/relatorios/' + recurso, { params: periodo, signal })

  if (modo === 'fonte') {
    return { linhas: data.fontesDestinos, totais: data.totais }
  }

  return {
    linhas: data.saidas.categorias.map((categoria) => ({ ...categoria, tipo: 'Saída' }))
      .concat(data.entradas.categorias.map((categoria) => ({ ...categoria, tipo: 'Entrada' }))),
    anterior: data.periodoAnterior,
  }
}

function formatarVariacao(valor) {
  if (valor === undefined) return '—'
  if (valor === null) return 'Sem base anterior'
  if (valor === 0) return 'Sem variação'
  const direcao = valor > 0 ? 'Aumento' : 'Redução'
  return direcao + ' de ' + percentual.format(Math.abs(valor) / 100)
}

function TabelaFontes({ linhas, totais }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th scope="col">Fonte ou destino</th>
            <th scope="col">Entradas</th>
            <th scope="col">Saídas</th>
            <th scope="col">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(({ id, nome, entradas, saidas, saldo }) => (
            <tr key={id}>
              <th scope="row">{nome}</th>
              <td>{moeda.format(entradas)}</td>
              <td>{moeda.format(saidas)}</td>
              <td>{saldo === null ? '—' : moeda.format(saldo)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total do período</th>
            <td>{moeda.format(totais.entradas)}</td>
            <td>{moeda.format(totais.saidas)}</td>
            <td>{moeda.format(totais.saldo)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function RelatorioCategorias({ linhas, anterior }) {
  const categoriasComMovimento = linhas.filter(({ total }) => total > 0)
  const maiorTotal = Math.max(1, ...categoriasComMovimento.map(({ total }) => total))

  return (
    <>
      <p>
        Período anterior: <time dateTime={anterior.inicio}>{anterior.inicio.split('-').reverse().join('/')}</time>
        {' a '}
        <time dateTime={anterior.fim}>{anterior.fim.split('-').reverse().join('/')}</time>.
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th scope="col">Categoria</th>
              <th scope="col">Tipo</th>
              <th scope="col">Total atual</th>
              <th scope="col">Participação</th>
              <th scope="col">Total anterior</th>
              <th scope="col">Variação</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ id, nome, total, percentual: participacao, anterior: totalAnterior, variacao, tipo }) => (
              <tr key={id}>
                <th scope="row">{nome}</th>
                <td>{tipo}</td>
                <td>{moeda.format(total)}</td>
                <td>{percentual.format(participacao / 100)}</td>
                <td>{totalAnterior === undefined ? '—' : moeda.format(totalAnterior)}</td>
                <td>{formatarVariacao(variacao)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section>
        <h2>Movimentação por categoria</h2>
        {categoriasComMovimento.length === 0 ? (
          <p>Nenhuma movimentação no período atual.</p>
        ) : (
          <ul>
            {categoriasComMovimento.map(({ id, nome, total }) => (
              <li key={id}>
                <div>{nome} · {moeda.format(total)}</div>
                <meter
                  aria-label={`Total de ${nome}`}
                  value={total}
                  max={maiorTotal}
                  style={{ width: '100%', maxWidth: 360 }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

export default function Relatorios() {
  const [filtro, setFiltro] = useState(periodoDoMes)
  const [consulta, setConsulta] = useState({ modo: 'fonte', periodo: filtro })
  const [relatorio, setRelatorio] = useState(null)
  const [erro, setErro] = useState('')
  const { modo, periodo } = consulta

  useEffect(() => {
    const controle = new AbortController()
    const { signal } = controle

    carregarRelatorio(modo, periodo, signal)
      .then((dados) => {
        if (!signal.aborted) setRelatorio(dados)
      })
      .catch((falha) => {
        if (!signal.aborted) setErro(extrairErro(falha).mensagem)
      })

    return () => controle.abort()
  }, [modo, periodo])

  function consultar(novoModo, novoPeriodo) {
    setErro('')
    setRelatorio(null)
    setConsulta({ modo: novoModo, periodo: { ...novoPeriodo } })
  }

  return (
    <section>
      <h1>Relatórios</h1>

      <label>
        Agrupar por{' '}
        <select value={modo} onChange={(evento) => consultar(evento.target.value, periodo)}>
          <option value="fonte">Fonte/destino</option>
          <option value="categoria">Categoria</option>
        </select>
      </label>

      <form onSubmit={(evento) => {
        evento.preventDefault()
        consultar(modo, filtro)
      }}>
        <label>
          Data inicial{' '}
          <input
            type="date"
            value={filtro.inicio}
            min="1900-01-01"
            max={filtro.fim || undefined}
            required
            onChange={(evento) => setFiltro({ ...filtro, inicio: evento.target.value })}
          />
        </label>{' '}
        <label>
          Data final{' '}
          <input
            type="date"
            value={filtro.fim}
            min={filtro.inicio || '1900-01-01'}
            required
            onChange={(evento) => setFiltro({ ...filtro, fim: evento.target.value })}
          />
        </label>{' '}
        <button type="submit">Aplicar filtro</button>
      </form>

      {erro && <p role="alert">{erro}</p>}
      {!relatorio && !erro && <p role="status">Carregando relatório…</p>}
      {relatorio?.linhas.length === 0 && <p>Nenhum lançamento encontrado.</p>}

      {relatorio?.linhas.length > 0 && (
        modo === 'categoria'
          ? <RelatorioCategorias linhas={relatorio.linhas} anterior={relatorio.anterior} />
          : <TabelaFontes linhas={relatorio.linhas} totais={relatorio.totais} />
      )}
    </section>
  )
}
