import { useEffect, useState } from 'react'
import { api, extrairErro } from '../services/api.js'

const moeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function periodoDoMes() {
  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mes = String(hoje.getMonth() + 1).padStart(2, '0')
  const ultimoDia = new Date(ano, hoje.getMonth() + 1, 0).getDate()

  return {
    inicio: `${ano}-${mes}-01`,
    fim: `${ano}-${mes}-${ultimoDia}`,
  }
}

async function carregarRelatorio(periodo, signal) {
  const [fontes, primeira] = await Promise.all([
    api.get('/fontes-destinos', { signal }),
    api.get('/lancamentos', { params: periodo, signal }),
  ])

  const nomes = new Map(fontes.data.map(({ id, nome }) => [id, nome]))
  const grupos = new Map()

  function somar(lancamentos) {
    for (const { fonteDestinoId, tipo, valor } of lancamentos) {
      const grupo = grupos.get(fonteDestinoId) ?? {
        id: fonteDestinoId,
        nome: nomes.get(fonteDestinoId) ?? 'Fonte ou destino indisponível',
        entradas: 0,
        saidas: 0,
      }
      const campo = tipo === 'entrada' ? 'entradas' : 'saidas'
      grupo[campo] += Math.round(Number(valor) * 100)
      grupos.set(fonteDestinoId, grupo)
    }
  }

  somar(primeira.data.lancamentos)

  for (let pagina = 2; pagina <= primeira.data.totalPaginas; pagina += 1) {
    const { data } = await api.get('/lancamentos', {
      params: { ...periodo, pagina },
      signal,
    })
    somar(data.lancamentos)
  }

  return {
    linhas: Array.from(grupos.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR'),
    ),
    totais: primeira.data.totais,
  }
}

export default function Relatorios() {
  const [filtro, setFiltro] = useState(periodoDoMes)
  const [periodo, setPeriodo] = useState(filtro)
  const [relatorio, setRelatorio] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    const controle = new AbortController()
    const { signal } = controle

    carregarRelatorio(periodo, signal)
      .then((dados) => {
        if (!signal.aborted) setRelatorio(dados)
      })
      .catch((falha) => {
        if (!signal.aborted) setErro(extrairErro(falha).mensagem)
      })

    return () => controle.abort()
  }, [periodo])

  function aplicarFiltro(evento) {
    evento.preventDefault()
    setErro('')
    setRelatorio(null)
    setPeriodo({ ...filtro })
  }

  return (
    <section>
      <h1>Relatório por fonte/destino</h1>

      <form onSubmit={aplicarFiltro}>
        <label>
          Data inicial{' '}
          <input
            type="date"
            value={filtro.inicio}
            max={filtro.fim || undefined}
            required
            onChange={(evento) =>
              setFiltro({ ...filtro, inicio: evento.target.value })
            }
          />
        </label>{' '}
        <label>
          Data final{' '}
          <input
            type="date"
            value={filtro.fim}
            min={filtro.inicio || undefined}
            required
            onChange={(evento) =>
              setFiltro({ ...filtro, fim: evento.target.value })
            }
          />
        </label>{' '}
        <button type="submit">Aplicar filtro</button>
      </form>

      {erro && <p role="alert">{erro}</p>}
      {!relatorio && !erro && <p role="status">Carregando relatório…</p>}

      {relatorio?.linhas.length === 0 && (
        <p>Nenhum lançamento encontrado no período.</p>
      )}

      {relatorio?.linhas.length > 0 && (
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
              {relatorio.linhas.map(({ id, nome, entradas, saidas }) => (
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
                <td>{moeda.format(relatorio.totais.entradas)}</td>
                <td>{moeda.format(relatorio.totais.saidas)}</td>
                <td>{moeda.format(relatorio.totais.saldo)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  )
}
