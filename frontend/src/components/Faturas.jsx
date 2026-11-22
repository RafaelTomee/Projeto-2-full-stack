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

function dataNoMes(ano, mes, dia) {
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate()
  return new Date(Date.UTC(ano, mes, Math.min(dia, ultimoDia)))
}

function dataIso(data) {
  return data.toISOString().slice(0, 10)
}

function hojeNoBrasil() {
  const partes = new Intl.DateTimeFormat('en', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const data = Object.fromEntries(partes.map(({ type, value }) => [type, value]))
  return `${data.year}-${data.month}-${data.day}`
}

function montarFaturas(cartao, lancamentos, hoje) {
  const [anoAtual, mesAtual] = hoje.split('-').map(Number)
  const vencimentoDesteMes = dataNoMes(anoAtual, mesAtual - 1, cartao.diaVencimento)
  const primeiroMes = mesAtual - 1 + (dataIso(vencimentoDesteMes) < hoje ? 1 : 0)
  const viraMes = cartao.diaVencimento <= cartao.diaFechamento

  const faturas = Array.from({ length: 4 }, (_, indice) => {
    const mes = primeiroMes + indice
    return {
      fechamento: dataNoMes(anoAtual, mes - Number(viraMes), cartao.diaFechamento),
      vencimento: dataNoMes(anoAtual, mes, cartao.diaVencimento),
      parcelas: [],
      totalCentavos: 0,
    }
  })

  const porVencimento = new Map(
    faturas.map((fatura) => [dataIso(fatura.vencimento), fatura]),
  )

  let usadoCentavos = 0
  for (const lancamento of lancamentos) {
    const [ano, mes, dia] = lancamento.data.split('-').map(Number)
    const mesCompra = mes - 1
    const fechamento = dataNoMes(ano, mesCompra, cartao.diaFechamento)
    const cicloSeguinte = dia > fechamento.getUTCDate() ? 1 : 0
    const mesVencimento = mesCompra + cicloSeguinte + Number(viraMes)
      + (lancamento.parcelaAtual ?? 1) - 1
    const vencimento = dataIso(dataNoMes(ano, mesVencimento, cartao.diaVencimento))
    const valorCentavos = Math.round(Number(lancamento.valor) * 100)

    if (vencimento >= hoje) usadoCentavos += valorCentavos

    const fatura = porVencimento.get(vencimento)
    if (fatura) {
      fatura.parcelas.push(lancamento)
      fatura.totalCentavos += valorCentavos
    }
  }

  return { faturas, usadoCentavos }
}

async function carregarCartao(cartao, hoje, signal) {
  const params = { tipo: 'saida', fonteDestinoId: cartao.id }
  const primeira = await api.get('/lancamentos', { params, signal })
  const lancamentos = [...primeira.data.lancamentos]

  for (let pagina = 2; pagina <= primeira.data.totalPaginas; pagina += 1) {
    const { data } = await api.get('/lancamentos', {
      params: { ...params, pagina },
      signal,
    })
    lancamentos.push(...data.lancamentos)
  }

  return { ...cartao, ...montarFaturas(cartao, lancamentos, hoje) }
}

export default function Faturas() {
  const [cartoes, setCartoes] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    const controle = new AbortController()
    const { signal } = controle

    async function carregar() {
      try {
        const { data } = await api.get('/fontes-destinos', { signal })
        const hoje = hojeNoBrasil()
        const resultado = await Promise.all(
          data
            .filter(({ tipo }) => tipo === 'cartao_credito')
            .map((cartao) => carregarCartao(cartao, hoje, signal)),
        )

        if (!signal.aborted) setCartoes(resultado)
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

      {erro && <p role="alert">{erro}</p>}
      {!erro && cartoes === null && <p role="status">Carregando faturas…</p>}
      {cartoes?.length === 0 && <p>Nenhum cartão de crédito cadastrado.</p>}

      {cartoes?.map((cartao) => {
        const limite = Number(cartao.limite)
        const usado = cartao.usadoCentavos / 100
        const disponivel = Math.max(0, limite - usado)

        return (
          <section key={cartao.id}>
            <h2>{cartao.nome}</h2>

            <p>
              Limite usado estimado: <strong>{moeda.format(usado)}</strong>
              {' · '}Disponível: <strong>{moeda.format(disponivel)}</strong>
              {' · '}Limite total: {moeda.format(limite)}
            </p>
            {limite > 0 && (
              <progress
                aria-label={`Limite usado do cartão ${cartao.nome}`}
                value={Math.min(usado, limite)}
                max={limite}
              />
            )}

            {cartao.faturas.map((fatura, indice) => {
              const vencimento = dataIso(fatura.vencimento)
              const mes = formatoMes.format(fatura.vencimento)

              return (
                <article key={vencimento}>
                  <h3>{indice === 0 ? 'Fatura atual' : 'Próxima fatura'} · {mes}</h3>
                  <p>
                    Fechamento:{' '}
                    <time dateTime={dataIso(fatura.fechamento)}>
                      {formatoData.format(fatura.fechamento)}
                    </time>
                    {' · '}Vencimento:{' '}
                    <time dateTime={vencimento}>
                      {formatoData.format(fatura.vencimento)}
                    </time>
                    {' · '}Total: <strong>{moeda.format(fatura.totalCentavos / 100)}</strong>
                  </p>

                  {fatura.parcelas.length === 0 ? (
                    <p>Nenhum lançamento nesta fatura.</p>
                  ) : (
                    <ul>
                      {fatura.parcelas.map((parcela) => (
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
