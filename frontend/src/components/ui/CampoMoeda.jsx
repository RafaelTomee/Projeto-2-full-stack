import { useId } from 'react';
import { formatarMoeda, textoParaCentavos } from '../../utils/formatacao.js';

// valor é um número em reais. Cada dígito digitado entra como 1 centavo.
export default function CampoMoeda({
  label,
  valor = 0,
  onValorChange,
  nome,
  id,
  required = false,
  disabled = false,
  erro,
}) {
  const gerado = useId();
  const campoId = id ?? gerado;

  return (
    <div className="campo-moeda">
      {label && <label htmlFor={campoId}>{label}</label>}
      <input
        id={campoId}
        name={nome}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={formatarMoeda(valor)}
        onChange={(evento) => onValorChange?.(textoParaCentavos(evento.target.value) / 100)}
        placeholder="R$ 0,00"
        required={required}
        disabled={disabled}
        aria-invalid={erro ? 'true' : undefined}
        aria-describedby={erro ? `${campoId}-erro` : undefined}
      />
      {erro && (
        <p id={`${campoId}-erro`} className="erro-campo">
          {erro}
        </p>
      )}
    </div>
  );
}
