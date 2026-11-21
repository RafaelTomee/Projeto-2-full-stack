import { useCallback, useEffect, useState } from 'react'
import { api, extrairErro } from '../services/api.js'
import { formatarMoeda } from '../utils/formatacao.js'
import { fonteParaFormulario, fonteParaPayload } from '../utils/formularios.js'
import { CampoMoeda, Loading, MensagemErro, ModalConfirmacao, Vazio } from './ui/index.js'

const ROTULOS = { renda: 'Renda', conta: 'Conta', cartao_credito: 'Cartão de crédito' }
const TIPOS = Object.keys(ROTULOS)

export default function FontesDestinos() {
  const [fontes, setFontes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarregar, setErroCarregar] = useState(null)
  const [formulario, setFormulario] = useState(() => fonteParaFormulario())
  const [editando, setEditando] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [errosCampo, setErrosCampo] = useState({})
  const [erroSalvar, setErroSalvar] = useState(null)
  const [excluindo, setExcluindo] = useState(null)
  const [erroExcluir, setErroExcluir] = useState(null)

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get('/fontes-destinos')
      setFontes(data)
      setErroCarregar(null)
    } catch (erro) {
      setErroCarregar(extrairErro(erro))
    } finally {
      setCarregando(false)
    }
  }, [])

  // O estado já começa como "carregando"; os updates de carregar() ocorrem
  // depois do await, não de forma síncrona durante a renderização.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    carregar()
  }, [carregar])

  const recarregar = useCallback(async () => {
    setCarregando(true)
    await carregar()
  }, [carregar])

  const alterar = (campo, valor) => setFormulario((atual) => ({ ...atual, [campo]: valor }))

  const limparFormulario = () => {
    setFormulario(fonteParaFormulario())
    setEditando(null)
    setErrosCampo({})
    setErroSalvar(null)
  }

  const aoEnviar = async (evento) => {
    evento.preventDefault()
    setSalvando(true)
    setErrosCampo({})
    setErroSalvar(null)
    const payload = fonteParaPayload(formulario)
    try {
      if (editando) await api.put(`/fontes-destinos/${editando}`, payload)
      else await api.post('/fontes-destinos', payload)
      limparFormulario()
      await recarregar()
    } catch (erro) {
      const { mensagem, campos } = extrairErro(erro)
      setErrosCampo(campos)
      setErroSalvar(mensagem)
    } finally {
      setSalvando(false)
    }
  }

  const aoEditar = (fonte) => {
    setFormulario(fonteParaFormulario(fonte))
    setEditando(fonte.id)
    setErrosCampo({})
    setErroSalvar(null)
  }

  const confirmarExclusao = async () => {
    if (!excluindo) return
    setErroExcluir(null)
    try {
      await api.delete(`/fontes-destinos/${excluindo.id}`)
      setExcluindo(null)
      await recarregar()
    } catch (erro) {
      setErroExcluir(extrairErro(erro).mensagem)
    }
  }

  const ehCartao = formulario.tipo === 'cartao_credito'

  return (
    <section>
      <div className="ui-cabecalho">
        <h1>Fontes e destinos</h1>
      </div>

      <form className="ui-formulario" onSubmit={aoEnviar}>
        <div>
          <label htmlFor="fonte-nome">Nome</label>
          <input
            id="fonte-nome"
            value={formulario.nome}
            onChange={(evento) => alterar('nome', evento.target.value)}
            aria-invalid={Boolean(errosCampo.nome)}
            maxLength={60}
          />
          {errosCampo.nome && <p className="erro-campo">{errosCampo.nome}</p>}
        </div>
        <div>
          <label htmlFor="fonte-tipo">Tipo</label>
          <select
            id="fonte-tipo"
            value={formulario.tipo}
            onChange={(evento) => alterar('tipo', evento.target.value)}
            aria-invalid={Boolean(errosCampo.tipo)}
          >
            {TIPOS.map((tipo) => (
              <option key={tipo} value={tipo}>{ROTULOS[tipo]}</option>
            ))}
          </select>
          {errosCampo.tipo && <p className="erro-campo">{errosCampo.tipo}</p>}
        </div>

        {ehCartao && (
          <>
            <div>
              <label htmlFor="fonte-fechamento">Dia do fechamento</label>
              <input
                id="fonte-fechamento"
                type="number"
                min="1"
                max="31"
                value={formulario.diaFechamento ?? ''}
                onChange={(evento) => alterar('diaFechamento', evento.target.value)}
                aria-invalid={Boolean(errosCampo.diaFechamento)}
              />
              {errosCampo.diaFechamento && <p className="erro-campo">{errosCampo.diaFechamento}</p>}
            </div>
            <div>
              <label htmlFor="fonte-vencimento">Dia do vencimento</label>
              <input
                id="fonte-vencimento"
                type="number"
                min="1"
                max="31"
                value={formulario.diaVencimento ?? ''}
                onChange={(evento) => alterar('diaVencimento', evento.target.value)}
                aria-invalid={Boolean(errosCampo.diaVencimento)}
              />
              {errosCampo.diaVencimento && <p className="erro-campo">{errosCampo.diaVencimento}</p>}
            </div>
            <CampoMoeda
              label="Limite"
              valor={formulario.limite}
              onValorChange={(valor) => alterar('limite', valor)}
              erro={errosCampo.limite}
            />
          </>
        )}

        <div className="ui-formulario-acoes">
          <button type="submit" disabled={salvando}>
            {salvando ? 'Salvando...' : editando ? 'Atualizar' : 'Adicionar'}
          </button>
          {editando && (
            <button type="button" className="ui-botao-secundario" onClick={limparFormulario}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      {erroSalvar && <MensagemErro mensagem={erroSalvar} />}
      {erroExcluir && <MensagemErro mensagem={erroExcluir} />}

      {carregando ? (
        <Loading mensagem="Carregando fontes e destinos..." />
      ) : erroCarregar ? (
        <>
          <MensagemErro mensagem={erroCarregar.mensagem} />
          <button type="button" className="ui-botao-secundario" onClick={recarregar}>Tentar novamente</button>
        </>
      ) : fontes.length === 0 ? (
        <Vazio mensagem="Nenhuma fonte ou destino cadastrado." />
      ) : (
        <table className="ui-tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Tipo</th>
              <th>Detalhes</th>
              <th>Reserva</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {fontes.map((fonte) => (
              <tr key={fonte.id}>
                <td>{fonte.nome}</td>
                <td>
                  <span className={`ui-badge ui-badge-${fonte.tipo}`}>
                    {ROTULOS[fonte.tipo] ?? fonte.tipo}
                  </span>
                </td>
                <td>
                  {fonte.tipo === 'cartao_credito'
                    ? `Fecha ${fonte.dia_fechamento}/${fonte.dia_vencimento} · Limite ${formatarMoeda(fonte.limite)}`
                    : '—'}
                </td>
                <td>{fonte.reserva ? 'Sim' : 'Não'}</td>
                <td className="ui-acoes">
                  <button type="button" onClick={() => aoEditar(fonte)}>Editar</button>
                  <button
                    type="button"
                    className="ui-botao-perigo"
                    onClick={() => {
                      setExcluindo(fonte)
                      setErroExcluir(null)
                    }}
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ModalConfirmacao
        aberto={Boolean(excluindo)}
        titulo="Excluir fonte/destino"
        mensagem={`Tem certeza que deseja excluir "${excluindo?.nome ?? ''}"?`}
        confirmarTexto="Excluir"
        onConfirmar={confirmarExclusao}
        onCancelar={() => setExcluindo(null)}
      />
    </section>
  )
}
