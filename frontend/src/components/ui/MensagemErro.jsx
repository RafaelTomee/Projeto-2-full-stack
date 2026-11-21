// `rotulos` traduz nomes técnicos da API para o usuário, ex.:
// { categoriaId: 'Categoria', diaFechamento: 'Dia de fechamento' }.
// Sem rótulo, mostramos apenas a mensagem (não o nome do campo em camelCase).
export default function MensagemErro({ mensagem, campos = {}, rotulos = {} }) {
  const itens = Object.entries(campos ?? {});
  if (!mensagem && itens.length === 0) return null;

  return (
    <div className="ui-erro" role="alert">
      {mensagem && <p>{mensagem}</p>}
      {itens.length > 0 && (
        <ul>
          {itens.map(([campo, texto]) => (
            <li key={campo}>
              {rotulos[campo] ? <strong>{rotulos[campo]}: </strong> : null}
              {texto}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
