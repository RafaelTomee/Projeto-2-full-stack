import { useEffect, useState } from 'react'
import { api, extrairErro } from '../services/api.js'

const DIA = 86_400_000
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

function periodoAnterior({ inicio, fim }) {
  const primeiroDia = Date.parse(inicio)
  const duracao = Date.parse(fim) - primeiroDia + DIA
  return {
    inicio: new Date(primeiroDia - duracao).toISOString().slice(0, 10),
    fim: new Date(primeiroDia - DIA).toISOString().slice(0, 10),
  }
}

async function agrupar(periodo, campoId, signal) {
  const grupos = new Map()
  let totais
  let totalPaginas = 1

  for (let pagina = 1; pagina <= totalPaginas; pagina += 1) {
    const { data } = await api.get('/lancamentos', {
      params: { ...periodo, pagina },
      signal,
    })

    if (pagina === 1) {
      totais = data.totais
      totalPaginas = data.totalPaginas
    }

    for (const lancamento of data.lancamentos) {
      const id = lancamento[campoId]
      const grupo = grupos.get(id) ?? { entradas: 0, saidas: 0 }
      const campo = lancamento.tipo === 'entrada' ? 'entradas' : 'saidas'
      grupo[campo] += Math.round(Number(lancamento.valor) * 100)
      grupos.set(id, grupo)
    }
  }

  return { grupos, totais }
}

async function carregarRelatorio(modo, periodo, signal) {
  const porCategoria = modo === 'categoria'
  const campoId = porCategoria ? 'categoriaId' : 'fonteDestinoId'
  const rota = porCategoria ? '/categorias' : '/fontes-destinos'
  const anterior = porCategoria ? periodoAnterior(periodo) : null

  const [cadastros, atual, comparacao] = await Promise.all([
    api.get(rota, { signal }),
    agrupar(periodo, campoId, signal),
    anterior ? agrupar(anterior, campoId, signal) : null,
  ])

  const nomes = new Map(cadastros.data.map(({ id, nome }) => [id, nome]))
  const ids = new Set(atual.grupos.keys())
  for (const id of comparacao?.grupos.keys() ?? []) ids.add(id)

  const linhas = Array.from(ids, (id) => {
    const { entradas, saidas } = atual.grupos.get(id) ?? { entradas: 0, saidas: 0 }
    const previo = comparacao?.grupos.get(id)
    return {
      id,
      nome: nomes.get(id) ?? (porCategoria ? 'Categoria indisponível' : 'Fonte ou destino indisponível'),
      entradas,
      saidas,
      total: entradas + saidas,
      anterior: previo ? previo.entradas + previo.saidas : 0,
    }
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  return { linhas, totais: atual.totais, anterior }
}

function variacao(total, anterior) {
  if (total === anterior) return 'Sem variação'
  if (anterior === 0) return 'Sem base anterior'
  const diferenca = (total - anterior) / anterior
  const direcao = diferenca > 0 ? 'Aumento' : 'Redução'
  return `${direcao} de ${percentual.format(Math.abs(diferenca))}`
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
          {linhas.map(({ id, nome, entradas, saidas }) => (
            <tr key={id}>
              <th scope="row">{nome}</th>
              <td>{moeda.format(entradas / 100)}</td>
              <td>{moeda.format(saidas / 100)}</td>
              <td>{moeda.format((entradas - saidas) / 100)}</td>
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
  const totalPeriodo = linhas.reduce((soma, linha) => soma + linha.total, 0)
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
              <th scope="col">Total atual</th>
              <th scope="col">Participação</th>
              <th scope="col">Total anterior</th>
              <th scope="col">Variação</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ id, nome, total, anterior: totalAnterior }) => (
              <tr key={id}>
                <th scope="row">{nome}</th>
                <td>{moeda.format(total / 100)}</td>
                <td>{percentual.format(totalPeriodo ? total / totalPeriodo : 0)}</td>
                <td>{moeda.format(totalAnterior / 100)}</td>
                <td>{variacao(total, totalAnterior)}</td>
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
                <div>{nome} · {moeda.format(total / 100)}</div>
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
