import { useEffect, useState } from 'react'
import { api, extrairErro } from '../services/api.js'

const moeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const formatoData = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' })
const formatoMes = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

function dataUtc(valor) {
  return new Date(valor + 'T00:00:00Z')
}

export default function Faturas() {
  const [cartoes, setCartoes] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    const controle = new AbortController()
    const { signal } = controle

    async function carregar() {
      try {
        const { data } = await api.get('/relatorios/faturas', { signal })
        if (!signal.aborted) setCartoes(data.cartoes)
      } catch (falha) {
        if (!signal.aborted) setErro(extrairErro(falha).mensagem)
      }
    }

    carregar()
    return () => controle.abort()
  }, [])

  return (
    <section>
      <h1>Faturas dos cartões</h1>

      {erro && <p className="ui-erro" role="alert">{erro}</p>}
      {!erro && cartoes === null && <p role="status">Carregando faturas…</p>}
      {cartoes?.length === 0 && <p className="ui-vazio">Nenhum cartão de crédito cadastrado.</p>}

      {cartoes?.map((cartao) => {
        const limite = cartao.limite
        const usado = cartao.limiteUtilizado
        const disponivel = cartao.limiteDisponivel

        return (
          <section key={cartao.id} className="ui-painel ui-secao">
            <h2>{cartao.nome}</h2>

            <p>
              Limite usado estimado: <strong>{moeda.format(usado)}</strong>
              {' · '}Disponível: <strong>{moeda.format(disponivel)}</strong>
              {' · '}Limite total: {moeda.format(limite)}
            </p>
            {limite > 0 && (
              <progress className="fatura-limite"
                aria-label={`Limite usado do cartão ${cartao.nome}`}
                value={Math.min(usado, limite)}
                max={limite}
              />
            )}

            {cartao.faturas.map((fatura, indice) => {
              const vencimento = fatura.vencimento
              const mes = formatoMes.format(dataUtc(fatura.vencimento))

              return (
                <article key={vencimento} className="fatura-periodo">
                  <h3>{indice === 0 ? 'Fatura atual' : 'Próxima fatura'} · {mes}</h3>
                  <p>
                    Fechamento:{' '}
                    <time dateTime={fatura.fechamento}>
                      {formatoData.format(dataUtc(fatura.fechamento))}
                    </time>
                    {' · '}Vencimento:{' '}
                    <time dateTime={vencimento}>
                      {formatoData.format(dataUtc(fatura.vencimento))}
                    </time>
                    {' · '}Total: <strong>{moeda.format(fatura.total)}</strong>
                  </p>

                  {fatura.lancamentos.length === 0 ? (
                    <p>Nenhum lançamento nesta fatura.</p>
                  ) : (
                    <ul>
                      {fatura.lancamentos.map((parcela) => (
                        <li key={parcela.id}>
                          {parcela.descricao} · {moeda.format(Number(parcela.valor))}
                          {' · '}
                          {parcela.totalParcelas > 1 ? (
                            <strong>
                              Parcela {parcela.parcelaAtual}/{parcela.totalParcelas}
                              {' · '}Fatura de {mes}
                            </strong>
                          ) : (
                            'À vista'
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              )
            })}
          </section>
        )
      })}
    </section>
  )
}
