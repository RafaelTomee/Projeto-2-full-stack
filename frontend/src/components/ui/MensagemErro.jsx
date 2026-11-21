export default function MensagemErro({ mensagem, campos = {} }) {
  const itens = Object.entries(campos ?? {});
  if (!mensagem && itens.length === 0) return null;

  return (
    <div className="ui-erro" role="alert">
      {mensagem && <p>{mensagem}</p>}
      {itens.length > 0 && (
        <ul>
          {itens.map(([campo, texto]) => (
            <li key={campo}>
              <strong>{campo}:</strong> {texto}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
