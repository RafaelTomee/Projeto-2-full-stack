export default function AvisoAcao({ mensagem, onFechar }) {
  return (
    <div className="ui-aviso ui-toast">
      <span role="status">{mensagem}</span>
      <button type="button" className="ui-botao-secundario" onClick={onFechar}>
        Fechar
      </button>
    </div>
  )
}
