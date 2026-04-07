import { useMemo, useState } from 'react';

const HELP_CONTACT = {
  salesEmail: 'ventas@milopro.com',
  supportEmail: 'soporte@milopro.com',
  phone: '+54 11 5555 0000',
  whatsapp: 'https://wa.me/5491155550000',
  website: 'https://www.milopro.com'
};

const HELP_MODULES = [
  { id: 'help-center', section: 'guide', label: 'Centro de ayuda', title: 'Guia de uso del sistema', subtitle: 'Documentacion operativa organizada para aprender el sistema y resolver dudas frecuentes con lectura rapida.' },
  { id: 'help-shortcuts', section: 'support', label: 'Atajos', title: 'Soporte tecnico', subtitle: 'Canales de contacto tecnico y acceso directo a informacion util.' }
] as const;

const GUIDE_SECTIONS = [
  { id: 'intro', title: 'Introduccion', content: ['Milo Pro centraliza clientes, articulos, ventas, caja, reportes y administracion en un entorno unico con flujo administrativo clasico.', 'La pantalla inicial muestra accesos directos a los modulos principales y cada area mantiene la misma logica visual: filtros arriba, acciones visibles y tablas de consulta debajo.', 'Para trabajar mas rapido, use el menu lateral para cambiar de modulo y los buscadores internos para encontrar registros sin recorrer listas completas.'] },
  { id: 'customers', title: 'Como crear clientes', content: ['Ingrese al modulo Clientes y utilice el boton de alta para abrir el formulario principal.', 'Complete los datos basicos del cliente, revise telefono, documento, condicion comercial y cualquier referencia operativa que necesite el mostrador.', 'Guarde el registro y luego use el buscador del modulo para ubicarlo rapido cuando necesite facturar, cobrar o consultar cuenta corriente.'] },
  { id: 'products', title: 'Como cargar articulos', content: ['Desde Articulos > Planilla puede crear un articulo nuevo con codigo, descripcion, categoria, proveedor, precios y stock.', 'Mantenga consistencia entre codigo interno, codigo de barras y descripcion para facilitar la consulta posterior en ventas, reportes y herramientas offline.', 'Si administra listas de precios o etiquetas, use las herramientas del mismo modulo para completar la preparacion comercial del articulo.'] },
  { id: 'sales', title: 'Como realizar una venta', content: ['Abra el modulo Ventas y seleccione el tipo de comprobante que necesita emitir.', 'Busque el cliente si corresponde, agregue articulos al comprobante y confirme cantidades, precios, descuentos y medio de pago antes de cerrar la operacion.', 'Al finalizar, el sistema deja disponible la consulta posterior desde los listados de ventas, remitos, presupuestos o pedidos segun el flujo utilizado.'] },
  { id: 'reports', title: 'Como consultar reportes', content: ['En Reportes puede seleccionar el area que desea analizar: articulos, ventas, compras, clientes, remitos, cuentas corrientes, ranking o caja.', 'Aplique filtros por fecha, usuario, proveedor, categoria o cliente segun el tipo de informe y luego use exportacion o impresion cuando necesite compartir el resultado.', 'Los paneles resumen ayudan a interpretar rapido volumen, importes y saldos sin salir del flujo administrativo.'] }
] as const;

function getModuleConfig(pageId: string) {
  return HELP_MODULES.find((module) => module.id === pageId) || HELP_MODULES[0];
}

function normalizeText(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function HelpPage({ pageId }: { pageId: string }) {
  const [search, setSearch] = useState('');
  const [openIds, setOpenIds] = useState<string[]>(GUIDE_SECTIONS.map((section) => section.id));
  const moduleConfig = getModuleConfig(pageId);

  const filteredSections = useMemo(() => {
    const normalized = normalizeText(search);
    if (!normalized) return GUIDE_SECTIONS;
    return GUIDE_SECTIONS.filter((section) => normalizeText(section.title + ' ' + section.content.join(' ')).includes(normalized));
  }, [search]);

  function toggleSection(sectionId: string) {
    setOpenIds((current) => (current.includes(sectionId) ? current.filter((id) => id !== sectionId) : [...current, sectionId]));
  }

  return (
    <div className="help-module-shell">
      <div className="help-module-head">
        <div>
          <p className="help-module-kicker">Ayuda</p>
          <h2>{moduleConfig.title}</h2>
          <p>{moduleConfig.subtitle}</p>
        </div>
      </div>

      <div className="help-section-tabs" role="tablist" aria-label="Ayuda">
        {HELP_MODULES.map((module) => (
          <button
            key={module.id}
            type="button"
            className={`help-tab-button${module.id === pageId ? ' active' : ''}`}
            onClick={() => {
              window.location.hash = module.id;
            }}
          >
            {module.label}
          </button>
        ))}
      </div>

      {moduleConfig.section === 'guide' ? (
        <>
          <div className="card help-filter-card">
            <div className="form-group help-search-group">
              <label>Buscar en la guia</label>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar modulo, tarea o proceso..." />
            </div>
            <div className="help-module-actions">
              <button className="btn btn-secondary" type="button" onClick={() => setOpenIds(GUIDE_SECTIONS.map((section) => section.id))}>Expandir todo</button>
              <button className="btn btn-secondary" type="button" onClick={() => setOpenIds([])}>Contraer</button>
            </div>
          </div>

          <div className="help-accordion-list">
            {filteredSections.length === 0 ? (
              <div className="help-empty-card">
                <strong>Sin resultados</strong>
                <p>No encontramos coincidencias para la busqueda actual dentro de la guia.</p>
              </div>
            ) : (
              filteredSections.map((section) => {
                const isOpen = openIds.includes(section.id);
                return (
                  <article key={section.id} className={`help-accordion-card${isOpen ? ' is-open' : ''}`}>
                    <button className="help-accordion-toggle" type="button" onClick={() => toggleSection(section.id)}>
                      <span>{section.title}</span>
                      <strong>{isOpen ? '−' : '+'}</strong>
                    </button>
                    <div className="help-accordion-body" hidden={!isOpen}>
                      {section.content.map((paragraph) => (
                        <p key={`${section.id}-${paragraph.slice(0, 12)}`}>{paragraph}</p>
                      ))}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </>
      ) : null}

      {moduleConfig.section === 'support' ? (
        <>
          <div className="help-info-grid">
            <article className="help-info-card">
              <span>Email soporte</span>
              <strong>{HELP_CONTACT.supportEmail}</strong>
              <p>Canal principal para incidencias tecnicas y seguimiento operativo.</p>
            </article>
            <article className="help-info-card">
              <span>Telefono</span>
              <strong>{HELP_CONTACT.phone}</strong>
              <p>Contacto rapido para coordinar asistencia y consultas puntuales.</p>
            </article>
            <article className="help-info-card">
              <span>Sitio web</span>
              <strong>{HELP_CONTACT.website}</strong>
              <p>Informacion comercial, novedades y acceso a canales oficiales.</p>
            </article>
          </div>

          <div className="card help-contact-card">
            <div className="help-section-head">
              <h3>Canales rapidos</h3>
              <p>Acceso directo a soporte, ventas y WhatsApp.</p>
            </div>
            <div className="help-contact-grid">
              <a className="help-contact-item" href={`mailto:${HELP_CONTACT.supportEmail}`}>
                <span>Email soporte</span>
                <strong>{HELP_CONTACT.supportEmail}</strong>
              </a>
              <a className="help-contact-item" href={`mailto:${HELP_CONTACT.salesEmail}`}>
                <span>Email ventas</span>
                <strong>{HELP_CONTACT.salesEmail}</strong>
              </a>
              <a className="help-contact-item" href={HELP_CONTACT.whatsapp} target="_blank" rel="noreferrer">
                <span>WhatsApp</span>
                <strong>Ir a WhatsApp</strong>
              </a>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
