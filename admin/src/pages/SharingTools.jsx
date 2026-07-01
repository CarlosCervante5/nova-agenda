import { useState, useEffect } from 'react';
import api from '../api';
import { getFieldTypeLabel } from '../utils/labels';

export default function SharingTools() {
  const [copied, setCopied] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [services, setServices] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);
  const [newQuestion, setNewQuestion] = useState({ label: '', field_type: 'text', required: false, options: [] });
  const [newOption, setNewOption] = useState('');

  const [previewStep, setPreviewStep] = useState(1);
  const [previewService, setPreviewService] = useState(null);
  const [previewDate, setPreviewDate] = useState(null);
  const [previewTime, setPreviewTime] = useState(null);
  const [previewMonth, setPreviewMonth] = useState(new Date());
  const [previewMonthAvail, setPreviewMonthAvail] = useState({});
  const [previewSlots, setPreviewSlots] = useState([]);
  const [previewFormData, setPreviewFormData] = useState({});
  const [previewErrors, setPreviewErrors] = useState({});
  const [downloadingPlugin, setDownloadingPlugin] = useState(false);

  const backendUrl = window.location.origin;
  const bookingBaseUrl = backendUrl + '/booking';
  const bookingUrl = bookingBaseUrl + '/public/';
  const shortcode = '[agendamiento_centro]';
  const shortcodeWithUrl = '[agendamiento_centro url="' + bookingBaseUrl + '"]';
  const calendarShortcode = '[agendamiento_calendario]';
  const calendarShortcodeWithUrl = '[agendamiento_calendario url="' + bookingBaseUrl + '"]';
  const calendarUrl = bookingBaseUrl + '/public/calendar.html';
  const iframeCode = '<iframe src="' + bookingUrl + '" width="100%" height="700" frameborder="0" style="border:none;border-radius:16px;" title="Agendar cita"></iframe>';
  const embedCode = '<div id="centro-holistico-booking"></div>\n<script>window.bookingConfig = { apiBase: \'' + bookingBaseUrl + '\' };</script>\n<script src="' + bookingBaseUrl + '/public/embed.js"></script>';
  const SERVICES_PAGE_SIZE = 6;

  const [servicesPage, setServicesPage] = useState(1);

  useEffect(() => { loadServices(); loadQuestions(); loadProfessionals(); }, []);
  useEffect(() => { if (showPreview) loadPreviewMonth(); }, [previewMonth, showPreview]);
  useEffect(() => { setServicesPage(1); }, [services.length]);

  const servicesTotalPages = Math.max(1, Math.ceil(services.length / SERVICES_PAGE_SIZE));
  const safeServicesPage = Math.min(servicesPage, servicesTotalPages);
  const paginatedServices = services.slice(
    (safeServicesPage - 1) * SERVICES_PAGE_SIZE,
    safeServicesPage * SERVICES_PAGE_SIZE
  );

  const loadServices = async () => { try { const r = await api.get('/public/services'); setServices(r.data); } catch(e) {} };
  const loadQuestions = async () => { try { const r = await api.get('/form-questions'); setQuestions(r.data); } catch(e) {} };
  const loadProfessionals = async () => { try { const r = await api.get('/users/professionals'); setProfessionals((r.data || []).filter(p => p.active)); } catch(e) {} };

  const copyToClipboard = (text, type) => { navigator.clipboard.writeText(text).then(() => { setCopied(type); setTimeout(() => setCopied(null), 2000); }); };

  const downloadWordPressPlugin = async () => {
    setDownloadingPlugin(true);
    try {
      const response = await api.get('/wordpress-plugin/download', { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'tapai-agenda.zip';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert(error.response?.data?.error || 'No se pudo descargar el plugin');
    } finally {
      setDownloadingPlugin(false);
    }
  };

  const handleAddQuestion = async () => {
    if (!newQuestion.label.trim()) return;
    try { await api.post('/form-questions', newQuestion); setNewQuestion({ label: '', field_type: 'text', required: false, options: [] }); setNewOption(''); setShowAddForm(false); loadQuestions(); } catch(e) {}
  };

  const handleUpdateQuestion = async (id, updates) => {
    try { await api.put('/form-questions/' + id, updates); loadQuestions(); } catch(e) {}
  };

  const handleDeleteQuestion = async (id) => {
    if (!confirm('¿Eliminar esta pregunta?')) return;
    try { await api.delete('/form-questions/' + id); loadQuestions(); } catch(e) {}
  };

  const addOption = () => { if (!newOption.trim()) return; setNewQuestion({ ...newQuestion, options: [...newQuestion.options, newOption.trim()] }); setNewOption(''); };
  const removeOption = (i) => setNewQuestion({ ...newQuestion, options: newQuestion.options.filter((_, idx) => idx !== i) });

  const addEditOption = (q) => { if (!newOption.trim()) return; const opts = q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : []; handleUpdateQuestion(q.id, { options: [...opts, newOption.trim()] }); setNewOption(''); };
  const removeEditOption = (q, i) => { const opts = q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : []; handleUpdateQuestion(q.id, { options: opts.filter((_, idx) => idx !== i) }); };

  const handleDragStart = (e, i) => { setDraggedItem(i); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver = (e, i) => { e.preventDefault(); setDragOverItem(i); };
  const handleDrop = async (e, i) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === i) { setDraggedItem(null); setDragOverItem(null); return; }
    const reordered = [...questions]; const [moved] = reordered.splice(draggedItem, 1); reordered.splice(i, 0, moved);
    setQuestions(reordered); setDraggedItem(null); setDragOverItem(null);
    try { await api.post('/form-questions/reorder', { orderedIds: reordered.map(q => q.id) }); } catch(e) {}
  };

  const getFieldTypeIcon = (t) => ({ text: 'text_fields', email: 'email', phone: 'phone', textarea: 'notes', select: 'arrow_drop_down_circle', number: 'tag', date: 'calendar_today' }[t] || 'text_fields');

  const loadPreviewMonth = async () => { try { const y = previewMonth.getFullYear(); const m = previewMonth.getMonth() + 1; const r = await api.get('/public/availability-month/' + y + '/' + m); setPreviewMonthAvail(r.data.days || r.data); } catch(e) {} };

  const loadPreviewSlots = async (date) => {
    if (!previewService) return;
    try { const r = await api.post('/public/availability', { date, service_id: previewService.id }); setPreviewSlots(r.data.slots || []); } catch(e) { setPreviewSlots([]); }
  };

  const previewSelectService = (s) => { setPreviewService(s); setPreviewStep(2); loadPreviewMonth(); };
  const previewSelectDate = (d) => { setPreviewDate(d); setPreviewTime(null); loadPreviewSlots(d); };
  const previewSelectTime = (t) => setPreviewTime(t);

  const previewFormChange = (qid, val) => { setPreviewFormData({ ...previewFormData, [qid]: val }); if (previewErrors[qid]) setPreviewErrors({ ...previewErrors, [qid]: null }); };

  const previewSubmit = () => {
    const errs = {}; questions.forEach(q => { if (q.required && !previewFormData[q.id]) errs[q.id] = 'Obligatorio'; });
    if (Object.keys(errs).length > 0) { setPreviewErrors(errs); return; }
    setPreviewStep(4);
  };

  const resetPreview = () => { setPreviewStep(1); setPreviewService(null); setPreviewDate(null); setPreviewTime(null); setPreviewFormData({}); setPreviewErrors({}); setPreviewSlots([]); };
  const formatDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const renderInput = (q) => {
    const val = previewFormData[q.id] || '';
    const style = { width: '100%', padding: '12px', border: '1px solid ' + (previewErrors[q.id] ? 'var(--error)' : 'var(--outline-variant)'), borderRadius: '0.75rem', fontSize: '14px', background: '#fff' };
    switch (q.field_type) {
      case 'text': return <input type="text" value={val} onChange={e => previewFormChange(q.id, e.target.value)} placeholder={q.label} style={style} />;
      case 'email': return <input type="email" value={val} onChange={e => previewFormChange(q.id, e.target.value)} placeholder={q.label} style={style} />;
      case 'phone': return <input type="tel" value={val} onChange={e => previewFormChange(q.id, e.target.value)} placeholder={q.label} style={style} />;
      case 'number': return <input type="number" value={val} onChange={e => previewFormChange(q.id, e.target.value)} placeholder={q.label} style={style} />;
      case 'date': return <input type="date" value={val} onChange={e => previewFormChange(q.id, e.target.value)} style={style} />;
      case 'textarea': return <textarea value={val} onChange={e => previewFormChange(q.id, e.target.value)} placeholder={q.label} rows={3} style={{ ...style, resize: 'vertical' }} />;
      case 'select': {
        const opts = q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : [];
        return <select value={val} onChange={e => previewFormChange(q.id, e.target.value)} style={style}><option value="">Seleccionar...</option>{opts.map((o, i) => <option key={i} value={o}>{o}</option>)}</select>;
      }
      default: return <input type="text" value={val} onChange={e => previewFormChange(q.id, e.target.value)} placeholder={q.label} style={style} />;
    }
  };

  const getInputs = () => {
    const inputs = [];
    const addQ = { label: '', field_type: 'text', required: false, options: [] };

    return (
      <div className="sharing-page">
        <div className="page-header">
          <div>
            <h1>Compartir y herramientas</h1>
            <p className="subtitle" style={{ marginTop: '8px' }}>Gestiona cómo los clientes encuentran y reservan citas.</p>
          </div>
        </div>

        <div className="sharing-grid">
          <div>
            <div className="sharing-card">
              <div className="sharing-card-header">
                <div className="icon"><span className="material-symbols-outlined">link</span></div>
                <h3>Enlace público de reservas</h3>
              </div>
              <p>Comparte este enlace con tus clientes.</p>
              <div className="url-input-group">
                <input type="text" className="url-input" value={bookingUrl} readOnly />
                <button className="copy-btn" onClick={() => copyToClipboard(bookingUrl, 'link')} style={{ background: copied === 'link' ? 'var(--primary-fixed)' : undefined }}>
                  <span className="material-symbols-outlined">{copied === 'link' ? 'check' : 'content_copy'}</span>
                </button>
                <button className="qr-btn" onClick={() => setShowQR(true)}>
                  <span className="material-symbols-outlined">qr_code_2</span>
                </button>
              </div>
              <div className="social-share-row">
                <button className="social-btn" onClick={() => window.open('https://wa.me/?text=' + encodeURIComponent('Reserva en Tapai: ' + bookingUrl), '_blank')}>
                  <span className="material-symbols-outlined">send</span> WhatsApp
                </button>
                <button className="social-btn" onClick={() => window.open('https://www.instagram.com/', '_blank')}>
                  <span className="material-symbols-outlined">alternate_email</span> Instagram
                </button>
                <button className="social-btn" onClick={() => window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(bookingUrl), '_blank')}>
                  <span className="material-symbols-outlined">tag</span> Facebook
                </button>
                <button className="social-btn" onClick={() => window.open('mailto:?subject=' + encodeURIComponent('Reserva en Tapai') + '&body=' + encodeURIComponent('Reserva aquí: ' + bookingUrl))}>
                  <span className="material-symbols-outlined">email</span> Correo
                </button>
              </div>
            </div>

            <div className="sharing-card">
              <div className="sharing-card-header">
                <div className="icon"><span className="material-symbols-outlined">extension</span></div>
                <h3>Plugin WordPress (recomendado)</h3>
              </div>
              <p>Instala el plugin de WordPress listo para subir. Después actívalo y configura la URL en Ajustes → Tapai Agenda.</p>
              <ol style={{ margin: '12px 0 16px 20px', fontSize: '14px', color: 'var(--on-surface-variant)', lineHeight: 1.6 }}>
                <li>Descarga el ZIP con el botón de abajo</li>
                <li>WordPress → Plugins → Añadir nuevo → Subir plugin</li>
                <li>URL del sistema: <strong>{bookingBaseUrl}</strong></li>
                <li>Usa el shortcode en cualquier página</li>
              </ol>
              <button
                type="button"
                className="download-btn"
                onClick={downloadWordPressPlugin}
                disabled={downloadingPlugin}
                style={{ marginBottom: '16px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  {downloadingPlugin ? 'hourglass_top' : 'download'}
                </span>
                {downloadingPlugin ? 'Preparando descarga...' : 'Descargar plugin WordPress (.zip)'}
              </button>
              <div className="code-block">
                <code>{shortcode}</code>
                <button className="code-copy-btn" onClick={() => copyToClipboard(shortcode, 'sc')}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{copied === 'sc' ? 'check' : 'content_copy'}</span>
                </button>
              </div>
              <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--on-surface-variant)' }}>
                Con URL explícita: <code style={{ fontSize: '12px' }}>{shortcodeWithUrl}</code>
              </p>

              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--outline-variant)' }}>
                <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Calendario de fechas disponibles</p>
                <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', marginBottom: '12px' }}>
                  Muestra solo el calendario público con los días disponibles, ideal para una página informativa.
                </p>
                <div className="code-block">
                  <code>{calendarShortcode}</code>
                  <button className="code-copy-btn" onClick={() => copyToClipboard(calendarShortcode, 'sc-cal')}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{copied === 'sc-cal' ? 'check' : 'content_copy'}</span>
                  </button>
                </div>
                <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--on-surface-variant)' }}>
                  Con URL explícita: <code style={{ fontSize: '12px' }}>{calendarShortcodeWithUrl}</code>
                </p>
                <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--on-surface-variant)' }}>
                  Vista directa: <a href={calendarUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>{calendarUrl}</a>
                </p>
              </div>
            </div>

            <div className="sharing-card">
              <div className="sharing-card-header">
                <div className="icon"><span className="material-symbols-outlined">html</span></div>
                <h3>Código para insertar</h3>
              </div>
              <div className="code-block">
                <code>{embedCode}</code>
                <button className="code-copy-btn" onClick={() => copyToClipboard(embedCode, 'emb')}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{copied === 'emb' ? 'check' : 'content_copy'}</span>
                </button>
              </div>
            </div>
          </div>

          <div>
            <div className="sharing-card">
              <div className="sharing-card-header" style={{ justifyContent: 'space-between', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="icon"><span className="material-symbols-outlined">assignment</span></div>
                  <h3>Formulario público</h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button onClick={() => setShowPreview(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '2rem', border: '1px solid var(--primary)', background: 'transparent', color: 'var(--primary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>play_arrow</span> Vista previa
                  </button>
                  <button className="add-question-btn" style={{ margin: 0, padding: '8px 14px', fontSize: '12px' }} onClick={() => { setShowAddForm(!showAddForm); setEditingQuestion(null); }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{showAddForm ? 'close' : 'add'}</span> {showAddForm ? 'Cancelar' : 'Agregar'}
                  </button>
                </div>
              </div>
              <p>Personaliza las preguntas que responden los clientes al reservar.</p>

              {showAddForm && (
                <div style={{ background: 'var(--surface-container-low)', borderRadius: '0.75rem', padding: '20px', marginBottom: '16px', border: '1px dashed var(--primary)' }}>
                  <h4 style={{ marginBottom: '16px', fontSize: '14px', fontWeight: 600 }}>Nueva pregunta</h4>
                  <div className="form-group">
                    <label>Texto de la pregunta</label>
                    <input type="text" value={newQuestion.label} onChange={e => setNewQuestion({ ...newQuestion, label: e.target.value })} placeholder="Ej. Contacto de emergencia" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label>Tipo de campo</label>
                      <select value={newQuestion.field_type} onChange={e => setNewQuestion({ ...newQuestion, field_type: e.target.value })}>
                        <option value="text">Texto corto</option>
                        <option value="email">Correo</option>
                        <option value="phone">Teléfono</option>
                        <option value="textarea">Texto largo</option>
                        <option value="select">Lista desplegable</option>
                        <option value="number">Número</option>
                        <option value="date">Fecha</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Obligatorio</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                        <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
                          <input type="checkbox" checked={newQuestion.required} onChange={e => setNewQuestion({ ...newQuestion, required: e.target.checked })} style={{ opacity: 0, width: 0, height: 0 }} />
                          <span style={{ position: 'absolute', inset: 0, borderRadius: '12px', background: newQuestion.required ? 'var(--primary)' : 'var(--outline-variant)', cursor: 'pointer', transition: '0.3s' }}>
                            <span style={{ position: 'absolute', width: '18px', height: '18px', left: newQuestion.required ? '23px' : '3px', bottom: '3px', borderRadius: '50%', background: '#fff', transition: '0.3s' }} />
                          </span>
                        </label>
                        <span style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>{newQuestion.required ? 'Obligatorio' : 'Opcional'}</span>
                      </div>
                    </div>
                  </div>
                  {newQuestion.field_type === 'select' && (
                    <div className="form-group">
                      <label>Opciones</label>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <input type="text" value={newOption} onChange={e => setNewOption(e.target.value)} placeholder="Agregar opción..." onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addOption())} style={{ flex: 1 }} />
                        <button type="button" onClick={addOption} style={{ padding: '8px 16px', borderRadius: '0.5rem', border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>Agregar</button>
                      </div>
                      {newQuestion.options.map((opt, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#fff', borderRadius: '0.5rem', marginBottom: '4px' }}>
                          <span style={{ fontSize: '13px' }}>{opt}</span>
                          <button onClick={() => removeOption(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button className="btn btn-primary" onClick={handleAddQuestion} disabled={!newQuestion.label.trim()} style={{ marginTop: '8px' }}>Agregar pregunta</button>
                </div>
              )}

              <div className="form-questions">
                {questions.map((q, index) => {
                  const isEditing = editingQuestion === q.id;
                  const isDragging = draggedItem === index;
                  const isDragOver = dragOverItem === index;
                  const opts = q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : [];
                  return (
                    <div key={q.id} className={'question-item' + (isDragging ? ' dragging' : '') + (isDragOver ? ' drag-over' : '')} draggable onDragStart={e => handleDragStart(e, index)} onDragOver={e => handleDragOver(e, index)} onDrop={e => handleDrop(e, index)} onDragEnd={() => { setDraggedItem(null); setDragOverItem(null); }} style={{ opacity: isDragging ? 0.5 : 1, borderLeft: isDragOver ? '3px solid var(--primary)' : '3px solid transparent', transition: 'all 0.2s' }}>
                      <div className="question-left">
                        <span className="material-symbols-outlined drag-handle" style={{ cursor: 'grab', color: 'var(--outline)' }}>drag_indicator</span>
                        <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '20px' }}>{getFieldTypeIcon(q.field_type)}</span>
                        <div className="question-info">
                          {isEditing ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <input type="text" defaultValue={q.label} onBlur={e => handleUpdateQuestion(q.id, { label: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleUpdateQuestion(q.id, { label: e.target.value })} autoFocus style={{ padding: '6px 10px', border: '1px solid var(--outline-variant)', borderRadius: '0.5rem', fontSize: '14px', fontWeight: 600, width: '100%' }} />
                              <select defaultValue={q.field_type} onChange={e => handleUpdateQuestion(q.id, { field_type: e.target.value })} style={{ padding: '4px 8px', borderRadius: '0.5rem', border: '1px solid var(--outline-variant)', fontSize: '12px' }}>
                                <option value="text">Texto corto</option>
                                <option value="email">Correo</option>
                                <option value="phone">Teléfono</option>
                                <option value="textarea">Texto largo</option>
                                <option value="select">Lista desplegable</option>
                                <option value="number">Número</option>
                                <option value="date">Fecha</option>
                              </select>
                              <button onClick={() => { setEditingQuestion(null); setNewOption(''); }} style={{ alignSelf: 'flex-start', padding: '4px 12px', fontSize: '12px', fontWeight: 600, border: 'none', borderRadius: '0.5rem', background: 'var(--primary)', color: '#fff', cursor: 'pointer', marginTop: '4px' }}>Listo</button>
                            </div>
                          ) : (
                            <>
                              <h4>{q.label}</h4>
                              <p>{getFieldTypeLabel(q.field_type)} {q.required ? '• Obligatorio' : '• Opcional'}</p>
                            </>
                          )}
                        </div>
                      </div>
                      {!isEditing && (
                        <div className="question-actions" style={{ opacity: 1, display: 'flex', gap: '2px' }}>
                          <button title="Editar" onClick={() => { setEditingQuestion(q.id); setNewOption(''); }}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span></button>
                          <button title={q.required ? 'Hacer opcional' : 'Hacer obligatorio'} onClick={() => handleUpdateQuestion(q.id, { required: !q.required })}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{q.required ? 'toggle_on' : 'toggle_off'}</span></button>
                          <button className="delete" title="Eliminar" onClick={() => handleDeleteQuestion(q.id)}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span></button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="sharing-card">
              <div className="sharing-card-header">
                <div className="icon"><span className="material-symbols-outlined">badge</span></div>
                <h3>Enlaces por profesional</h3>
              </div>
              <p style={{ marginBottom: '16px' }}>
                Cada profesional puede compartir su enlace personalizado. El booking mostrará su foto, presentación y solo sus servicios asignados.
              </p>
              {professionals.length === 0 ? (
                <p style={{ color: 'var(--on-surface-variant)', fontSize: '14px' }}>
                  Crea profesionales activos en Configuración → Usuarios para generar enlaces.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {professionals.map(professional => (
                    <div key={professional.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 16px', background: 'var(--surface-container-low)', borderRadius: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        {professional.profile_photo_url ? (
                          <img src={professional.profile_photo_url} alt={professional.full_name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-fixed)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, flexShrink: 0 }}>
                            {(professional.full_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '14px' }}>{professional.full_name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', wordBreak: 'break-all' }}>
                            {professional.booking_url || `${bookingUrl}?professional=${professional.id}`}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => copyToClipboard(professional.booking_url || `${bookingUrl}?professional=${professional.id}`, `pro-${professional.id}`)}
                        style={{ padding: '8px 12px', fontSize: '12px', flexShrink: 0 }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                          {copied === `pro-${professional.id}` ? 'check' : 'content_copy'}
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="sharing-card">
              <div className="sharing-card-header" style={{ justifyContent: 'space-between', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="icon"><span className="material-symbols-outlined">spa</span></div>
                  <h3>Servicios disponibles</h3>
                </div>
                {services.length > 0 && (
                  <span style={{ fontSize: '12px', color: 'var(--on-surface-variant)' }}>
                    {services.length} en total
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {paginatedServices.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--surface-container-low)', borderRadius: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '0.5rem', background: s.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span className="material-symbols-outlined" style={{ color: s.color, fontSize: '20px' }}>spa</span>
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{s.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)' }}>{s.duration_minutes} min • ${s.price}</div>
                      </div>
                    </div>
                    <span className="active-badge" style={{ fontSize: '10px', padding: '4px 10px' }}>Activo</span>
                  </div>
                ))}
                {services.length === 0 && (
                  <p style={{ color: 'var(--on-surface-variant)', fontSize: '14px', textAlign: 'center', padding: '16px 0' }}>
                    No hay servicios activos en el booking público.
                  </p>
                )}
              </div>
              {services.length > SERVICES_PAGE_SIZE && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setServicesPage(p => Math.max(1, p - 1))}
                    disabled={safeServicesPage <= 1}
                    style={{ padding: '6px 10px', fontSize: '12px' }}
                  >
                    Anterior
                  </button>
                  <span style={{ fontSize: '12px', color: 'var(--on-surface-variant)' }}>
                    {safeServicesPage} / {servicesTotalPages}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setServicesPage(p => Math.min(servicesTotalPages, p + 1))}
                    disabled={safeServicesPage >= servicesTotalPages}
                    style={{ padding: '6px 10px', fontSize: '12px' }}
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {showQR && (
          <div className="qr-modal open">
            <div className="qr-modal-backdrop" onClick={() => setShowQR(false)} />
            <div className="qr-modal-content">
              <div className="qr-modal-header">
                <h4>Código QR de reservas</h4>
                <button className="close-btn" onClick={() => setShowQR(false)}><span className="material-symbols-outlined">close</span></button>
              </div>
              <div className="qr-code-container">
                <svg width="200" height="200" viewBox="0 0 200 200">
                  <rect width="200" height="200" fill="#fff" />
                  <text x="100" y="100" textAnchor="middle" dominantBaseline="middle" fill="#7d7f3e" fontSize="14" fontWeight="bold">SB</text>
                </svg>
              </div>
              <p className="qr-modal-text">Imprime este código para recepción.</p>
              <button className="download-btn" onClick={() => copyToClipboard(bookingUrl, 'qr')}>Copiar enlace de reservas</button>
            </div>
          </div>
        )}

        {showPreview && (
          <div className="preview-modal-overlay" onClick={() => { setShowPreview(false); resetPreview(); }}>
            <div className="preview-modal" onClick={e => e.stopPropagation()}>
              <div className="preview-modal-header">
                <h3>Vista previa del formulario</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)', padding: '4px 10px', background: 'var(--surface-container)', borderRadius: '1rem' }}>Paso {previewStep} de 4</span>
                  <button onClick={() => { setShowPreview(false); resetPreview(); }} style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-surface-variant)' }}>
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
              </div>

              <div className="preview-modal-body">
                {previewStep === 1 && (
                  <div>
                    <div className="preview-step-header">
                      <span className="preview-step-num">1</span>
                      <span>Selecciona un servicio</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {services.map(s => (
                        <div key={s.id} className="preview-service-card" onClick={() => previewSelectService(s)} style={{ padding: '14px', borderRadius: '0.75rem', border: '2px solid var(--outline-variant)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>{s.name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)' }}>{s.duration_minutes} min</div>
                          </div>
                          <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '16px' }}>${s.price}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {previewStep === 2 && (
                  <div>
                    <div className="preview-step-header">
                      <span className="preview-step-num">2</span>
                      <span>Selecciona fecha y hora</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '8px 12px', background: 'var(--primary)', color: '#fff', borderRadius: '0.75rem' }}>
                      <button onClick={() => { const m = new Date(previewMonth); m.setMonth(m.getMonth() - 1); setPreviewMonth(m); }} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer' }}>&lt;</button>
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>{previewMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span>
                      <button onClick={() => { const m = new Date(previewMonth); m.setMonth(m.getMonth() + 1); setPreviewMonth(m); }} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer' }}>&gt;</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center', marginBottom: '8px' }}>
                      {['D','L','M','X','J','V','S'].map(d => <div key={d} style={{ fontSize: '10px', fontWeight: 600, color: 'var(--on-surface-variant)', padding: '4px' }}>{d}</div>)}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                      {(() => {
                        const cells = [];
                        const first = new Date(previewMonth.getFullYear(), previewMonth.getMonth(), 1);
                        const last = new Date(previewMonth.getFullYear(), previewMonth.getMonth() + 1, 0);
                        for (let i = 0; i < first.getDay(); i++) cells.push(<div key={'e' + i} style={{ padding: '8px' }} />);
                        for (let day = 1; day <= last.getDate(); day++) {
                          const date = new Date(previewMonth.getFullYear(), previewMonth.getMonth(), day);
                          const ds = date.toISOString().split('T')[0];
                          const info = previewMonthAvail[ds];
                          const avail = info && info.available;
                          const sel = previewDate === ds;
                          const td = date.toDateString() === new Date().toDateString();
                          let bg = 'transparent'; let clr = 'var(--on-surface)'; let cur = 'default'; let op = 1; let td2 = false;
                          if (!info || info.isPast) { clr = 'var(--outline-variant)'; op = 0.5; }
                          else if (!avail) { clr = 'var(--outline-variant)'; op = 0.5; }
                          else { cur = 'pointer'; }
                          if (sel) { bg = 'var(--primary)'; clr = '#fff'; cur = 'pointer'; }
                          else if (td) { bg = 'var(--primary-fixed)'; td2 = true; }
                          cells.push(
                            <div key={day} onClick={() => avail ? previewSelectDate(ds) : null} style={{ padding: '8px', borderRadius: '50%', cursor: cur, fontSize: '12px', fontWeight: td2 ? 700 : 400, background: bg, color: clr, opacity: op, transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '32px' }}>
                              {day}
                            </div>
                          );
                        }
                        return cells;
                      })()}
                    </div>
                    {previewDate && (
                      <div style={{ marginTop: '16px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--on-surface-variant)', marginBottom: '8px' }}>Horarios disponibles</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                          {previewSlots.map(slot => (
                            <div key={slot.time} onClick={() => slot.available ? previewSelectTime(slot.time) : null} style={{ padding: '10px', textAlign: 'center', borderRadius: '0.5rem', border: '1px solid ' + (slot.available ? previewTime === slot.time ? 'var(--primary)' : 'var(--outline-variant)' : 'var(--surface-container)'), background: previewTime === slot.time ? 'var(--primary)' : slot.available ? 'transparent' : 'var(--surface-container-low)', color: previewTime === slot.time ? '#fff' : slot.available ? 'var(--on-surface)' : 'var(--outline)', cursor: slot.available ? 'pointer' : 'not-allowed', fontSize: '13px', transition: 'all 0.2s' }}>
                              {slot.time}
                            </div>
                          ))}
                          {previewSlots.length === 0 && <p style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--on-surface-variant)', fontSize: '13px', padding: '20px' }}>No hay horarios disponibles</p>}
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                      <button onClick={() => { setPreviewStep(1); setPreviewDate(null); setPreviewTime(null); }} style={{ flex: 1, padding: '12px', borderRadius: '0.75rem', border: '1px solid var(--outline)', background: 'transparent', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Atrás</button>
                      <button onClick={() => setPreviewStep(3)} disabled={!previewTime} style={{ flex: 1, padding: '12px', borderRadius: '0.75rem', border: 'none', background: previewTime ? 'var(--primary)' : 'var(--outline-variant)', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: previewTime ? 'pointer' : 'not-allowed' }}>Continuar</button>
                    </div>
                  </div>
                )}

                {previewStep === 3 && (
                  <div>
                    <div className="preview-step-header">
                      <span className="preview-step-num">3</span>
                      <span>Tus datos</span>
                    </div>
                    <div style={{ background: 'var(--surface-container-low)', borderRadius: '0.75rem', padding: '14px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}><span style={{ color: 'var(--on-surface-variant)' }}>Servicio</span><span style={{ fontWeight: 600 }}>{previewService?.name}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}><span style={{ color: 'var(--on-surface-variant)' }}>Fecha</span><span style={{ fontWeight: 600 }}>{previewDate && formatDate(previewDate)}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}><span style={{ color: 'var(--on-surface-variant)' }}>Hora</span><span style={{ fontWeight: 600 }}>{previewTime}</span></div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {questions.map(q => (
                        <div key={q.id}>
                          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--on-surface-variant)' }}>
                            {q.label} {q.required && <span style={{ color: 'var(--error)' }}>*</span>}
                          </label>
                          {renderInput(q)}
                          {previewErrors[q.id] && <span style={{ color: 'var(--error)', fontSize: '12px', marginTop: '4px', display: 'block' }}>{previewErrors[q.id]}</span>}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                      <button onClick={() => setPreviewStep(2)} style={{ flex: 1, padding: '12px', borderRadius: '0.75rem', border: '1px solid var(--outline)', background: 'transparent', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Atrás</button>
                      <button onClick={previewSubmit} style={{ flex: 1, padding: '12px', borderRadius: '0.75rem', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Confirmar reserva</button>
                    </div>
                  </div>
                )}

                {previewStep === 4 && (
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--primary-fixed)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--primary)' }}>check_circle</span>
                    </div>
                    <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '24px', marginBottom: '8px' }}>¡Reserva simulada!</h3>
                    <p style={{ color: 'var(--on-surface-variant)', fontSize: '14px', marginBottom: '24px' }}>Esta es una vista previa — no se creó ninguna cita real.</p>
                    <div style={{ background: 'var(--surface-container-low)', borderRadius: '0.75rem', padding: '16px', textAlign: 'left', marginBottom: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}><span style={{ color: 'var(--on-surface-variant)' }}>Servicio</span><span style={{ fontWeight: 600 }}>{previewService?.name}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}><span style={{ color: 'var(--on-surface-variant)' }}>Fecha</span><span style={{ fontWeight: 600 }}>{previewDate && formatDate(previewDate)}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}><span style={{ color: 'var(--on-surface-variant)' }}>Hora</span><span style={{ fontWeight: 600 }}>{previewTime}</span></div>
                    </div>
                    <button onClick={resetPreview} style={{ padding: '12px 24px', borderRadius: '0.75rem', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Probar de nuevo</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return getInputs();
}
