import { useEffect, useId } from 'react';

export default function ModalConfirmacao({
  aberto,
  titulo = 'Confirmar',
  mensagem,
  confirmarTexto = 'Confirmar',
  cancelarTexto = 'Cancelar',
  onConfirmar,
  onCancelar,
}) {
  const tituloId = useId();

  useEffect(() => {
    if (!aberto || !onCancelar) return undefined;
    const aoTeclar = (evento) => {
      if (evento.key === 'Escape') onCancelar();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aberto, onCancelar]);

  if (!aberto) return null;

  return (
    <div
      className="ui-modal-fundo"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) onCancelar?.();
      }}
    >
      <div className="ui-modal" role="dialog" aria-modal="true" aria-labelledby={tituloId}>
        <h2 id={tituloId}>{titulo}</h2>
        {mensagem && <p>{mensagem}</p>}
        <div className="ui-modal-acoes">
          <button type="button" className="ui-botao-secundario" onClick={onCancelar}>
            {cancelarTexto}
          </button>
          <button type="button" className="ui-botao-perigo" onClick={onConfirmar}>
            {confirmarTexto}
          </button>
        </div>
      </div>
    </div>
  );
}
