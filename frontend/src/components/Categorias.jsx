import { useCallback, useEffect, useRef, useState } from 'react'
import { api, extrairErro } from '../services/api.js'
import { categoriaParaFormulario, categoriaParaPayload } from '../utils/formularios.js'
import { Loading, MensagemErro, ModalConfirmacao, Vazio } from './ui/index.js'
import AvisoAcao from './ui/AvisoAcao.jsx'

import ModalFormulario from './ui/ModalFormulario.jsx'

const ROTULOS = { entrada: 'Entrada', saida: 'Saída' }

export default function Categorias() {
  const [categorias, setCategorias] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarregar, setErroCarregar] = useState(null)
  const [formulario, setFormulario] = useState(() => categoriaParaFormulario())
  const [formularioAberto, setFormularioAberto] = useState(false)
  const [aviso, setAviso] = useState('')
  const [editando, setEditando] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [errosCampo, setErrosCampo] = useState({})
  const [erroSalvar, setErroSalvar] = useState(null)
  const [excluindo, setExcluindo] = useState(null)
  const [erroExcluir, setErroExcluir] = useState(null)
  const [excluindoEmAndamento, setExcluindoEmAndamento] = useState(false)
  const editandoRef = useRef(null)

  useEffect(() => {
    editandoRef.current = editando
  }, [editando])

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get('/categorias')
      setCategorias(data)
      // Se o item em edição foi excluído, não deixa o form em modo edição.
      if (editandoRef.current && !data.some((item) => item.id === editandoRef.current)) {
        setFormulario(categoriaParaFormulario())
        setEditando(null)
        setErrosCampo({})
        setErroSalvar(null)
      }
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
    setFormularioAberto(false)
    setFormulario(categoriaParaFormulario())
    setEditando(null)
    setErrosCampo({})
    setErroSalvar(null)
  }

  const aoEnviar = async (evento) => {
    evento.preventDefault()
    setAviso('')
    setSalvando(true)
    setErrosCampo({})
    setErroSalvar(null)
    const payload = categoriaParaPayload(formulario)
    try {
      if (editando) await api.put(`/categorias/${editando}`, payload)
      else await api.post('/categorias', payload)
      setAviso(editando ? 'Categoria: edição salva.' : 'Categoria: cadastro salvo.')
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

  const aoEditar = (categoria) => {
    setFormulario(categoriaParaFormulario(categoria))
    setEditando(categoria.id)
    setErrosCampo({})
    setErroSalvar(null)
    setFormularioAberto(true)
  }

  const confirmarExclusao = async () => {
    if (!excluindo || excluindoEmAndamento) return
    setAviso('')
    setExcluindoEmAndamento(true)
    setErroExcluir(null)
    try {
      await api.delete(`/categorias/${excluindo.id}`)
      setExcluindo(null)
      setAviso('Categoria: exclusão concluída.')
      await recarregar()
    } catch (erro) {
      // Mantém o modal aberto e mostra o erro dentro dele (409 por vínculo).
      setErroExcluir(extrairErro(erro).mensagem)
    } finally {
      setExcluindoEmAndamento(false)
    }
  }

  return (
    <section>
      <div className="ui-cabecalho">
        <h1>Categorias</h1>
        <button type="button" className="ui-botao-primario" onClick={() => {
          limparFormulario()
          setFormularioAberto(true)
        }}>Nova categoria</button>
      </div>

      {formularioAberto && (
        <ModalFormulario
          titulo={editando ? 'Editar categoria' : 'Nova categoria'}
          salvando={salvando}
          onCancelar={limparFormulario}
        >
          <form className="ui-formulario" onSubmit={aoEnviar}>
            <div>
              <label htmlFor="categoria-nome">Nome</label>
              <input
                id="categoria-nome"
                value={formulario.nome}
                onChange={(evento) => alterar('nome', evento.target.value)}
                aria-invalid={Boolean(errosCampo.nome)}
                aria-describedby={errosCampo.nome ? 'categoria-nome-erro' : undefined}
                maxLength={60}
              />
              {errosCampo.nome && (
                <p id="categoria-nome-erro" className="erro-campo">{errosCampo.nome}</p>
              )}
            </div>
            <div>
              <label htmlFor="categoria-tipo">Tipo</label>
              <select
                id="categoria-tipo"
                value={formulario.tipo}
                onChange={(evento) => alterar('tipo', evento.target.value)}
                aria-invalid={Boolean(errosCampo.tipo)}
                aria-describedby={errosCampo.tipo ? 'categoria-tipo-erro' : undefined}
              >
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
              </select>
              {errosCampo.tipo && (
                <p id="categoria-tipo-erro" className="erro-campo">{errosCampo.tipo}</p>
              )}
            </div>
            <div className="ui-formulario-acoes">
              <button type="submit" disabled={salvando}>
                {salvando ? 'Salvando...' : editando ? 'Atualizar' : 'Adicionar'}
              </button>
              <button type="button" className="ui-botao-secundario" onClick={limparFormulario} disabled={salvando}>
                Cancelar
              </button>
            </div>
          </form>

          {erroSalvar && Object.keys(errosCampo).length === 0 && (
            <MensagemErro mensagem={erroSalvar} />
          )}
        </ModalFormulario>
      )}

      {aviso && <AvisoAcao mensagem={aviso} onFechar={() => setAviso('')} />}

      {carregando ? (
        <Loading mensagem="Carregando categorias..." />
      ) : erroCarregar ? (
        <>
          <MensagemErro mensagem={erroCarregar.mensagem} />
          <button type="button" className="ui-botao-secundario" onClick={recarregar}>Tentar novamente</button>
        </>
      ) : categorias.length === 0 ? (
        <Vazio mensagem="Nenhuma categoria cadastrada." />
      ) : (
        <div className="ui-tabela-rolavel">
        <table className="ui-tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Tipo</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {categorias.map((categoria) => (
              <tr key={categoria.id}>
                <td>{categoria.nome}</td>
                <td>
                  <span className={`ui-badge ui-badge-${categoria.tipo}`}>
                    {ROTULOS[categoria.tipo] ?? categoria.tipo}
                  </span>
                </td>
                <td className="ui-acoes">
                  <button type="button" onClick={() => aoEditar(categoria)}>Editar</button>
                  <button
                    type="button"
                    className="ui-botao-perigo"
                    onClick={() => {
                      setExcluindo(categoria)
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
        </div>
      )}

      <ModalConfirmacao
        aberto={Boolean(excluindo)}
        titulo="Excluir categoria"
        mensagem={`Tem certeza que deseja excluir "${excluindo?.nome ?? ''}"?`}
        confirmarTexto="Excluir"
        erro={erroExcluir}
        carregando={excluindoEmAndamento}
        onConfirmar={confirmarExclusao}
        onCancelar={() => setExcluindo(null)}
      />
    </section>
  )
}
