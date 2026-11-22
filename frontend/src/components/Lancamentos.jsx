import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, extrairErro } from '../services/api.js'
import { formatarData, formatarMoeda } from '../utils/formatacao.js'
import {
  filtrosParaParams,
  fontesParaTipo,
  foraDoPeriodo,
  hojeIso,
  lancamentoParaFormulario,
  lancamentoParaPayload,
  paginaAjustada,
  periodoPadrao,
  rotuloParcela,
} from '../utils/lancamentos.js'
import { CampoMoeda, Loading, MensagemErro, ModalConfirmacao, Vazio } from './ui/index.js'

const ROTULOS_TIPO = { entrada: 'Entrada', saida: 'Saída' }
const ROTULOS_ERROS = {
  tipo: 'Tipo',
  descricao: 'Descrição',
  valor: 'Valor',
  data: 'Data',
  categoriaId: 'Categoria',
  fonteDestinoId: 'Fonte/destino',
  totalParcelas: 'Parcelas',
  periodo: 'Período',
}
const VAZIO = {
  lancamentos: [],
  pagina: 1,
  totalPaginas: 1,
  totalRegistros: 0,
  totais: { entradas: 0, saidas: 0, saldo: 0 },
}
const filtrosIniciais = () => ({
  ...periodoPadrao(),
  tipo: '',
  categoriaId: '',
  fonteDestinoId: '',
  pagina: 1,
})

export default function Lancamentos() {
  const [filtros, setFiltros] = useState(filtrosIniciais)
  const [dados, setDados] = useState(VAZIO)
  const [carregando, setCarregando] = useState(true)
  const [erroCarregar, setErroCarregar] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [fontes, setFontes] = useState([])
  const [erroAuxiliares, setErroAuxiliares] = useState(null)
  const [formAberto, setFormAberto] = useState(false)
  const [formulario, setFormulario] = useState(() => lancamentoParaFormulario({ data: hojeIso() }))
  const [editando, setEditando] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [errosCampo, setErrosCampo] = useState({})
  const [erroSalvar, setErroSalvar] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [excluindo, setExcluindo] = useState(null)
  const [erroExcluir, setErroExcluir] = useState(null)
  const [excluindoEmAndamento, setExcluindoEmAndamento] = useState(false)

  const carregar = useCallback(async (sinal) => {
    try {
      const { data } = await api.get('/lancamentos', {
        params: filtrosParaParams(filtros),
        signal: sinal,
      })
      setDados(data)
      setErroCarregar(null)
      return data
    } catch (erro) {
      if (erro?.code !== 'ERR_CANCELED') setErroCarregar(extrairErro(erro))
      return null
    } finally {
      if (!sinal?.aborted) setCarregando(false)
    }
  }, [filtros])

  useEffect(() => {
    const controlador = new AbortController()
    // Os updates de carregar() acontecem depois do await; o abort evita
    // que uma resposta antiga sobrescreva um filtro mais recente.
    // oxlint-disable-next-line react/set-state-in-effect
    carregar(controlador.signal)
    return () => controlador.abort()
  }, [carregar])

  const recarregar = useCallback(async () => {
    setCarregando(true)
    const data = await carregar()
    // Excluir o último item da página 2 devolve lista vazia com totalPaginas=1.
    const pagina = paginaAjustada(filtros.pagina, data?.totalPaginas)
    if (pagina !== filtros.pagina) {
      setCarregando(true)
      setFiltros((atual) => ({ ...atual, pagina }))
    }
  }, [carregar, filtros.pagina])

  const carregarAuxiliares = useCallback(async () => {
    try {
      const [respCategorias, respFontes] = await Promise.all([
        api.get('/categorias'),
        api.get('/fontes-destinos'),
      ])
      setCategorias(respCategorias.data)
      setFontes(respFontes.data)
      setErroAuxiliares(null)
    } catch (erro) {
      setErroAuxiliares(extrairErro(erro).mensagem)
    }
  }, [])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    carregarAuxiliares()
  }, [carregarAuxiliares])

  const alterarFiltro = (campo, valor) => {
    // Apagar "De"/"Até" enviaria o filtro vazio e a API aplicaria o padrão,
    // deixando o campo vazio na tela com um período diferente. Mantém o valor anterior.
    if ((campo === 'inicio' || campo === 'fim') && valor === '') return
    setCarregando(true)
    setFiltros((atual) => ({
      ...atual,
      [campo]: valor,
      ...(campo === 'pagina' ? {} : { pagina: 1 }),
    }))
  }

  const limparFiltros = () => {
    setCarregando(true)
    setFiltros(filtrosIniciais())
  }

  const categoriasDisponiveis = useMemo(
    () => categorias.filter((categoria) => categoria.tipo === formulario.tipo),
    [categorias, formulario.tipo],
  )
  const fontesDisponiveis = useMemo(
    () => fontesParaTipo(fontes, formulario.tipo),
    [fontes, formulario.tipo],
  )
  const fonteSelecionada = useMemo(
    () => fontes.find((fonte) => String(fonte.id) === String(formulario.fonteDestinoId)),
    [fontes, formulario.fonteDestinoId],
  )
  const ehCartao = fonteSelecionada?.tipo === 'cartao_credito'
  const editandoParcela = Boolean(editando && Number(formulario.totalParcelas) > 1)
  const campoParcelasVisivel = Boolean(ehCartao && !editando)
  const camposVisiveis = new Set(
    editandoParcela
      ? ['descricao', 'categoriaId']
      : [
          'tipo',
          'descricao',
          'valor',
          'data',
          'categoriaId',
          'fonteDestinoId',
          ...(campoParcelasVisivel ? ['totalParcelas'] : []),
        ],
  )
  const camposBanner = Object.fromEntries(
    Object.entries(errosCampo).filter(([campo]) => !camposVisiveis.has(campo)),
  )
  const nomeCategoria = (id) =>
    categorias.find((categoria) => String(categoria.id) === String(id))?.nome ?? '—'
  const nomeFonte = (id) =>
    fontes.find((fonte) => String(fonte.id) === String(id))?.nome ?? '—'

  const alterar = (campo, valor) => setFormulario((atual) => ({ ...atual, [campo]: valor }))

  const alterarTipo = (tipo) => {
    setFormulario((atual) => ({ ...atual, tipo, categoriaId: '', fonteDestinoId: '' }))
    setErrosCampo({})
  }

  const limparFormulario = () => {
    setFormulario(lancamentoParaFormulario({ data: hojeIso() }))
    setEditando(null)
    setFormAberto(false)
    setErrosCampo({})
    setErroSalvar(null)
    setAviso(null)
  }

  const abrirNovo = () => {
    limparFormulario()
    setFormAberto(true)
  }

  const aoEditar = (lancamento) => {
    setFormulario(lancamentoParaFormulario(lancamento))
    setEditando(lancamento.id)
    setFormAberto(true)
    setErrosCampo({})
    setErroSalvar(null)
    setAviso(null)
  }

  const aoEnviar = async (evento) => {
    evento.preventDefault()
    setSalvando(true)
    setErrosCampo({})
    setErroSalvar(null)
    setAviso(null)
    try {
      const payload = lancamentoParaPayload(formulario)
      if (editando) await api.put(`/lancamentos/${editando}`, payload)
      else await api.post('/lancamentos', payload)
      limparFormulario()
      if (!editando && foraDoPeriodo(payload.data, filtros.inicio, filtros.fim)) {
        setAviso(`Lançamento salvo em ${formatarData(payload.data)} — fora do período filtrado.`)
      }
      await recarregar()
    } catch (erro) {
      const { mensagem, campos } = extrairErro(erro)
      setErrosCampo(campos)
      setErroSalvar(mensagem)
    } finally {
      setSalvando(false)
    }
  }

  const confirmarExclusao = async (todas = false) => {
    if (!excluindo || excluindoEmAndamento) return
    setExcluindoEmAndamento(true)
    setErroExcluir(null)
    try {
      const sufixo = todas && excluindo.grupoParcelamento ? '?todasParcelas=true' : ''
      await api.delete(`/lancamentos/${excluindo.id}${sufixo}`)
      setExcluindo(null)
      await recarregar()
    } catch (erro) {
      // Mantém o modal aberto: o erro aparece dentro dele, acima do overlay.
      setErroExcluir(extrairErro(erro).mensagem)
    } finally {
      setExcluindoEmAndamento(false)
    }
  }

  const { lancamentos, totalPaginas, totalRegistros, totais } = dados
  const parcelado = Boolean(excluindo?.grupoParcelamento)
  const pagina = dados.pagina ?? 1

  return (
    <section>
      <div className="ui-cabecalho">
        <h1>Lançamentos</h1>
        <button type="button" onClick={abrirNovo}>Novo lançamento</button>
      </div>

      <div className="ui-filtros">
        <div>
          <label htmlFor="filtro-inicio">De</label>
          <input
            id="filtro-inicio"
            type="date"
            value={filtros.inicio}
            onChange={(evento) => alterarFiltro('inicio', evento.target.value)}
          />
        </div>
        <div>
          <label htmlFor="filtro-fim">Até</label>
          <input
            id="filtro-fim"
            type="date"
            value={filtros.fim}
            onChange={(evento) => alterarFiltro('fim', evento.target.value)}
          />
        </div>
        <div>
          <label htmlFor="filtro-tipo">Tipo</label>
          <select
            id="filtro-tipo"
            value={filtros.tipo}
            onChange={(evento) => alterarFiltro('tipo', evento.target.value)}
          >
            <option value="">Todos</option>
            <option value="entrada">Entrada</option>
            <option value="saida">Saída</option>
          </select>
        </div>
        <div>
          <label htmlFor="filtro-categoria">Categoria</label>
          <select
            id="filtro-categoria"
            value={filtros.categoriaId}
            onChange={(evento) => alterarFiltro('categoriaId', evento.target.value)}
          >
            <option value="">Todas</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filtro-fonte">Fonte/destino</label>
          <select
            id="filtro-fonte"
            value={filtros.fonteDestinoId}
            onChange={(evento) => alterarFiltro('fonteDestinoId', evento.target.value)}
          >
            <option value="">Todos</option>
            {fontes.map((fonte) => (
              <option key={fonte.id} value={fonte.id}>{fonte.nome}</option>
            ))}
          </select>
        </div>
        <button type="button" className="ui-botao-secundario" onClick={limparFiltros}>
          Limpar filtros
        </button>
      </div>

      {erroAuxiliares && <MensagemErro mensagem={`Não foi possível carregar categorias e fontes: ${erroAuxiliares}`} />}

      <div className="ui-cards">
        <div className="ui-card ui-card-entradas">
          <span>Entradas</span>
          <strong>{formatarMoeda(totais?.entradas)}</strong>
        </div>
        <div className="ui-card ui-card-saidas">
          <span>Saídas</span>
          <strong>{formatarMoeda(totais?.saidas)}</strong>
        </div>
        <div className="ui-card ui-card-saldo">
          <span>Saldo</span>
          <strong>{formatarMoeda(totais?.saldo)}</strong>
        </div>
      </div>

      {formAberto && (
        <form className="ui-formulario" onSubmit={aoEnviar}>
          <div>
            <label htmlFor="lancamento-tipo">Tipo</label>
            <select
              id="lancamento-tipo"
              value={formulario.tipo}
              onChange={(evento) => alterarTipo(evento.target.value)}
              disabled={editandoParcela}
              aria-invalid={Boolean(errosCampo.tipo)}
              aria-describedby={errosCampo.tipo ? 'lancamento-tipo-erro' : undefined}
            >
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </select>
            {errosCampo.tipo && (
              <p id="lancamento-tipo-erro" className="erro-campo">{errosCampo.tipo}</p>
            )}
          </div>
          <div>
            <label htmlFor="lancamento-descricao">Descrição</label>
            <input
              id="lancamento-descricao"
              value={formulario.descricao}
              onChange={(evento) => alterar('descricao', evento.target.value)}
              aria-invalid={Boolean(errosCampo.descricao)}
              aria-describedby={errosCampo.descricao ? 'lancamento-descricao-erro' : undefined}
              maxLength={120}
            />
            {errosCampo.descricao && (
              <p id="lancamento-descricao-erro" className="erro-campo">{errosCampo.descricao}</p>
            )}
          </div>
          <CampoMoeda
            label="Valor"
            valor={formulario.valor}
            onValorChange={(valor) => alterar('valor', valor)}
            disabled={editandoParcela}
            erro={errosCampo.valor}
          />
          <div>
            <label htmlFor="lancamento-data">Data</label>
            <input
              id="lancamento-data"
              type="date"
              value={formulario.data}
              onChange={(evento) => alterar('data', evento.target.value)}
              disabled={editandoParcela}
              aria-invalid={Boolean(errosCampo.data)}
              aria-describedby={errosCampo.data ? 'lancamento-data-erro' : undefined}
            />
            {errosCampo.data && (
              <p id="lancamento-data-erro" className="erro-campo">{errosCampo.data}</p>
            )}
          </div>
          <div>
            <label htmlFor="lancamento-categoria">Categoria</label>
            <select
              id="lancamento-categoria"
              value={formulario.categoriaId}
              onChange={(evento) => alterar('categoriaId', evento.target.value)}
              aria-invalid={Boolean(errosCampo.categoriaId)}
              aria-describedby={errosCampo.categoriaId ? 'lancamento-categoria-erro' : undefined}
            >
              <option value="">Selecione</option>
              {categoriasDisponiveis.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>
              ))}
            </select>
            {errosCampo.categoriaId && (
              <p id="lancamento-categoria-erro" className="erro-campo">{errosCampo.categoriaId}</p>
            )}
          </div>
          <div>
            <label htmlFor="lancamento-fonte">Fonte/destino</label>
            <select
              id="lancamento-fonte"
              value={formulario.fonteDestinoId}
              onChange={(evento) => alterar('fonteDestinoId', evento.target.value)}
              disabled={editandoParcela}
              aria-invalid={Boolean(errosCampo.fonteDestinoId)}
              aria-describedby={errosCampo.fonteDestinoId ? 'lancamento-fonte-erro' : undefined}
            >
              <option value="">Selecione</option>
              {fontesDisponiveis.map((fonte) => (
                <option key={fonte.id} value={fonte.id}>{fonte.nome}</option>
              ))}
            </select>
            {errosCampo.fonteDestinoId && (
              <p id="lancamento-fonte-erro" className="erro-campo">{errosCampo.fonteDestinoId}</p>
            )}
          </div>

          {campoParcelasVisivel && (
            <div>
              <label htmlFor="lancamento-parcelas">Parcelas</label>
              <input
                id="lancamento-parcelas"
                type="number"
                min="1"
                max="48"
                value={formulario.totalParcelas}
                onChange={(evento) => alterar('totalParcelas', evento.target.value)}
                aria-invalid={Boolean(errosCampo.totalParcelas)}
                aria-describedby={errosCampo.totalParcelas ? 'lancamento-parcelas-erro' : undefined}
              />
              {errosCampo.totalParcelas && (
                <p id="lancamento-parcelas-erro" className="erro-campo">{errosCampo.totalParcelas}</p>
              )}
            </div>
          )}
          {editandoParcela && (
            <p className="ui-dica">
              Parcelamento fixo: {rotuloParcela(formulario)}. Exclua e recrie o parcelamento
              para alterar valor, data, tipo ou fonte.
            </p>
          )}

          <div className="ui-formulario-acoes">
            <button type="submit" disabled={salvando}>
              {salvando ? 'Salvando...' : editando ? 'Atualizar' : 'Adicionar'}
            </button>
            <button type="button" className="ui-botao-secundario" onClick={limparFormulario}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {(erroSalvar || Object.keys(camposBanner).length > 0) && (
        <MensagemErro
          mensagem={erroSalvar}
          campos={camposBanner}
          rotulos={ROTULOS_ERROS}
        />
      )}
      {aviso && <p className="ui-aviso" role="status">{aviso}</p>}

      {carregando ? (
        <Loading mensagem="Carregando lançamentos..." />
      ) : erroCarregar ? (
        <>
          <MensagemErro
            mensagem={erroCarregar.mensagem}
            campos={erroCarregar.campos}
            rotulos={ROTULOS_ERROS}
          />
          <button type="button" className="ui-botao-secundario" onClick={recarregar}>Tentar novamente</button>
        </>
      ) : lancamentos.length === 0 ? (
        <Vazio
          mensagem={
            pagina > 1 && totalRegistros > 0
              ? 'Não há lançamentos nesta página.'
              : 'Nenhum lançamento no período selecionado.'
          }
        />
      ) : (
        <div className="ui-tabela-rolavel">
          <table className="ui-tabela">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Fonte/destino</th>
                <th>Valor</th>
                <th>Parcela</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {lancamentos.map((lancamento) => (
                <tr key={lancamento.id}>
                  <td>{formatarData(lancamento.data)}</td>
                  <td>
                    <span className={`ui-badge ui-badge-${lancamento.tipo}`}>
                      {ROTULOS_TIPO[lancamento.tipo] ?? lancamento.tipo}
                    </span>
                  </td>
                  <td>{lancamento.descricao}</td>
                  <td>{nomeCategoria(lancamento.categoriaId)}</td>
                  <td>{nomeFonte(lancamento.fonteDestinoId)}</td>
                  <td>{formatarMoeda(lancamento.valor)}</td>
                  <td>{rotuloParcela(lancamento) || '—'}</td>
                  <td className="ui-acoes">
                    <button type="button" onClick={() => aoEditar(lancamento)}>Editar</button>
                    <button
                      type="button"
                      className="ui-botao-perigo"
                      onClick={() => {
                        setExcluindo(lancamento)
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

      {!carregando && !erroCarregar && (
        <div className="ui-paginacao">
          <span>
            Página {pagina} de {totalPaginas} · {totalRegistros} registro(s)
          </span>
          <button
            type="button"
            className="ui-botao-secundario"
            disabled={pagina <= 1}
            onClick={() => alterarFiltro('pagina', pagina - 1)}
          >
            Anterior
          </button>
          <button
            type="button"
            className="ui-botao-secundario"
            disabled={pagina >= totalPaginas}
            onClick={() => alterarFiltro('pagina', pagina + 1)}
          >
            Próxima
          </button>
        </div>
      )}

      <ModalConfirmacao
        aberto={Boolean(excluindo)}
        titulo="Excluir lançamento"
        mensagem={
          parcelado
            ? 'Este lançamento faz parte de um parcelamento. Excluir só esta parcela ou todas?'
            : `Tem certeza que deseja excluir "${excluindo?.descricao ?? ''}"?`
        }
        confirmarTexto={parcelado ? 'Só esta' : 'Excluir'}
        acaoExtraTexto={parcelado ? 'Todas as parcelas' : undefined}
        erro={erroExcluir}
        carregando={excluindoEmAndamento}
        perigo={!parcelado}
        neutro={parcelado}
        acaoExtraPerigo={parcelado}
        onConfirmar={() => confirmarExclusao(false)}
        onAcaoExtra={parcelado ? () => confirmarExclusao(true) : undefined}
        onCancelar={() => setExcluindo(null)}
      />
    </section>
  )
}
