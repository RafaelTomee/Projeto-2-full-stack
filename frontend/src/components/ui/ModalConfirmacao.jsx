import { useEffect, useId, useRef } from 'react';
import MensagemErro from './MensagemErro.jsx';

// `carregando` deve ser usado pelo pai enquanto a ação (ex.: DELETE) roda:
// desabilita os botões e bloqueia Esc/clique fora, evitando requisições duplas.
export default function ModalConfirmacao({
  aberto,
  titulo = 'Confirmar',
  mensagem,
  erro,
  confirmarTexto = 'Confirmar',
  cancelarTexto = 'Cancelar',
  acaoExtraTexto,
  onConfirmar,
  onAcaoExtra,
  onCancelar,
  carregando = false,
  perigo = true,
}) {
  const tituloId = useId();
  const modalRef = useRef(null);
  const cancelarRef = useRef(null);
  const anteriorRef = useRef(null);
  const onCancelarRef = useRef(onCancelar);
  const onConfirmarRef = useRef(onConfirmar);
  const carregandoRef = useRef(carregando);
  const iniciadoRef = useRef(false);

  useEffect(() => {
    onCancelarRef.current = onCancelar;
    onConfirmarRef.current = onConfirmar;
    carregandoRef.current = carregando;
  });

  useEffect(() => {
    if (!aberto) {
      iniciadoRef.current = false;
      return undefined;
    }

    // O botão "Cancelar" é o foco inicial por ser a ação segura.
    anteriorRef.current = document.activeElement;
    cancelarRef.current?.focus();

    const aoTeclar = (evento) => {
      if (carregandoRef.current) return;
      if (evento.key === 'Escape') {
        evento.preventDefault();
        onCancelarRef.current?.();
        return;
      }
      if (evento.key !== 'Tab') return;

      const focaveis = Array.from(
        modalRef.current?.querySelectorAll(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focaveis.length === 0) {
        evento.preventDefault();
        return;
      }
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    };

    window.addEventListener('keydown', aoTeclar);
    return () => {
      window.removeEventListener('keydown', aoTeclar);
      anteriorRef.current?.focus?.();
    };
  }, [aberto]);

  if (!aberto) return null;

  const confirmar = () => {
    if (carregando || iniciadoRef.current) return;
    iniciadoRef.current = true;
    Promise.resolve(onConfirmarRef.current?.()).finally(() => {
      iniciadoRef.current = false;
    });
  };

  return (
    <div
      className="ui-modal-fundo"
      onMouseDown={(evento) => {
        if (!carregando && evento.target === evento.currentTarget) onCancelar?.();
      }}
    >
      <div
        ref={modalRef}
        className="ui-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-busy={carregando || undefined}
      >
        <h2 id={tituloId}>{titulo}</h2>
        {mensagem && <p>{mensagem}</p>}
        <MensagemErro mensagem={erro} />
        <div className="ui-modal-acoes">
          <button
            type="button"
            ref={cancelarRef}
            className="ui-botao-secundario"
            onClick={onCancelar}
            disabled={carregando}
          >
            {cancelarTexto}
          </button>
          <button
            type="button"
            className={perigo ? 'ui-botao-perigo' : 'ui-botao-primario'}
            onClick={confirmar}
            disabled={carregando}
          >
            {confirmarTexto}
          </button>
          {acaoExtraTexto && onAcaoExtra && (
            <button type="button" className="ui-botao-secundario" onClick={onAcaoExtra}>
              {acaoExtraTexto}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
