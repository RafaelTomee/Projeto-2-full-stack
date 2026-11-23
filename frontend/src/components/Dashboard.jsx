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
        const [mes, recentes, previsao] = await Promise.all([
          api.get('/relatorios/categorias', { params: periodo, signal }),
          api.get('/lancamentos', { signal }),
          api.get('/relatorios/faturas', { signal }),
        ])

        const proximaFatura = previsao.data.cartoes
          .flatMap(({ nome, faturas }) => faturas.map((fatura) => ({ ...fatura, nome })))
          .filter(({ total }) => total > 0)
          .sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0]

        if (signal.aborted) return

        setResumo({
          totais: { entradas: mes.data.entradas.total, saidas: mes.data.saidas.total },
          recentes: recentes.data.lancamentos.slice(0, 5),
          gastos: mes.data.saidas.categorias
            .filter(({ total }) => total > 0)
            .map(({ id, nome, total }) => ({ id, nome, valor: total })),
          proximaFatura,
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

      {erro && <p className="ui-erro" role="alert">{erro}</p>}
      {!resumo && !erro && <p role="status">Carregando resumo…</p>}

      {resumo && (
        <div>
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

          <div className="dashboard-paineis">
            <section className="ui-painel">
              <h2>Saídas por categoria</h2>
              {resumo.gastos.length === 0 ? (
                <p>Nenhuma saída registrada neste mês.</p>
              ) : (
                <ul className="dashboard-lista">
                  {resumo.gastos.map(({ id, nome, valor }) => (
                    <li key={id}>
                      <div className="dashboard-linha"><span>{nome}</span><b>{moeda.format(valor)}</b></div>
                      <meter
                        aria-label={nome}
                        min={0}
                        max={resumo.gastos[0].valor}
                        value={valor}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="ui-painel">
              <h2>Últimos lançamentos</h2>
              {resumo.recentes.length === 0 ? (
                <p>Nenhum lançamento registrado.</p>
              ) : (
                <ul className="dashboard-lista">
                  {resumo.recentes.map(({ id, descricao, data, tipo, valor }) => (
                    <li key={id}>
                      <div className="dashboard-linha">
                        <span>{descricao}</span>
                        <b className={tipo === 'saida' ? 'dashboard-saida' : 'dashboard-entrada'}>
                          {tipo === 'saida' ? '−' : '+'}{moeda.format(valor)}
                        </b>
                      </div>
                      <time dateTime={data}>{formatoData.format(new Date(data))}</time>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}

      <section className="ui-painel">
        <h2>Faturas dos cartões</h2>
        {resumo?.proximaFatura && (
          <p>
            {resumo.proximaFatura.nome} · {formatoData.format(new Date(resumo.proximaFatura.vencimento))}
            {' · '}{moeda.format(resumo.proximaFatura.total)}
          </p>
        )}
        <Link className="ui-link-botao" to="/faturas">Ver faturas</Link>
      </section>
    </section>
  )
}
