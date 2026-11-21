// Campo de formulário reutilizável: rótulo + input + dica + mensagem de erro junto ao campo.
// Recebe, além das props abaixo, qualquer atributo de <input> (type, value, onChange...).
//
//   <CampoForm id="cpf" name="cpf" rotulo="CPF" value={...} onChange={...} erro={erros.cpf} />
export default function CampoForm({ id, rotulo, erro, dica, ...inputProps }) {
  const idErro = `${id}-erro`
  const idDica = `${id}-dica`
  const descricao = erro ? idErro : dica ? idDica : undefined

  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      <input
        id={id}
        aria-invalid={erro ? 'true' : undefined}
        aria-describedby={descricao}
        className={erro ? 'campo-invalido' : undefined}
        {...inputProps}
      />
      {dica && !erro && <p className="campo-dica" id={idDica}>{dica}</p>}
      {erro && <p className="erro-campo" id={idErro} role="alert">{erro}</p>}
    </div>
  )
}
