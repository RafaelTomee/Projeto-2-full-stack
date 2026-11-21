export default function Vazio({ mensagem = 'Nada por aqui ainda.', acao }) {
  return (
    <div className="ui-vazio">
      <p>{mensagem}</p>
      {acao}
    </div>
  );
}
