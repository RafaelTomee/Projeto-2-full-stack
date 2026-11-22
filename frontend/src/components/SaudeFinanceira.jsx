const indicadores = [
  { nome: 'Receitas do mês', valor: 2000 },
  { nome: 'Despesas do mês', valor: 1800 },
  { nome: 'Saldo do mês', valor: 200 },
]

const dicas = [
  'Revise as despesas recorrentes do mês.',
  'Confira os vencimentos das próximas contas.',
]

const moeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

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
