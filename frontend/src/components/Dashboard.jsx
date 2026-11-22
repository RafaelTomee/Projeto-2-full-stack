import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, extrairErro } from '../services/api.js'

const moeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const formatoData = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
})

function periodoAtual() {
  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mes = String(hoje.getMonth() + 1).padStart(2, '0')
  const ultimoDia = new Date(ano, hoje.getMonth() + 1, 0).getDate()

  return {
    inicio: `${ano}-${mes}-01`,
    fim: `${ano}-${mes}-${ultimoDia}`,
  }
}

export default function Dashboard() {
  const [resumo, setResumo] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    const controle = new AbortController()
    const { signal } = controle
    const periodo = periodoAtual()

    async function carregar() {
      try {
        const [mes, categorias, recentes, primeiraPagina] = await Promise.all([
          api.get('/lancamentos', { params: periodo, signal }),
          api.get('/categorias', { signal }),
          api.get('/lancamentos', { signal }),
          api.get('/lancamentos', {
            params: { ...periodo, tipo: 'saida' },
            signal,
          }),
        ])

        const despesasPorCategoria = new Map()
        const nomes = new Map(categorias.data.map(({ id, nome }) => [id, nome]))

        function somarDespesas(lancamentos) {
          for (const { categoriaId, valor } of lancamentos) {
            const acumulado = despesasPorCategoria.get(categoriaId) ?? 0
            despesasPorCategoria.set(categoriaId, acumulado + Math.round(valor * 100))
          }
        }

        somarDespesas(primeiraPagina.data.lancamentos)

        for (let pagina = 2; pagina <= primeiraPagina.data.totalPaginas; pagina += 1) {
          const { data } = await api.get('/lancamentos', {
            params: { ...periodo, tipo: 'saida', pagina },
            signal,
          })
          somarDespesas(data.lancamentos)
        }

        if (signal.aborted) return

        setResumo({
          totais: mes.data.totais,
          recentes: recentes.data.lancamentos.slice(0, 5),
          gastos: Array.from(despesasPorCategoria, ([id, centavos]) => ({
            id,
            nome: nomes.get(id) ?? 'Categoria indisponível',
            valor: centavos / 100,
          })).sort((a, b) => b.valor - a.valor),
        })
      } catch (falha) {
        if (!signal.aborted) setErro(extrairErro(falha).mensagem)
      }
    }

    carregar()
    return () => controle.abort()
  }, [])

  return (
    <section>
      <h1>Resumo do mês</h1>

      {erro && <p role="alert">{erro}</p>}
      {!resumo && !erro && <p role="status">Carregando resumo…</p>}

      {resumo && (
        <>
          <div className="ui-cards">
            <div className="ui-card ui-card-entradas">
              <span>Entradas do mês</span>
              <strong>{moeda.format(resumo.totais.entradas)}</strong>
            </div>
            <div className="ui-card ui-card-saidas">
              <span>Saídas do mês</span>
              <strong>{moeda.format(resumo.totais.saidas)}</strong>
            </div>
            <div className="ui-card ui-card-saldo">
              <span>Saldo do mês</span>
              <strong>{moeda.format(resumo.totais.entradas - resumo.totais.saidas)}</strong>
            </div>
          </div>

          <section>
            <h2>Saídas por categoria</h2>
            {resumo.gastos.length === 0 ? (
              <p>Nenhuma saída registrada neste mês.</p>
            ) : (
              <ul>
                {resumo.gastos.map(({ id, nome, valor }) => (
                  <li key={id}>
                    <div>{nome} · {moeda.format(valor)}</div>
                    <meter
                      aria-label={nome}
                      min={0}
                      max={resumo.gastos[0].valor}
                      value={valor}
                      style={{ width: '100%', maxWidth: 360 }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2>Últimos lançamentos</h2>
            {resumo.recentes.length === 0 ? (
              <p>Nenhum lançamento registrado.</p>
            ) : (
              <ul>
                {resumo.recentes.map(({ id, descricao, data, tipo, valor }) => (
                  <li key={id}>
                    <time dateTime={data}>{formatoData.format(new Date(data))}</time>
                    {' · '}{descricao}
                    {' · '}{tipo === 'saida' ? '−' : '+'}{moeda.format(valor)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <section>
        <h2>Faturas dos cartões</h2>
        <Link to="/faturas">Ver faturas</Link>
      </section>
    </section>
  )
}
