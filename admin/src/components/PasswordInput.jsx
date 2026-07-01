import { useState } from 'react';

export default function PasswordInput({ className = '', ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`password-input-wrap ${className}`.trim()}>
      <input type={visible ? 'text' : 'password'} {...props} />
      <button
        type="button"
        className="password-toggle-btn"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        tabIndex={-1}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
          {visible ? 'visibility_off' : 'visibility'}
        </span>
      </button>
    </div>
  );
}
