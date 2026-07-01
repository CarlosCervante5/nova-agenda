import UsersSettingsTab from '../components/settings/UsersSettingsTab';

export default function Professionals() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Profesionales</h1>
          <p className="subtitle">Gestiona cuentas, servicios asignados, foto y enlaces de reserva por profesional.</p>
        </div>
      </div>

      <UsersSettingsTab mode="professionals" />
    </div>
  );
}
