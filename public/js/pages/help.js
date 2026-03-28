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
];

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
];

const helpUiState = {
  activeSection: 'guide',
  guideSearch: '',
  guideOpenIds: HELP_GUIDE_SECTIONS.map((section) => section.id),
  supportForm: {
    name: '',
    email: '',
    subject: '',
    message: ''
  }
};

function helpEscapeHtml(value) {
  return app.escapeHtml(value ?? '');
}

function helpEscapeAttr(value) {
  return app.escapeAttr(value ?? '');
}

function helpNormalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getHelpRoute(sectionId) {
  return (HELP_SECTIONS.find((section) => section.id === sectionId) || HELP_SECTIONS[0]).route;
}

async function renderHelp(sectionId = 'guide') {
  helpUiState.activeSection = HELP_SECTIONS.some((section) => section.id === sectionId) ? sectionId : 'guide';
  document.getElementById('page-content').innerHTML = `
    <section class="help-admin-shell">
      <aside class="help-admin-sidebar card">
        <div class="help-admin-sidebar-head">
          <p class="help-admin-kicker">Ayuda</p>
          <h3>Centro de ayuda</h3>
          <span>Acceso rapido a guia, informacion comercial y soporte tecnico.</span>
        </div>
        <div class="help-admin-nav">
          ${HELP_SECTIONS.map((section) => `
            <button class="help-admin-nav-item ${helpUiState.activeSection === section.id ? 'is-active' : ''}" type="button" onclick="selectHelpSection('${section.id}')">
              ${helpEscapeHtml(section.label)}
            </button>
          `).join('')}
        </div>
      </aside>
      <section class="help-admin-content">
        <div class="help-admin-panel card" id="help-admin-panel"></div>
      </section>
    </section>
  `;
  renderHelpSection();
}

function selectHelpSection(sectionId) {
  helpUiState.activeSection = HELP_SECTIONS.some((section) => section.id === sectionId) ? sectionId : 'guide';
  window.location.hash = getHelpRoute(helpUiState.activeSection);
}

function getFilteredHelpGuideSections() {
  const search = helpNormalizeText(helpUiState.guideSearch);
  if (!search) return HELP_GUIDE_SECTIONS;

  return HELP_GUIDE_SECTIONS.filter((section) => {
    const haystack = helpNormalizeText(section.title + ' ' + section.content.join(' '));
    return haystack.includes(search);
  });
}

function renderHelpModuleHead(title, description, actions = '') {
  return `
    <div class="help-module-head">
      <div>
        <p class="help-module-kicker">Ayuda</p>
        <h2>${helpEscapeHtml(title)}</h2>
        <p>${helpEscapeHtml(description)}</p>
      </div>
      ${actions}
    </div>
  `;
}

function renderHelpGuideSection() {
  const sections = getFilteredHelpGuideSections();
  const actions = `
    <div class="help-module-actions">
      <button class="btn btn-secondary" type="button" onclick="expandAllHelpGuide()">Expandir todo</button>
      <button class="btn btn-secondary" type="button" onclick="collapseAllHelpGuide()">Contraer</button>
      <button class="btn btn-primary" type="button" onclick="downloadHelpGuidePdf()">Descargar PDF</button>
    </div>
  `;

  return `
    ${renderHelpModuleHead('Guia de uso del sistema', 'Documentacion operativa organizada para aprender el sistema y resolver dudas frecuentes con lectura rapida.', actions)}

    <div class="help-filter-card">
      <div class="form-group help-search-group">
        <label>Buscar en la guia</label>
        <input type="text" value="${helpEscapeAttr(helpUiState.guideSearch)}" placeholder="Buscar modulo, tarea o proceso..." oninput="updateHelpGuideSearch(this.value)">
      </div>
    </div>

    <div class="help-accordion-list">
      ${sections.length === 0 ? `
        <div class="help-empty-card">
          <strong>Sin resultados</strong>
          <p>No encontramos coincidencias para la busqueda actual dentro de la guia.</p>
        </div>
      ` : sections.map((section) => {
        const isOpen = helpUiState.guideOpenIds.includes(section.id);
        return `
          <article class="help-accordion-card ${isOpen ? 'is-open' : ''}">
            <button class="help-accordion-toggle" type="button" onclick="toggleHelpGuideSection('${section.id}')">
              <span>${helpEscapeHtml(section.title)}</span>
              <strong>${isOpen ? '−' : '+'}</strong>
            </button>
            <div class="help-accordion-body" ${isOpen ? '' : 'hidden'}>
              ${section.content.map((paragraph) => `<p>${helpEscapeHtml(paragraph)}</p>`).join('')}
            </div>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function renderHelpBuySection() {
  return `
    ${renderHelpModuleHead('Como adquirir el sistema', 'Informacion comercial clara para evaluar planes, medios de pago y pasos de activacion.')}

    <div class="help-info-grid">
      <article class="help-info-card">
        <span>Planes disponibles</span>
        <strong>Inicial, Profesional y Multiusuario</strong>
        <p>Alternativas pensadas para comercios chicos, operaciones con mas volumen y equipos con multiples puestos de trabajo.</p>
      </article>
      <article class="help-info-card">
        <span>Formas de pago</span>
        <strong>Transferencia, tarjeta y suscripcion</strong>
        <p>Puede abonar por medios bancarios o digitales segun la modalidad comercial contratada.</p>
      </article>
      <article class="help-info-card">
        <span>Activacion</span>
        <strong>Alta guiada y puesta en marcha</strong>
        <p>Una vez confirmada la compra se habilita el sistema y se coordina la configuracion inicial.</p>
      </article>
    </div>

    <div class="help-rich-card">
      <div class="help-section-head">
        <h3>Proceso de compra</h3>
      </div>
      <div class="help-step-list">
        <div class="help-step-item"><strong>1.</strong><span>Seleccione el plan que mejor se adapta a la cantidad de usuarios y al nivel de operacion de su negocio.</span></div>
        <div class="help-step-item"><strong>2.</strong><span>Coordine la forma de pago y comparta los datos necesarios para preparar la activacion.</span></div>
        <div class="help-step-item"><strong>3.</strong><span>Reciba la confirmacion comercial, las credenciales iniciales y la asistencia de puesta en marcha.</span></div>
        <div class="help-step-item"><strong>4.</strong><span>Revise renovaciones, soporte y ampliaciones futuras segun el crecimiento de la operacion.</span></div>
      </div>
    </div>

    <div class="help-contact-card">
      <div class="help-section-head">
        <h3>Contacto comercial</h3>
        <p>Canales directos para consultas de ventas, activacion y renovaciones.</p>
      </div>
      <div class="help-contact-grid">
        <a class="help-contact-item" href="mailto:${helpEscapeAttr(HELP_CONTACT.salesEmail)}">
          <span>Email ventas</span>
          <strong>${helpEscapeHtml(HELP_CONTACT.salesEmail)}</strong>
        </a>
        <a class="help-contact-item" href="tel:${helpEscapeAttr(HELP_CONTACT.phone.replace(/\s+/g, ''))}">
          <span>Telefono</span>
          <strong>${helpEscapeHtml(HELP_CONTACT.phone)}</strong>
        </a>
        <a class="help-contact-item" href="${helpEscapeAttr(HELP_CONTACT.website)}" target="_blank" rel="noreferrer">
          <span>Sitio web</span>
          <strong>${helpEscapeHtml(HELP_CONTACT.website.replace('https://', ''))}</strong>
        </a>
      </div>
      <div class="help-contact-actions">
        <a class="btn btn-primary" href="mailto:${helpEscapeAttr(HELP_CONTACT.salesEmail)}?subject=${encodeURIComponent('Consulta comercial Milo Pro')}">Contactar ventas</a>
      </div>
    </div>
  `;
}

function renderHelpSupportSection() {
  return `
    ${renderHelpModuleHead('Soporte tecnico', 'Canales de contacto tecnico y formulario rapido para resolver incidencias o consultas operativas.')}

    <div class="help-contact-grid">
      <a class="help-contact-item" href="mailto:${helpEscapeAttr(HELP_CONTACT.supportEmail)}">
        <span>Email soporte</span>
        <strong>${helpEscapeHtml(HELP_CONTACT.supportEmail)}</strong>
      </a>
      <a class="help-contact-item" href="${helpEscapeAttr(HELP_CONTACT.whatsapp)}" target="_blank" rel="noreferrer">
        <span>WhatsApp</span>
        <strong>Iniciar chat</strong>
      </a>
      <a class="help-contact-item" href="tel:${helpEscapeAttr(HELP_CONTACT.phone.replace(/\s+/g, ''))}">
        <span>Telefono</span>
        <strong>${helpEscapeHtml(HELP_CONTACT.phone)}</strong>
      </a>
    </div>

    <div class="help-support-layout">
      <div class="help-form-card">
        <div class="help-section-head">
          <h3>Formulario de contacto</h3>
          <p>Complete sus datos y se abrira su cliente de correo con la consulta lista para enviar.</p>
        </div>
        <div class="help-form-grid">
          <div class="form-group">
            <label>Nombre</label>
            <input type="text" value="${helpEscapeAttr(helpUiState.supportForm.name)}" oninput="updateHelpSupportField('name', this.value)">
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" value="${helpEscapeAttr(helpUiState.supportForm.email)}" oninput="updateHelpSupportField('email', this.value)">
          </div>
          <div class="form-group help-field-span-2">
            <label>Asunto</label>
            <input type="text" value="${helpEscapeAttr(helpUiState.supportForm.subject)}" oninput="updateHelpSupportField('subject', this.value)">
          </div>
          <div class="form-group help-field-span-2">
            <label>Mensaje</label>
            <textarea rows="6" oninput="updateHelpSupportField('message', this.value)">${helpEscapeHtml(helpUiState.supportForm.message)}</textarea>
          </div>
        </div>
        <div class="help-contact-actions">
          <button class="btn btn-primary" type="button" onclick="submitHelpSupportForm()">Enviar consulta</button>
        </div>
      </div>

      <div class="help-side-info">
        <div class="help-info-card">
          <span>Horario de atencion</span>
          <strong>Lunes a viernes de 9:00 a 18:00</strong>
          <p>Atencion administrativa y tecnica durante horario comercial.</p>
        </div>
        <div class="help-info-card">
          <span>Tiempo estimado de respuesta</span>
          <strong>Entre 2 y 24 horas habiles</strong>
          <p>Las consultas urgentes pueden canalizarse primero por WhatsApp o telefono.</p>
        </div>
      </div>
    </div>
  `;
}

function renderHelpSection() {
  const panel = document.getElementById('help-admin-panel');
  if (!panel) return;

  if (helpUiState.activeSection === 'buy') {
    panel.innerHTML = renderHelpBuySection();
    return;
  }
  if (helpUiState.activeSection === 'support') {
    panel.innerHTML = renderHelpSupportSection();
    return;
  }
  panel.innerHTML = renderHelpGuideSection();
}

function updateHelpGuideSearch(value) {
  helpUiState.guideSearch = value || '';
  renderHelpSection();
}

function toggleHelpGuideSection(sectionId) {
  if (helpUiState.guideOpenIds.includes(sectionId)) {
    helpUiState.guideOpenIds = helpUiState.guideOpenIds.filter((id) => id !== sectionId);
  } else {
    helpUiState.guideOpenIds = [...helpUiState.guideOpenIds, sectionId];
  }
  renderHelpSection();
}

function expandAllHelpGuide() {
  helpUiState.guideOpenIds = HELP_GUIDE_SECTIONS.map((section) => section.id);
  renderHelpSection();
}

function collapseAllHelpGuide() {
  helpUiState.guideOpenIds = [];
  renderHelpSection();
}

function downloadHelpGuidePdf() {
  const guideHtml = HELP_GUIDE_SECTIONS.map((section) => `
    <section style="margin-bottom:24px;">
      <h2 style="font-family:Segoe UI, sans-serif;font-size:20px;margin:0 0 12px;">${helpEscapeHtml(section.title)}</h2>
      ${section.content.map((paragraph) => `<p style="font-family:Segoe UI, sans-serif;font-size:14px;line-height:1.6;margin:0 0 10px;">${helpEscapeHtml(paragraph)}</p>`).join('')}
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

function updateHelpSupportField(field, value) {
  helpUiState.supportForm[field] = value || '';
}

function submitHelpSupportForm() {
  const { name, email, subject, message } = helpUiState.supportForm;
  if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
    alert('Complete nombre, email, asunto y mensaje.');
    return;
  }

  const body = [
    `Nombre: ${name.trim()}`,
    `Email: ${email.trim()}`,
    '',
    message.trim()
  ].join('\n');

  window.location.href = `mailto:${HELP_CONTACT.supportEmail}?subject=${encodeURIComponent(subject.trim())}&body=${encodeURIComponent(body)}`;
}

window.renderHelp = renderHelp;
window.selectHelpSection = selectHelpSection;
window.updateHelpGuideSearch = updateHelpGuideSearch;
window.toggleHelpGuideSection = toggleHelpGuideSection;
window.expandAllHelpGuide = expandAllHelpGuide;
window.collapseAllHelpGuide = collapseAllHelpGuide;
window.downloadHelpGuidePdf = downloadHelpGuidePdf;
window.updateHelpSupportField = updateHelpSupportField;
window.submitHelpSupportForm = submitHelpSupportForm;
