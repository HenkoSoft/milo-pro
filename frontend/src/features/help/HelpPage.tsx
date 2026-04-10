import { useMemo, useState } from 'react';

const HELP_CONTACT = {
  salesEmail: 'ventas@milopro.com',
  supportEmail: 'soporte@milopro.com',
  phone: '+54 11 5555 0000',
  whatsapp: 'https://wa.me/5491155550000',
  website: 'https://www.milopro.com'
};

const HELP_SECTIONS = [
  { id: 'guide', route: 'help', label: 'Guia de uso', description: 'Documentacion del sistema con busqueda y lectura rapida.' },
  { id: 'buy', route: 'help-buy', label: 'Como comprar', description: 'Planes, medios de pago y activacion comercial.' },
  { id: 'support', route: 'help-support', label: 'Ir a soporte', description: 'Canales de contacto tecnico y formulario de consulta.' }
] as const;

const HELP_GUIDE_SECTIONS = [
  {
    id: 'intro',
    title: 'Introduccion',
    content: [
      'Milo Pro centraliza clientes, articulos, ventas, caja, reportes y administracion en un entorno unico con flujo administrativo clasico.',
      'La pantalla inicial muestra accesos directos a los modulos principales y cada area mantiene la misma logica visual: filtros arriba, acciones visibles y tablas de consulta debajo.',
      'Para trabajar mas rapido, use el menu lateral para cambiar de modulo y los buscadores internos para encontrar registros sin recorrer listas completas.'
    ]
  },
  {
    id: 'customers',
    title: 'Como crear clientes',
    content: [
      'Ingrese al modulo Clientes y utilice el boton de alta para abrir el formulario principal.',
      'Complete los datos basicos del cliente, revise telefono, documento, condicion comercial y cualquier referencia operativa que necesite el mostrador.',
      'Guarde el registro y luego use el buscador del modulo para ubicarlo rapido cuando necesite facturar, cobrar o consultar cuenta corriente.'
    ]
  },
  {
    id: 'products',
    title: 'Como cargar articulos',
    content: [
      'Desde Articulos > Planilla puede crear un articulo nuevo con codigo, descripcion, categoria, proveedor, precios y stock.',
      'Mantenga consistencia entre codigo interno, codigo de barras y descripcion para facilitar la consulta posterior en ventas, reportes y herramientas offline.',
      'Si administra listas de precios o etiquetas, use las herramientas del mismo modulo para completar la preparacion comercial del articulo.'
    ]
  },
  {
    id: 'sales',
    title: 'Como realizar una venta',
    content: [
      'Abra el modulo Ventas y seleccione el tipo de comprobante que necesita emitir.',
      'Busque el cliente si corresponde, agregue articulos al comprobante y confirme cantidades, precios, descuentos y medio de pago antes de cerrar la operacion.',
      'Al finalizar, el sistema deja disponible la consulta posterior desde los listados de ventas, remitos, presupuestos o pedidos segun el flujo utilizado.'
    ]
  },
  {
    id: 'stock',
    title: 'Como gestionar stock',
    content: [
      'El control operativo de stock se reparte entre la planilla de articulos, el ajuste de stock, las salidas de mercaderia y los reportes de inventario.',
      'Use ajustes solo cuando necesite corregir diferencias, y reserve las salidas para registrar movimientos concretos fuera del circuito de ventas.',
      'Revise periodicamente el stock critico y las consultas de salidas para detectar faltantes, desfasajes o articulos con alta rotacion.'
    ]
  },
  {
    id: 'reports',
    title: 'Como consultar reportes',
    content: [
      'En Reportes puede seleccionar el area que desea analizar: articulos, ventas, compras, clientes, remitos, cuentas corrientes, ranking o caja.',
      'Aplique filtros por fecha, usuario, proveedor, categoria o cliente segun el tipo de informe y luego use exportacion o impresion cuando necesite compartir el resultado.',
      'Los paneles resumen ayudan a interpretar rapido volumen, importes y saldos sin salir del flujo administrativo.'
    ]
  },
  {
    id: 'users',
    title: 'Como administrar usuarios',
    content: [
      'Los perfiles y accesos se gestionan desde Administracion, siempre con permisos de administrador.',
      'Desde ese modulo puede crear usuarios, revisar conexiones activas, configurar tablas auxiliares y ajustar datos generales del sistema.',
      'Antes de modificar roles o desactivar usuarios, conviene revisar el impacto operativo para no interrumpir cajas, ventas o tareas de soporte.'
    ]
  }
] as const;

type HelpSectionId = typeof HELP_SECTIONS[number]['id'];

function normalizeText(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getActiveSection(pageId: string): HelpSectionId {
  if (pageId === 'help-buy') return 'buy';
  if (pageId === 'help-support' || pageId === 'help-shortcuts') return 'support';
  return 'guide';
}

function HelpModuleHead({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) {
  return (
    <div className="help-module-head">
      <div>
        <p className="help-module-kicker">Ayuda</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}

function HelpGuideSection() {
  const [search, setSearch] = useState('');
  const [openIds, setOpenIds] = useState<string[]>(HELP_GUIDE_SECTIONS.map((section) => section.id));

  const sections = useMemo(() => {
    const normalized = normalizeText(search);
    if (!normalized) return HELP_GUIDE_SECTIONS;
    return HELP_GUIDE_SECTIONS.filter((section) => normalizeText(`${section.title} ${section.content.join(' ')}`).includes(normalized));
  }, [search]);

  function toggleSection(sectionId: string) {
    setOpenIds((current) => (current.includes(sectionId) ? current.filter((id) => id !== sectionId) : [...current, sectionId]));
  }

  function downloadHelpGuidePdf() {
    const guideHtml = HELP_GUIDE_SECTIONS.map((section) => `
      <section style="margin-bottom:24px;">
        <h2 style="font-family:Segoe UI, sans-serif;font-size:20px;margin:0 0 12px;">${section.title}</h2>
        ${section.content.map((paragraph) => `<p style="font-family:Segoe UI, sans-serif;font-size:14px;line-height:1.6;margin:0 0 10px;">${paragraph}</p>`).join('')}
      </section>
    `).join('');
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Guia de uso del sistema</title>
      </head>
      <body style="padding:32px;background:#ffffff;color:#1e293b;">
        <h1 style="font-family:Segoe UI, sans-serif;font-size:28px;margin:0 0 20px;">Guia de uso del sistema</h1>
        ${guideHtml}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <>
      <HelpModuleHead title="Guia de uso del sistema" description="Documentacion operativa organizada para aprender el sistema y resolver dudas frecuentes con lectura rapida.">
        <div className="help-module-actions">
          <button className="btn btn-secondary" type="button" onClick={() => setOpenIds(HELP_GUIDE_SECTIONS.map((section) => section.id))}>Expandir todo</button>
          <button className="btn btn-secondary" type="button" onClick={() => setOpenIds([])}>Contraer</button>
          <button className="btn btn-primary" type="button" onClick={downloadHelpGuidePdf}>Descargar PDF</button>
        </div>
      </HelpModuleHead>

      <div className="help-filter-card">
        <div className="form-group help-search-group">
          <label>Buscar en la guia</label>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar modulo, tarea o proceso..." />
        </div>
      </div>

      <div className="help-accordion-list">
        {sections.length === 0 ? (
          <div className="help-empty-card">
            <strong>Sin resultados</strong>
            <p>No encontramos coincidencias para la busqueda actual dentro de la guia.</p>
          </div>
        ) : sections.map((section) => {
          const isOpen = openIds.includes(section.id);
          return (
            <article key={section.id} className={`help-accordion-card ${isOpen ? 'is-open' : ''}`}>
              <button className="help-accordion-toggle" type="button" onClick={() => toggleSection(section.id)}>
                <span>{section.title}</span>
                <strong>{isOpen ? '-' : '+'}</strong>
              </button>
              <div className="help-accordion-body" hidden={!isOpen}>
                {section.content.map((paragraph) => <p key={`${section.id}-${paragraph.slice(0, 12)}`}>{paragraph}</p>)}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function HelpBuySection() {
  return (
    <>
      <HelpModuleHead title="Como adquirir el sistema" description="Informacion comercial clara para evaluar planes, medios de pago y pasos de activacion." />

      <div className="help-info-grid">
        <article className="help-info-card">
          <span>Planes disponibles</span>
          <strong>Inicial, Profesional y Multiusuario</strong>
          <p>Alternativas pensadas para comercios chicos, operaciones con mas volumen y equipos con multiples puestos de trabajo.</p>
        </article>
        <article className="help-info-card">
          <span>Formas de pago</span>
          <strong>Transferencia, tarjeta y suscripcion</strong>
          <p>Puede abonar por medios bancarios o digitales segun la modalidad comercial contratada.</p>
        </article>
        <article className="help-info-card">
          <span>Activacion</span>
          <strong>Alta guiada y puesta en marcha</strong>
          <p>Una vez confirmada la compra se habilita el sistema y se coordina la configuracion inicial.</p>
        </article>
      </div>

      <div className="help-rich-card">
        <div className="help-section-head">
          <h3>Proceso de compra</h3>
        </div>
        <div className="help-step-list">
          <div className="help-step-item"><strong>1.</strong><span>Seleccione el plan que mejor se adapta a la cantidad de usuarios y al nivel de operacion de su negocio.</span></div>
          <div className="help-step-item"><strong>2.</strong><span>Coordine la forma de pago y comparta los datos necesarios para preparar la activacion.</span></div>
          <div className="help-step-item"><strong>3.</strong><span>Reciba la confirmacion comercial, las credenciales iniciales y la asistencia de puesta en marcha.</span></div>
          <div className="help-step-item"><strong>4.</strong><span>Revise renovaciones, soporte y ampliaciones futuras segun el crecimiento de la operacion.</span></div>
        </div>
      </div>

      <div className="help-contact-card">
        <div className="help-section-head">
          <h3>Contacto comercial</h3>
          <p>Canales directos para consultas de ventas, activacion y renovaciones.</p>
        </div>
        <div className="help-contact-grid">
          <a className="help-contact-item" href={`mailto:${HELP_CONTACT.salesEmail}`}>
            <span>Email ventas</span>
            <strong>{HELP_CONTACT.salesEmail}</strong>
          </a>
          <a className="help-contact-item" href={`tel:${HELP_CONTACT.phone.replace(/\s+/g, '')}`}>
            <span>Telefono</span>
            <strong>{HELP_CONTACT.phone}</strong>
          </a>
          <a className="help-contact-item" href={HELP_CONTACT.website} target="_blank" rel="noreferrer">
            <span>Sitio web</span>
            <strong>{HELP_CONTACT.website.replace('https://', '')}</strong>
          </a>
        </div>
        <div className="help-contact-actions">
          <a className="btn btn-primary" href={`mailto:${HELP_CONTACT.salesEmail}?subject=${encodeURIComponent('Consulta comercial Milo Pro')}`}>Contactar ventas</a>
        </div>
      </div>
    </>
  );
}

function HelpSupportSection() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submitHelpSupportForm() {
    if (!form.name.trim() || !form.email.trim() || !form.subject.trim() || !form.message.trim()) {
      window.alert('Complete nombre, email, asunto y mensaje.');
      return;
    }

    const body = [`Nombre: ${form.name.trim()}`, `Email: ${form.email.trim()}`, '', form.message.trim()].join('\n');
    window.location.href = `mailto:${HELP_CONTACT.supportEmail}?subject=${encodeURIComponent(form.subject.trim())}&body=${encodeURIComponent(body)}`;
  }

  return (
    <>
      <HelpModuleHead title="Soporte tecnico" description="Canales de contacto tecnico y formulario rapido para resolver incidencias o consultas operativas." />

      <div className="help-contact-grid">
        <a className="help-contact-item" href={`mailto:${HELP_CONTACT.supportEmail}`}>
          <span>Email soporte</span>
          <strong>{HELP_CONTACT.supportEmail}</strong>
        </a>
        <a className="help-contact-item" href={HELP_CONTACT.whatsapp} target="_blank" rel="noreferrer">
          <span>WhatsApp</span>
          <strong>Iniciar chat</strong>
        </a>
        <a className="help-contact-item" href={`tel:${HELP_CONTACT.phone.replace(/\s+/g, '')}`}>
          <span>Telefono</span>
          <strong>{HELP_CONTACT.phone}</strong>
        </a>
      </div>

      <div className="help-support-layout">
        <div className="help-form-card">
          <div className="help-section-head">
            <h3>Formulario de contacto</h3>
            <p>Complete sus datos y se abrira su cliente de correo con la consulta lista para enviar.</p>
          </div>
          <div className="help-form-grid">
            <div className="form-group">
              <label>Nombre</label>
              <input value={form.name} onChange={(event) => updateField('name', event.target.value)} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} />
            </div>
            <div className="form-group help-field-span-2">
              <label>Asunto</label>
              <input value={form.subject} onChange={(event) => updateField('subject', event.target.value)} />
            </div>
            <div className="form-group help-field-span-2">
              <label>Mensaje</label>
              <textarea rows={6} value={form.message} onChange={(event) => updateField('message', event.target.value)} />
            </div>
          </div>
          <div className="help-contact-actions">
            <button className="btn btn-primary" type="button" onClick={submitHelpSupportForm}>Enviar consulta</button>
          </div>
        </div>

        <div className="help-side-info">
          <div className="help-info-card">
            <span>Horario de atencion</span>
            <strong>Lunes a viernes de 9:00 a 18:00</strong>
            <p>Atencion administrativa y tecnica durante horario comercial.</p>
          </div>
          <div className="help-info-card">
            <span>Tiempo estimado de respuesta</span>
            <strong>Entre 2 y 24 horas habiles</strong>
            <p>Las consultas urgentes pueden canalizarse primero por WhatsApp o telefono.</p>
          </div>
        </div>
      </div>
    </>
  );
}

export function HelpPage({ pageId }: { pageId: string }) {
  const activeSection = getActiveSection(pageId);

  return (
    <section className="help-admin-shell">
      <aside className="help-admin-sidebar card">
        <div className="help-admin-sidebar-head">
          <p className="help-admin-kicker">Ayuda</p>
          <h3>Centro de ayuda</h3>
          <span>Acceso rapido a guia, informacion comercial y soporte tecnico.</span>
        </div>
        <div className="help-admin-nav">
          {HELP_SECTIONS.map((section) => (
            <button
              key={section.id}
              className={`help-admin-nav-item ${activeSection === section.id ? 'is-active' : ''}`}
              type="button"
              onClick={() => {
                window.location.hash = section.route;
              }}
            >
              {section.label}
            </button>
          ))}
        </div>
      </aside>

      <section className="help-admin-content">
        <div className="help-admin-panel card">
          {activeSection === 'buy' ? <HelpBuySection /> : null}
          {activeSection === 'support' ? <HelpSupportSection /> : null}
          {activeSection === 'guide' ? <HelpGuideSection /> : null}
        </div>
      </section>
    </section>
  );
}
