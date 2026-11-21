export default function Loading({ mensagem = 'Carregando...' }) {
  return (
    <div className="ui-loading" role="status" aria-live="polite">
      <span className="ui-spinner" aria-hidden="true" />
      {mensagem}
    </div>
  );
}
