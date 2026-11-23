import { useEffect, useId, useRef } from 'react'

export default function ModalFormulario({ titulo, salvando, onCancelar, children }) {
  const tituloId = useId()
  const dialogo = useRef(null)

  useEffect(() => {
    const elemento = dialogo.current
    elemento.showModal()
    return () => elemento.close()
  }, [])

  return (
    <dialog
      ref={dialogo}
      className="ui-modal ui-modal-formulario"
      aria-labelledby={tituloId}
      onCancel={(evento) => {
        evento.preventDefault()
        if (!salvando) onCancelar()
      }}
    >
      <h2 id={tituloId}>{titulo}</h2>
      {children}
    </dialog>
  )
}
