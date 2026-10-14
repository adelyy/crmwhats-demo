// Prototipo del CRM de WhatsApp. Sin servidor: todo vive en memoria y se pierde al recargar.
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ahora = () => new Date().toTimeString().slice(0, 5);

const E = {
  ruta: 'login', rol: 'A', movil: false, usuario: 'u1',
  numero: 'todos', pest: 'todas', busca: '', verFiltros: false,
  embudo: 'b1', rep: { pre: '7', desde: '', hasta: '' }, tk: { pre: 'todo', desde: '', hasta: '' }, repNum: '', repEmb: '', tb: { pre: 'todo', desde: '', hasta: '' },
  f: { tags: [], embudo: '', etapa: '', resp: '', campana: '', misTickets: false, especial: false },
  conv: 'v1', panel: 'lista', pestTickets: 'Abierto', buscaContacto: ''
};
const USUARIO_POR_ROL = { A: 'u1', S: 'u2', G: 'u3', P: 'u1' };

// Un ticket o una conversación pueden quedar sin asignar (por ejemplo, al desactivar a su responsable).
const U = id => DB.usuarios.find(u => u.id === id) || { id: null, nombre: 'Sin asignar', ini: '—', numeros: [], rol: '', disp: false };
const C = id => DB.contactos.find(c => c.id === id);
const N = id => DB.numeros.find(n => n.id === id);
const TB = id => DB.embudos.find(b => b.id === id);
const ET = id => DB.embudos.flatMap(b => b.etapas).find(e => e.id === id);
// Estado de embudos y etapas: lo inactivo ya no se ofrece para cosas nuevas; lo que ya existe se conserva.
const primeraActiva = b => b.etapas.find(e => !e.inactivo) || b.etapas[0];
const swEstado = (cambio, datos, activo) => `<label class="interruptor" title="${activo ? 'Activo: clic para desactivar' : 'Inactivo: clic para activar'}"><input type="checkbox" data-cambio="${cambio}" ${datos} ${activo ? 'checked' : ''}><i></i></label>`;
// Filtro de un embudo general: "Filtrar por" (ninguno, palabras clave o expresión regular) y "Aplicar filtros" (siempre o entre dos fechas).
const fechaAnio = d => d.toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const FILTRO_OPS = ['Ninguno (solo se agregan a mano)', 'Palabras clave', 'Expresión regular (avanzado)'];
const filtroDe = b => b.filtro || ((b.claves || []).length ? 'claves' : 'manual');
const filtroActivo = b => { const fi = filtroDe(b); if (fi === 'manual') return false; if (b.aplicar !== 'fechas') return true; const t = Date.now(); return t >= new Date(b.inicio) && t <= new Date(b.fin); };
const filtroTxt = b => { const fi = filtroDe(b); if (fi === 'manual') return 'Filtrar por: ninguno (solo a mano)'; const que = fi === 'claves' ? 'palabras clave ' + (b.claves || []).join(', ') : 'expresión regular ' + b.regex; const cuando = b.aplicar === 'fechas' ? 'del ' + fechaAnio(new Date(b.inicio)) + ' al ' + fechaAnio(new Date(b.fin)) + (filtroActivo(b) ? '' : ' (fuera de fechas)') : 'siempre'; return 'Filtrar por: ' + que + ' · Aplicar filtros: ' + cuando; };
function camposFiltro(b) {
  const fi = filtroDe(b || {}), x = b || {};
  return [
    { id: 'fi', et: 'Filtrar por', tipo: 'select', ops: FILTRO_OPS, valor: FILTRO_OPS[{ manual: 0, claves: 1, regex: 2 }[fi]] },
    { id: 'k', si: ['fi', 'Palabras clave'], et: 'Palabras clave, separadas por coma', ph: 'precio, comprar, cotización', valor: (x.claves || []).join(', ') },
    { tipo: 'nota', si: ['fi', 'Palabras clave'], et: 'Si el mensaje del cliente trae una de estas palabras completas, entra solo a la primera etapa del embudo. No importan mayúsculas ni acentos.' },
    { id: 'r', si: ['fi', 'Expresión regular'], et: 'Expresión regular. Ejemplo: pedido\\s*#?\\d{4,6} reconoce "pedido 4821" o "Pedido #48210"', ph: 'pedido\\s*#?\\d{4,6}', valor: x.regex || '' },
    { id: 'prueba', si: ['fi', 'Expresión regular'], et: 'Pruébala con un mensaje de ejemplo', ph: 'Hola, ¿cómo va mi pedido 4821?' },
    { tipo: 'nota', si: ['fi', 'Expresión regular'], et: '<span id="resRegex">Escribe un mensaje de ejemplo para ver si coincide.</span> No importan mayúsculas.' },
    { id: 'ap', si: ['fi', 'Palabras clave|Expresión regular'], et: 'Aplicar filtros', tipo: 'select', ops: ['Siempre', 'Entre dos fechas'], valor: x.aplicar === 'fechas' ? 'Entre dos fechas' : 'Siempre' },
    { id: 'i', si: ['ap', 'Entre dos fechas', 'fi', 'Palabras clave|Expresión regular'], et: 'Fecha inicial', tipo: 'datetime-local', valor: x.inicio || '' },
    { id: 'f', si: ['ap', 'Entre dos fechas', 'fi', 'Palabras clave|Expresión regular'], et: 'Fecha final', tipo: 'datetime-local', valor: x.fin || '' },
    { tipo: 'nota', si: ['fi', 'Palabras clave|Expresión regular'], et: 'Fuera de las fechas el filtro no mete a nadie; los contactos que ya están en el embudo se quedan. Cambiar el filtro no mueve a nadie.' }
  ];
}
function leerFiltro(f) {
  const fi = f.fi.startsWith('Palabras') ? 'claves' : f.fi.startsWith('Expresión') ? 'regex' : 'manual', claves = (f.k || '').split(',').map(x => x.trim()).filter(Boolean);
  if (fi === 'claves' && !claves.length) return aviso('Faltan las palabras clave');
  if (fi === 'regex' && !(f.r || '').trim()) return aviso('Falta la expresión regular');
  if (fi === 'regex' && !regexValida(f.r)) return aviso('La expresión regular no es válida; revisa paréntesis y corchetes');
  const fechas = fi !== 'manual' && f.ap === 'Entre dos fechas';
  if (fechas && (!f.i || !f.f)) return aviso('Faltan la fecha inicial y la fecha final');
  if (fechas && new Date(f.f) <= new Date(f.i)) return aviso('La fecha final debe ser después de la inicial');
  return { filtro: fi, claves: fi === 'claves' ? claves : [], regex: fi === 'regex' ? f.r.trim() : '', aplicar: fechas ? 'fechas' : 'siempre', inicio: fechas ? f.i : '', fin: fechas ? f.f : '' };
}
function cambiaEmbudo(id, activo) {
  const b = TB(id);
  if (!activo && b.tipo === 'tickets') return aviso('El embudo de tickets no se puede desactivar: los tickets lo necesitan');
  b.inactivo = !activo; aviso(`Embudo ${b.n} ${activo ? 'activo' : 'inactivo: ya no recibe contactos nuevos'}`); return true;
}
function cambiaEtapa(idEmbudo, idEtapa, activo) {
  const b = TB(idEmbudo), e = b.etapas.find(x => x.id === idEtapa);
  if (!activo) {
    const ocupada = DB.posiciones.some(x => x.b === b.id && x.e === e.id) || (b.tipo === 'tickets' && DB.tickets.some(k => k.etapa === e.id));
    if (ocupada) return aviso(`La etapa ${e.n} tiene tarjetas: muévelas a otra etapa antes de desactivarla`);
    if (e.tipo === 'abierta' && !b.etapas.some(x => x !== e && !x.inactivo && x.tipo === 'abierta')) return aviso('Debe quedar al menos una etapa En proceso activa');
    if (b.tipo === 'tickets' && e.tipo !== 'abierta' && !b.etapas.some(x => x !== e && !x.inactivo && x.tipo !== 'abierta')) return aviso('El embudo de tickets debe tener al menos una etapa que cierre el ticket');
  }
  e.inactivo = !activo; aviso(`Etapa ${e.n} ${activo ? 'activa' : 'inactiva'}`); return true;
}
// Tickets: son las tarjetas del embudo de tickets. Su estado sale de la etapa: la primera etapa activa es Pendiente (Abierto),
// las demás etapas En proceso son En proceso, y una etapa Ganada o Perdida cierra el ticket.
const ETK = () => DB.embudos.find(b => b.tipo === 'tickets');
function estadoTk(k) { const b = ETK(), e = b.etapas.find(x => x.id === k.etapa); if (!e) return 'Abierto'; if (e.tipo !== 'abierta') return 'Cerrado'; return primeraActiva(b).id === e.id ? 'Abierto' : 'En proceso'; }
const etapasCierreTk = () => ETK().etapas.filter(e => e.tipo !== 'abierta' && !e.inactivo);
const siguienteAbiertaTk = k => { const b = ETK(), ab = b.etapas.filter(e => e.tipo === 'abierta' && !e.inactivo), i = ab.findIndex(e => e.id === k.etapa); return ab[Math.min(i + 1, ab.length - 1)] || ab[0]; };
// Tarjetas de un contacto. Ningún embudo se asigna por defecto: si no tiene tarjetas, no está en ninguno.
const posDe = c => DB.posiciones.filter(p => p.c === c.id);
const chipTab = c => { const ps = posDe(c); if (!ps.length) return ''; const e = ET(ps[0].e), o = ps.slice(1); return `<span class="mini" style="--c:${e.c}" title="Embudo ${esc(TB(ps[0].b).n)}">${esc(TB(ps[0].b).n.replace('Campaña · ', ''))} · ${esc(e.n)}</span>` + (o.length ? ` <span class="mini gris" title="${esc(o.map(p => TB(p.b).n + ': ' + ET(p.e).n).join(' · '))}">+${o.length}</span>` : ''); };
// Palabras clave de los embudos: sin mayúsculas ni acentos, y palabra completa ("pago" no coincide con "pagos").
const normal = t => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const tieneClave = (texto, clave) => { const k = normal(clave).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); return !!k && new RegExp('(^|[^a-z0-9])' + k + '([^a-z0-9]|$)').test(normal(texto)); };
function aplicarClaves(v, texto) {
  if (!v.contacto) return [];
  const c = C(v.contacto), hechos = [];
  for (const b of DB.embudos.filter(x => x.tipo !== 'tickets' && !x.inactivo)) {
    if (b.tipo === 'general' && !filtroActivo(b)) continue;
    let clave = null;
    if (b.tipo === 'general' && filtroDe(b) === 'regex') { const m = regexValida(b.regex) && texto.match(new RegExp(b.regex, 'i')); clave = m ? m[0] : null; }
    else clave = (b.claves || []).find(k => tieneClave(texto, k));
    if (b.numero && b.numero !== v.numero) continue; // embudo limitado a otro número
    const camp = b.campana && DB.campanas.find(x => x.id === b.campana);
    if (camp && camp.tipo === 'Entrada' && camp.inicio && estadoEntrada(camp) !== 'Activa') continue; // fuera de sus fechas no clasifica
    if (!clave || posDe(c).some(p => p.b === b.id)) continue; // si ya está en el embudo no se regresa a la primera etapa
    DB.posiciones.push({ c: c.id, b: b.id, e: primeraActiva(b).id, m: 0, dias: 0, origen: 'clave', clave });
    if (b.campana) { v.campana = b.campana; const k = DB.campanas.find(x => x.id === b.campana); if (k) k.respuestas++; } // la conversación queda ligada a la campaña
    const ke = DB.campanas.find(x => x.tipo === 'Entrada' && x.embudo === b.id && estadoEntrada(x) === 'Activa' && (!x.numero || x.numero === v.numero));
    if (ke) { v.campana = ke.id; ke.respuestas++; } // entró por el filtro del embudo de una campaña de entrada vigente
    v.msgs.push({ de: 's', t: `Se agregó solo al embudo ${b.n}, etapa ${primeraActiva(b).n}, por ${filtroDe(b) === 'regex' ? 'la expresión regular, con' : 'la palabra'} «${clave}»`, h: ahora() });
    hechos.push(b.n);
  }
  return hechos;
}
const TAGS = () => DB.gruposTags.flatMap(g => g.tags);
const TAG = id => TAGS().find(t => t.id === id);
const CONV = () => DB.conversaciones.find(v => v.id === E.conv);
const nombreConv = v => v.grupo || C(v.contacto).nombre;
const iniciales = n => n.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();

/* ---------- Iconos ---------- */
const TRAZOS = {
  menu: 'M4 6h16M4 12h16M4 18h16', chat: 'M4 5h16v11H9l-5 4z', cols: 'M4 4h5v16H4zM10.5 4h5v11h-5zM17 4h3v7h-3z', users: 'M8 11a3 3 0 100-6 3 3 0 000 6zM2 20c0-3 3-5 6-5s6 2 6 5M17 11a3 3 0 100-6M18 15c2 .5 4 2 4 5',
  ticket: 'M4 7h16v4a2 2 0 000 4v4H4v-4a2 2 0 000-4zM10 7v12', mega: 'M3 10v4l11 5V5zM14 9a3 3 0 010 6M6 15v4h3', lista: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  chart: 'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-8', tel: 'M7 3h10v18H7zM11 18h2', plant: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5', rayo: 'M13 3L5 14h6l-1 7 8-11h-6z',
  robot: 'M5 9h14v10H5zM12 9V5M9 14h.01M15 14h.01M3 13v3M21 13v3', tag: 'M3 12V4h8l10 10-8 8zM7.5 8h.01', stop: 'M12 3a9 9 0 100 18 9 9 0 000-18zM6 6l12 12', plan: 'M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z',
  edif: 'M4 21V5h10v16M14 10h6v11M8 9h2M8 13h2M8 17h2', caja: 'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8', perfil: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6',
  mas: 'M12 5v14M5 12h14', enviar: 'M4 12l16-8-6 16-3-7z', mic: 'M12 3a3 3 0 00-3 3v5a3 3 0 006 0V6a3 3 0 00-3-3zM6 11a6 6 0 0012 0M12 17v4', emoji: 'M12 3a9 9 0 100 18 9 9 0 000-18zM8.5 14c1 1.5 6 1.5 7 0M9 9.5h.01M15 9.5h.01',
  filtro: 'M4 5h16l-6 8v6l-4-2v-4z', atras: 'M15 5l-7 7 7 7', reloj: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2', estrella: 'M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1L3.2 9.4l6.1-.8z',
  info: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 11v6M12 7.5h.01', grupo: 'M9 10a3 3 0 100-6 3 3 0 000 6zM3 19c0-3 3-5 6-5s6 2 6 5M17 8v6M14 11h6'
};
const ico = n => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${TRAZOS[n] || ''}"/></svg>`;

/* ---------- Menú y permisos ---------- */
const MENU = [
  { sec: 'Operación', items: [
    { r: 'bandeja', n: 'Bandeja', i: 'chat', roles: 'ASG', movil: true },
    { r: 'embudo', n: 'Embudos', i: 'cols', roles: 'ASG', movil: true },
    { r: 'contactos', n: 'Contactos', i: 'users', roles: 'ASG', movil: true },
    { r: 'tickets', n: 'Tickets', i: 'ticket', roles: 'ASG', movil: true },
    { r: 'campanas', n: 'Campañas', i: 'mega', roles: 'AS' },
    { r: 'listas', n: 'Listas de difusión', i: 'lista', roles: 'AS' },
    { r: 'reportes', n: 'Reportes', i: 'chart', roles: 'ASG' }] },
  { sec: 'Configuración', items: [
    { r: 'numeros', n: 'Números', i: 'tel', roles: 'A' },
    { r: 'plantillas', n: 'Plantillas', i: 'plant', roles: 'AS' },
    { r: 'respuestas', n: 'Respuestas rápidas', i: 'rayo', roles: 'AS' },
    { r: 'automaticos', n: 'Mensajes automáticos', i: 'robot', roles: 'AS' },
    { r: 'tags', n: 'Tags y embudos', i: 'tag', roles: 'A' },
    { r: 'bajas', n: 'Bajas', i: 'stop', roles: 'AS' },
    { r: 'usuarios', n: 'Usuarios', i: 'users', roles: 'A' },
    { r: 'empresa', n: 'Empresa', i: 'edif', roles: 'A' },
    { r: 'plan', n: 'Mi plan', i: 'plan', roles: 'A' }] },
  { sec: 'Plataforma', items: [
    { r: 'empresas', n: 'Empresas', i: 'edif', roles: 'P' },
    { r: 'paquetes', n: 'Paquetes', i: 'caja', roles: 'P' },
    { r: 'numerosPlat', n: 'Números conectados', i: 'tel', roles: 'P' }] },
  { sec: '', items: [{ r: 'perfil', n: 'Perfil', i: 'perfil', roles: 'ASGP', movil: true, oculto: true }] }
];
const ITEMS = MENU.flatMap(s => s.items);
const permite = it => it && it.roles.includes(E.rol);
const puede = letras => letras.includes(E.rol);

function menu() {
  const yo = U(E.usuario);
  const secciones = MENU.map(s => {
    const its = s.items.filter(it => permite(it) && !it.oculto);
    if (!its.length) return '';
    return `<div class="m-sec">${s.sec}</div>` + its.map(it =>
      `<a class="m-item ${E.ruta === it.r ? 'activo' : ''}" data-accion="ir" data-ruta="${it.r}" title="${it.n}">${ico(it.i)}<span>${it.n}</span>${it.r === 'bandeja' ? `<b class="globo">${totalNoLeidos()}</b>` : ''}</a>`).join('');
  }).join('');
  return `<nav class="menu ${E.menuCol ? 'col' : ''}">
    <div class="marca"><button class="m-col" data-accion="colMenu" title="${E.menuCol ? 'Mostrar el menú completo' : 'Dejar solo los iconos'}" aria-label="Contraer o expandir el menú">${ico('menu')}</button>${logoMenu()}<div><strong>Enlaza CRM</strong><small>${E.rol === 'P' ? 'Plataforma' : esc(DB.empresa.nombre)}</small></div></div>
    <div class="m-lista">${secciones}</div>
    <a class="m-yo" data-accion="ir" data-ruta="perfil" title="${esc(yo.nombre)} · Perfil"><span class="avatar">${yo.ini}</span><div><strong>${esc(yo.nombre)}</strong><small><i class="punto ${yo.disp ? 'ok' : ''}"></i>${yo.disp ? 'Disponible' : 'No disponible'}</small></div></a>
  </nav>`;
}
function navMovil() {
  const its = E.rol === 'P' ? ['perfil'] : ['bandeja', 'tickets', 'embudo', 'contactos', 'perfil'];
  return `<nav class="nav-movil">${its.map(r => { const it = ITEMS.find(i => i.r === r); return `<a class="${E.ruta === r ? 'activo' : ''}" data-accion="ir" data-ruta="${r}">${ico(it.i)}<span>${it.n}</span></a>`; }).join('')}</nav>`;
}

/* ---------- Piezas comunes ---------- */
const chip = (t, tono = '') => `<span class="chip ${tono}">${esc(t)}</span>`;
const TONOS = { Conectado: 'verde', Aprobada: 'verde', Activa: 'verde', Enviada: 'verde', Cerrado: 'gris', 'En revisión': 'ambar', Desconectado: 'rojo', Programada: 'azul', Cancelada: 'gris', Finalizada: 'gris', Activo: 'verde', Programado: 'azul', Finalizado: 'gris', Apagado: 'gris', Enviando: 'azul', 'En prueba': 'azul', 'En proceso': 'ambar', Abierto: 'rojo', Rechazada: 'rojo', 'En pausa': 'ambar', Suspendida: 'rojo', Alta: 'verde', Media: 'ambar' };
const estadoChip = t => chip(t, TONOS[t] || 'gris');
// Mientras hay una campaña a medias, todas las pantallas (menos Campañas) muestran cómo volver a ella.
const avisoBorrador = () => typeof campBorrador !== 'undefined' && campBorrador && E.ruta !== 'campanas' ? `<p class="aviso-borrador">Tienes la campaña «${esc(campBorrador.nombre || 'sin nombre')}» a medias. ${btn('← Volver a la campaña', 'volverCamp')}</p>` : '';
const pagina = (t, sub, acc, cuerpo) => `<div class="pagina">${avisoBorrador()}<header class="p-cab"><div><h1>${t}</h1><p>${sub}</p></div><div class="p-acc">${acc || ''}</div></header>${cuerpo}</div>`;
const tabla = (cols, filas) => `<div class="tabla-caja"><table><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${filas.length ? filas.map(f => `<tr ${f.attr || ''}>${f.c.map(c => `<td>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length}" class="vacio">Sin registros</td></tr>`}</tbody></table></div>`;
const btn = (t, accion, clase = '', extra = '') => `<button class="btn ${clase}" data-accion="${accion}" ${extra}>${t}</button>`;

function aviso(t) {
  const d = document.createElement('div'); d.className = 'aviso'; d.textContent = t;
  $('#avisos').appendChild(d); setTimeout(() => d.remove(), 3200);
  return false; // así un "return aviso(...)" de validación deja el formulario abierto
}
function abrirModal(titulo, cuerpo, pie = '', ancho = '') {
  $('#modal').className = '';
  $('#modal').innerHTML = `<div class="m-fondo" data-accion="cerrarModal"></div><div class="m-caja ${ancho}"><header><h2>${titulo}</h2><button class="x" data-accion="cerrarModal">×</button></header><div class="m-cuerpo">${cuerpo}</div>${pie ? `<footer>${pie}</footer>` : ''}</div>`;
}
const cerrarModal = () => { $('#modal').className = 'oculto'; $('#modal').innerHTML = ''; };

// Colores que se pueden elegir para una etapa: pocos y probados, para que el texto siempre se lea.
const PALETA = [['#2563eb', 'Azul'], ['#0e7490', 'Turquesa'], ['#047857', 'Verde'], ['#b45309', 'Ámbar'], ['#be123c', 'Rojo'], ['#c026d3', 'Rosa'], ['#7c3aed', 'Morado'], ['#64748b', 'Gris']];
// Campos que dependen de otra opción: se ocultan (no se desactivan) cuando no aplican y conservan lo escrito.
const siHtml = (html, campo, valor, campo2, valor2) => `<div data-si-campo="${campo}" data-si-valor="${valor}"${campo2 ? ` data-si-campo2="${campo2}" data-si-valor2="${valor2}"` : ''}>${html}</div>`;
function aplicarSi() {
  document.querySelectorAll('#modal form [data-si-campo], #formEmp [data-si-campo]').forEach(el => {
    const cumple = (campo, valor) => { const ctrl = el.closest('form').elements[campo], v = ctrl ? String(ctrl.value) : ''; return valor.split('|').some(x => v.startsWith(x)); };
    el.classList.toggle('oculto', !(cumple(el.dataset.siCampo, el.dataset.siValor) && (!el.dataset.siCampo2 || cumple(el.dataset.siCampo2, el.dataset.siValor2))));
  });
}
let alGuardar = null;
function formModal(titulo, campos, cb, textoBoton = 'Guardar') {
  alGuardar = cb;
  const campoHtml = c => {
    if (c.tipo === 'paleta') return `<div class="campo"><span>${c.et}</span><div class="paleta"><label class="auto"><input type="radio" name="${c.id}" value="" checked><i>Automático</i></label>${PALETA.map(p => `<label title="${p[1]}"><input type="radio" name="${c.id}" value="${p[0]}"><i style="--c:${p[0]}"></i><b>${p[1]}</b></label>`).join('')}</div></div>`;
    let ctrl;
    if (c.tipo === 'select') ctrl = `<select name="${c.id}">${c.ops.map(o => `<option ${o === c.valor ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    else if (c.tipo === 'area') ctrl = `<textarea name="${c.id}" rows="3" placeholder="${esc(c.ph || '')}">${esc(c.valor || '')}</textarea>`;
    else if (c.tipo === 'estado') { const on = c.valor === c.ops[0]; return `<div class="campo"><span>${c.et}</span><label class="estado-sw"><input type="hidden" name="${c.id}" value="${c.ops[1]}"><span class="interruptor"><input type="checkbox" name="${c.id}" value="${c.ops[0]}" ${on ? 'checked' : ''}><i></i></span><b data-on="${c.ops[0]}" data-off="${c.ops[1]}">${on ? c.ops[0] : c.ops[1]}</b></label></div>`; }
    else if (c.tipo === 'nota') return `<p class="nota">${c.et}</p>`;
    else ctrl = `<input name="${c.id}" type="${c.tipo || 'text'}" value="${esc(c.valor || '')}" placeholder="${esc(c.ph || '')}">`;
    return `<label class="campo"><span>${c.et}</span>${ctrl}</label>`;
  };
  const cuerpo = campos.map(c => c.si ? siHtml(campoHtml(c), c.si[0], c.si[1], c.si[2], c.si[3]) : campoHtml(c)).join('');
  abrirModal(titulo, `<form id="formGen">${cuerpo}</form>`, btn('Cancelar', 'cerrarModal') + btn(textoBoton, 'guardarForm', 'primario'));
  aplicarSi();
}

/* ---------- Bandeja ---------- */
const ultimoMsg = v => [...v.msgs].reverse().find(m => m.de !== 's');
const sinResponder = v => v.estado === 'abierta' && ultimoMsg(v)?.de === 'c';
const ticketsAbiertosDe = v => DB.tickets.filter(k => k.conv === v.id && estadoTk(k) !== 'Cerrado').length;
const usaVentana = v => N(v.numero).tipo !== 'QR';
function convsVisibles() {
  const yo = U(E.usuario);
  return DB.conversaciones.filter(v => yo.numeros.includes(v.numero) && (E.rol !== 'G' || !v.resp || v.resp === yo.id));
}
const totalNoLeidos = () => convsVisibles().reduce((s, v) => s + v.noLeidos, 0);
function convsFiltradas() {
  const q = E.busca.trim().toLowerCase(), f = E.f;
  return convsVisibles().filter(v => {
    const c = v.contacto ? C(v.contacto) : null;
    if (E.numero !== 'todos' && v.numero !== E.numero) return false;
    if (E.pest === 'contickets') { if (!DB.tickets.some(k => k.conv === v.id && estadoTk(k) !== 'Cerrado' && (!f.misTickets || k.asignado === E.usuario))) return false; }
    else if (E.pest === 'cerradas' ? v.estado === 'abierta' : v.estado !== 'abierta') return false;
    if (E.pest === 'sinleer' && !v.noLeidos) return false;
    if (E.pest === 'sinresp' && !sinResponder(v)) return false;
    if (E.pest === 'mias' && v.resp !== E.usuario) return false;
    if (E.pest === 'grupos' && !v.grupo) return false;
    if (q && !(nombreConv(v).toLowerCase().includes(q) || (c && c.tel.replace(/\s/g, '').includes(q.replace(/\s/g, ''))))) return false;
    if (f.tags.length && !f.tags.some(t => v.tags.includes(t) || (c && c.tags.includes(t)))) return false;
    if ((f.embudo || f.etapa) && !(c && posDe(c).some(p => (!f.embudo || p.b === f.embudo) && (!f.etapa || p.e === f.etapa)))) return false;
    if (f.resp && (f.resp === 'nadie' ? v.resp : v.resp !== f.resp)) return false;
    if (f.campana && v.campana !== f.campana) return false;
    if (f.especial && !(c && c.especial)) return false;
    return true;
  });
}
const numFiltros = () => E.f.tags.length + ['embudo', 'etapa', 'resp', 'campana'].filter(k => E.f[k]).length + (E.f.especial ? 1 : 0);

function indicadores() {
  const vis = convsVisibles();
  const tickets = DB.tickets.filter(k => estadoTk(k) !== 'Cerrado').length;
  const d = [['Recibidos hoy', 238, ''], ['Enviados hoy', 221, ''], ['Sin responder', vis.filter(sinResponder).length, 'rojo'], ['Tickets abiertos', tickets, 'ambar'],
    ['Marketing', '12 · $0.52', 'azul'], ['Utilidad', '185 · $1.48', 'verde'], ['Servicio', '0 · $0', 'gris']];
  return `<div class="indicadores">${d.map(x => `<div class="ind ${x[2]}"><small>${x[0]}</small><strong>${x[1]}</strong></div>`).join('')}</div>`;
}
function filaConv(v) {
  const c = v.contacto ? C(v.contacto) : null, u = ultimoMsg(v), r = v.resp ? U(v.resp) : null;
  const previa = (u.de === 'c' ? '' : 'Tú: ') + u.t;
  return `<a class="conv ${v.id === E.conv ? 'activa' : ''}" data-accion="abrirConv" data-id="${v.id}">
    <span class="avatar ${v.grupo ? 'grupo' : ''}">${v.grupo ? ico('grupo') : iniciales(c.nombre)}</span>
    <div class="c-medio">
      <div class="c-nombre">${esc(nombreConv(v))}${c && c.especial ? `<i class="estrella">${ico('estrella')}</i>` : ''}</div>
      <div class="c-previa">${esc(previa)}</div>
      <div class="c-chips">${c ? chipTab(c) : ''}${ticketsAbiertosDe(v) ? '<span class="mini" style="--c:#be123c">Ticket abierto</span>' : ''}${v.estado === 'inactividad' ? '<span class="mini gris">Cerrada · inactividad</span>' : ''}${v.estado === 'cerrada' ? '<span class="mini gris">Cerrada</span>' : ''}<span class="mini gris">${N(v.numero).nombre}</span></div>
    </div>
    <div class="c-der"><small>${v.hora}</small>${v.noLeidos ? `<b class="globo">${v.noLeidos}</b>` : ''}${v.espera ? `<span class="espera">${ico('reloj')}${v.espera}</span>` : ''}<span class="resp ${r ? '' : 'nadie'}" title="${r ? esc(r.nombre) : 'Sin asignar'}">${r ? r.ini : '+'}</span></div>
  </a>`;
}
const ticketMasViejo = v => Math.min(...DB.tickets.filter(k => k.conv === v.id && estadoTk(k) !== 'Cerrado').map(k => k.id));
const filasConv = () => { const l = convsFiltradas(); if (E.pest === 'contickets') l.sort((a, b) => ticketMasViejo(a) - ticketMasViejo(b)); return l.length ? l.map(filaConv).join('') : '<div class="vacio">No hay conversaciones con estos filtros.<br><a data-accion="limpiar">Limpiar filtros</a></div>'; };

function panelFiltros() {
  const f = E.f;
  const sel = (k, et, ops) => `<label class="campo"><span>${et}</span><select data-cambio="filtro" data-k="${k}"><option value="">Todos</option>${ops.map(o => `<option value="${o[0]}" ${f[k] === o[0] ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label>`;
  return `<div class="filtros">
    ${DB.gruposTags.map(g => `<div class="f-grupo"><h4>${esc(g.nombre)}</h4>${g.tags.map(t => `<label class="check"><input type="checkbox" data-cambio="filtroTag" value="${t.id}" ${f.tags.includes(t.id) ? 'checked' : ''}>${esc(t.n)}</label>`).join('')}</div>`).join('')}
    <div class="f-fila">${sel('embudo', 'Embudo', DB.embudos.filter(b => b.tipo !== 'tickets').map(b => [b.id, b.n]))}${sel('etapa', 'Etapa del embudo', (f.embudo ? TB(f.embudo).etapas : []).map(e => [e.id, e.n]))}${sel('resp', 'Responsable', [['nadie', 'Sin asignar'], ...DB.usuarios.map(u => [u.id, u.nombre])])}${sel('campana', 'Campaña', DB.campanas.map(k => [k.id, k.nombre]))}</div>
    <div class="f-fila"><label class="check"><input type="checkbox" data-cambio="filtroBool" data-k="especial" ${f.especial ? 'checked' : ''}>Cliente especial</label><a class="limpiar" data-accion="limpiar">Limpiar todo</a></div>
  </div>`;
}
function vBandeja() {
  const yo = U(E.usuario), v = CONV();
  const pests = [['todas', 'Todas'], ['sinleer', 'Sin leer'], ['sinresp', 'Sin responder'], ['contickets', 'Con ticket'], ['mias', 'Mías'], ['grupos', 'Grupos'], ['cerradas', 'Cerradas']];
  return `<div class="bandeja panel-${E.panel}">
    ${indicadores()}
    <div class="b-cuerpo">
      <section class="b-lista">
        <div class="l-cab">
          <select data-cambio="numero"><option value="todos">Todos mis números</option>${DB.numeros.filter(n => yo.numeros.includes(n.id)).map(n => `<option value="${n.id}" ${E.numero === n.id ? 'selected' : ''}>${esc(n.nombre)} · ${n.tel}</option>`).join('')}</select>
          <div class="l-busca"><input id="busca" placeholder="Buscar por nombre o teléfono" value="${esc(E.busca)}"><button class="icono ${E.verFiltros ? 'activo' : ''}" data-accion="toggleFiltros" title="Filtros">${ico('filtro')}${numFiltros() ? `<b class="globo">${numFiltros()}</b>` : ''}</button></div>
          <div class="pests">${pests.map(p => `<button class="${E.pest === p[0] ? 'activo' : ''}" data-accion="pest" data-p="${p[0]}">${p[1]}${p[0] === 'contickets' ? ` <b>${convsVisibles().filter(ticketsAbiertosDe).length}</b>` : ''}</button>`).join('')}</div>
          ${E.pest === 'contickets' ? `<div class="f-fila sub-pest"><label class="check"><input type="checkbox" data-cambio="filtroBool" data-k="misTickets" ${E.f.misTickets ? 'checked' : ''}>Solo tickets asignados a mí</label><small>Primero el ticket más antiguo</small></div>` : ''}
          ${E.verFiltros ? panelFiltros() : ''}
        </div>
        <div class="convs" id="listaConvs">${filasConv()}</div>
        <div class="l-pie">${btn(ico('mas') + ' Nueva conversación', 'nuevaConv', 'primario ancho')}</div>
      </section>
      <section class="b-chat">${v ? chat(v) : '<div class="vacio">Elige una conversación</div>'}</section>
      <aside class="b-detalle" id="detalle">${v ? detalle(v) : ''}</aside>
    </div>
  </div>`;
}

const PALOMAS = { enviado: '✓', entregado: '✓✓', leido: '<i class="leido">✓✓</i>', fallido: '<i class="fallo">! No enviado</i>' };
function burbuja(m) {
  if (m.de === 's') return `<div class="sistema"><span>${esc(m.t)} · ${m.h}</span></div>`;
  const mio = m.de !== 'c';
  const quien = m.de === 'a' ? U(m.por).nombre : m.de === 'auto' ? 'Mensaje automático' : m.de === 'camp' ? 'Campaña' : (m.autor || '');
  let cuerpo = esc(m.t);
  if (m.tipo === 'audio') cuerpo = `<div class="adj">${ico('mic')}<div class="onda"></div><span>${esc(m.t.split('·')[1] || '0:08')}</span></div>`;
  if (m.tipo === 'doc' || m.tipo === 'imagen') cuerpo = `<div class="adj">${ico('plant')}<span>${esc(m.t)}</span></div>`;
  if (m.tipo === 'plantilla') cuerpo = `<small class="b-tipo">Plantilla</small>${m.medio ? `<div class="pl-medio">${esc(m.medio)}</div>` : ''}${m.enc ? `<strong class="pl-enc">${esc(m.enc)}</strong>` : ''}${m.oferta ? `<div class="pl-oferta"><b>${esc(m.oferta)}</b></div>` : ''}${esc(m.t)}${m.nTarjetas ? `<small class="pl-pie">Carrusel de ${m.nTarjetas} tarjetas</small>` : ''}${(m.botones || []).map(b => `<div class="b-boton">${esc(b)}</div>`).join('')}`;
  return `<div class="msg ${mio ? 'mio' : 'suyo'} ${m.de}">${quien ? `<small class="b-quien">${esc(quien)}</small>` : ''}<div>${cuerpo}</div><span class="b-hora">${m.h} ${mio ? PALOMAS[m.est] || '' : ''}</span></div>`;
}
function textoVentana(v) {
  if (!usaVentana(v)) return '<span class="ventana gris">Número no oficial · sin ventana</span>';
  if (v.ventana <= 0) return '<span class="ventana cerrada">Ventana cerrada · solo plantillas</span>';
  return `<span class="ventana ${v.ventana < 60 ? "porcerrar" : ""}">Ventana abierta · quedan ${Math.floor(v.ventana / 60)} h ${v.ventana % 60} min de 24 h</span>`;
}
const textoGratis = v => v.gratis > 0 ? `<span class="ventana gratis">Entró por anuncio · plantillas gratis ${Math.floor(v.gratis / 60)} h más</span>` : "";
function redaccion(v) {
  if (v.estado !== 'abierta') return `<div class="bloqueo"><span>Esta conversación está cerrada${v.estado === 'inactividad' ? ' por inactividad' : ''}. Se reabre sola cuando el cliente escriba.</span>${btn('Reabrir', 'reabrir')}</div>`;
  if (usaVentana(v) && v.ventana <= 0) return `<div class="bloqueo"><span><strong>Ventana cerrada.</strong> Pasaron más de 24 h desde el último mensaje del cliente, así que no puedes escribirle libremente. La única forma de responderle es con una plantilla aprobada; cuando conteste, la ventana se abre otra vez.</span>${btn('Responder con plantilla', 'plantilla', 'primario')}</div>`;
  return `<div class="redaccion">
    <button class="icono" data-accion="menuMas" title="Adjuntar">${ico('mas')}</button>
    <button class="icono" data-accion="emoji" title="Emoji">${ico('emoji')}</button>
    <textarea id="texto" rows="1" placeholder="Escribe un mensaje… ( / para respuestas rápidas )"></textarea>
    <button class="btn chico" data-accion="plantilla" title="Responder con plantilla aprobada">${ico('plant')} Plantilla</button>
    <button class="icono" data-accion="voz" title="Nota de voz">${ico('mic')}</button>
    <button class="icono enviar" data-accion="enviar" title="Enviar">${ico('enviar')}</button>
  </div>`;
}
function chat(v) {
  const c = v.contacto ? C(v.contacto) : null, r = v.resp ? U(v.resp) : null;
  return `<header class="ch-cab">
      <button class="icono solo-movil" data-accion="panel" data-p="lista">${ico('atras')}</button>
      <span class="avatar ${v.grupo ? 'grupo' : ''}">${v.grupo ? ico('grupo') : iniciales(c.nombre)}</span>
      <div class="ch-quien"><strong>${esc(nombreConv(v))}</strong><small>${c ? c.tel : 'Grupo'} · por ${esc(N(v.numero).nombre)}</small></div>
      <div class="ch-acc">
        <button class="pastilla ${r ? '' : 'nadie'}" data-accion="asignar">${r ? `<b>${r.ini}</b>${esc(r.nombre)}` : '+ Sin asignar'}</button>
        ${v.estado === 'abierta' ? btn('Finalizar', 'finalizar', 'peligro chico') : ''}
        <button class="icono solo-movil" data-accion="panel" data-p="detalle">${ico('info')}</button>
      </div>
    </header>
    <div class="ch-sub"><span class="ch-ventanas">${textoVentana(v)}${textoGratis(v)}</span><a data-accion="simular">Simular mensaje del cliente</a></div>
    <div class="msgs" id="msgs">${v.msgs.map(burbuja).join('')}</div>
    ${redaccion(v)}`;
}
// Línea que explica qué significa el permiso del contacto para las campañas.
function textoPermiso(c) {
  if (c.consent === 'baja') { const b = DB.bajas.find(x => soloDig(x.tel) === soloDig(c.tel)); return `<small class="nota">${b ? `Desde el ${esc(b.fecha)}, ${{ 'Botón': 'con el botón de baja', 'Palabra BAJA': 'al escribir BAJA', 'Manual': 'lo dio de baja un usuario', 'Rechazo de Meta': 'Meta rechazó el envío' }[b.origen] || esc(b.origen)}${b.campana && b.campana !== '—' ? ', en la campaña ' + esc(b.campana) : ''}. ` : ''}No recibe campañas; sí puedes atenderlo cuando escriba.</small>`; }
  const regla = ' Es solo un registro: no cambia a quién le llegan las campañas; le llegan a todos menos a quien se dio de baja.';
  if (c.consent === 'sin') return '<small class="nota">No ha dicho ni que sí ni que no.' + regla + '</small>';
  return `<small class="nota">Aceptó recibir campañas${c.permiso ? ' el ' + esc(c.permiso.fecha) + ', ' + esc(c.permiso.origen) : ''}.${regla}</small>`;
}
function detalle(v) {
  if (v.grupo) return `<header class="d-cab"><button class="icono solo-movil" data-accion="panel" data-p="chat">${ico('atras')}</button><h3>Grupo</h3></header><div class="d-sec"><h4>${esc(v.grupo)}</h4><p class="nota">Grupo oficial por Cloud API: máximo 8 participantes, ingreso por enlace de invitación.</p><p>Participantes: Mariana Solís, Lucía Fernández, Daniel Ochoa.</p></div>`;
  const c = C(v.contacto), tickets = DB.tickets.filter(k => k.contacto === c.id);
  const todos = [...new Set([...c.tags, ...v.tags])];
  const consent = { otorgado: ['Acepta campañas', 'verde'], baja: ['Se dio de baja', 'rojo'], sin: ['Sin permiso registrado', 'gris'] }[c.consent];
  return `<header class="d-cab"><button class="icono solo-movil" data-accion="panel" data-p="chat">${ico('atras')}</button><h3>Detalle</h3></header>
    <div class="d-sec centro"><span class="avatar grande">${iniciales(c.nombre)}</span><h4>${esc(c.nombre)}${c.especial ? ' ★' : ''}</h4><small>${c.tel}${c.correo ? ' · ' + esc(c.correo) : ''}</small><div>${chipTipo(c)}</div></div>
    <div class="d-sec"><h5>Embudos ${btn('+ Agregar a embudo', 'agregarEmbudo', 'enlace')}</h5>${posDe(c).map(p => `<div class="d-tab"><small>${esc(TB(p.b).n)}</small><div class="d-fila"><select data-cambio="etapa" data-b="${p.b}" data-id="${c.id}">${TB(p.b).etapas.filter(e => !e.inactivo || e.id === p.e).map(e => `<option value="${e.id}" ${p.e === e.id ? 'selected' : ''}>${e.n}</option>`).join('')}</select><a class="quitar" data-accion="quitarEmbudo" data-b="${p.b}" title="Quitar de este embudo">×</a></div>${p.origen === 'clave' ? `<small class="nota">Entró solo por la palabra «${esc(p.clave)}»</small>` : ''}</div>`).join('') || '<small class="nota">No está en ningún embudo. Agrégalo, o entrará solo si escribe una palabra clave de algún embudo.</small>'}</div>
    <div class="d-sec"><h5>Tags ${btn('+ Tag', 'tagModal', 'enlace')}</h5><div class="tags">${todos.length ? todos.map(t => `<span class="tag" style="--c:${TAG(t).c}">${esc(TAG(t).n)}<i data-accion="quitarTag" data-id="${t}">×</i></span>`).join('') : '<small class="nota">Sin tags</small>'}</div></div>
    <div class="d-sec"><h5>Tickets ${puede('AS') ? btn('+ Levantar ticket', 'ticketModal', 'enlace') : ''}</h5>${tickets.length ? tickets.map(k => `<a class="d-ticket" data-accion="verTicket" data-id="${k.id}"><span>#${k.id} · ${esc(k.motivo)}</span>${estadoChip(estadoTk(k))}</a>`).join('') : '<small class="nota">Sin tickets</small>'}</div>
    <div class="d-sec"><h5>Notas internas ${btn('+ Nota', 'notaModal', 'enlace')}</h5>${c.notas.length ? c.notas.map(n => `<div class="d-nota">${esc(n.t)}<small>${esc(U(n.por).nombre)} · ${n.f}</small></div>`).join('') : '<small class="nota">Sin notas</small>'}</div>
    <div class="d-sec"><h5>Permiso para campañas</h5><div class="d-fila">${chip(consent[0], consent[1])}${c.consent === 'sin' ? btn('Registrar que acepta', 'registrarPermiso', 'enlace') : c.consent === 'otorgado' ? btn('Quitar registro', 'quitarPermiso', 'enlace') : ''}${c.consent !== 'baja' ? btn('Dar de baja', 'baja', 'enlace rojo') : ''}</div>${textoPermiso(c)}${v.campana ? `<small class="nota">Llegó por la campaña: ${esc(DB.campanas.find(k => k.id === v.campana).nombre)}</small>` : ''}</div>`;
}
function refrescaChat() {
  if (E.ruta !== 'bandeja') return;
  const m = $('#msgs'); if (m) { m.innerHTML = CONV().msgs.map(burbuja).join(''); m.scrollTop = m.scrollHeight; }
  const l = $('#listaConvs'); if (l) l.innerHTML = filasConv();
}
function enviarMsg(datos) {
  const v = CONV();
  const m = { de: 'a', por: E.usuario, h: ahora(), est: 'enviado', ...datos };
  v.msgs.push(m); v.hora = m.h; v.espera = ''; v.noLeidos = 0;
  refrescaChat();
  setTimeout(() => { m.est = 'entregado'; refrescaChat(); }, 900);
  setTimeout(() => { m.est = 'leido'; refrescaChat(); }, 2400);
}

/* ---------- Embudo ---------- */
function tarjetasDe(b) {
  if (b.tipo === 'tickets') return DB.tickets.map(k => ({ id: String(k.id), e: k.etapa, m: 0, dias: k.dias, titulo: `#${k.id} · ${k.motivo}`, sub: `${C(k.contacto).nombre} · asignado a ${U(k.asignado).nombre}`, ticket: k.id }));
  const base = DB.posiciones.filter(p => p.b === b.id);
  return base.map(p => { const c = C(p.c); return { id: c.id, e: p.e, m: p.m, dias: p.dias, titulo: c.nombre + (c.especial ? ' ★' : ''), sub: `${tipoDe(c)} · ${c.tel}`, contacto: c.id }; });
}
function vEmbudo() {
  if (!TB(E.embudo) || TB(E.embudo).tipo === 'tickets') E.embudo = (DB.embudos.find(x => x.tipo !== 'tickets') || {}).id;
  const b = TB(E.embudo) || DB.embudos[0], esTickets = b.tipo === 'tickets';
  const rg = rangoRep(E.tb), fechaDe = t => hoy0() - t.dias * DIA;
  const ts = tarjetasDe(b).filter(t => !rg || (fechaDe(t) >= rg.a && fechaDe(t) <= rg.b));
  const etFecha = { general: 'Entrada al embudo', tickets: 'Creación del ticket', campana: 'Envío o entrada a la campaña' }[b.tipo];
  const cols = b.etapas.filter(e => !e.inactivo).map(e => {
    const cs = ts.filter(t => t.e === e.id), suma = cs.reduce((s, t) => s + t.m, 0);
    return `<div class="columna" data-etapa="${e.id}"><header style="--c:${e.c}"><strong>${esc(e.n)}</strong><b>${cs.length}</b>${e.tipo !== 'abierta' ? `<small>${esTickets ? 'cierra el ticket' : { ganada: 'Ganada', perdida: 'Perdida' }[e.tipo]}</small>` : ''}${esTickets ? '' : `<span>$${suma.toLocaleString('es-MX')}</span>`}</header>
      <div class="tarjetas">${cs.map(t => `<div class="tarjeta" draggable="true" data-id="${t.id}"><strong>${esc(t.titulo)}</strong><small>${esc(t.sub)}</small><div class="t-pie"><span>${esTickets ? (t.dias ? `hace ${t.dias} d` : 'hoy') : t.m ? '$' + t.m.toLocaleString('es-MX') : '+ monto'}</span><a data-accion="${esTickets ? 'verTicket' : 'chatDe'}" data-id="${esTickets ? t.ticket : t.contacto}">${ico(esTickets ? 'ticket' : 'chat')}</a></div><select class="solo-movil" data-cambio="etapa" data-b="${b.id}" data-id="${t.id}">${b.etapas.filter(x => !x.inactivo || x.id === e.id).map(x => `<option value="${x.id}" ${x.id === e.id ? 'selected' : ''}>${x.n}</option>`).join('')}</select></div>`).join('')}</div></div>`;
  }).join('');
  const acc = `<label class="en-linea">Embudo<select class="sel-embudo" data-cambio="embudo">${DB.embudos.filter(x => x.tipo !== 'tickets').map(x => `<option value="${x.id}" ${x.id === b.id ? 'selected' : ''}>${esc(x.n)}${x.inactivo ? ' · inactivo' : ''} (${tarjetasDe(x).length})</option>`).join('')}</select></label>` + filtroFechas(E.tb, 'tb', true, etFecha) + (puede('A') && !E.movil ? btn('Gestionar etapas', 'gestionarEtapas') + btn('+ Nuevo embudo', 'nuevoEmbudo', 'primario') : '');
  const textoClaves = b.tipo === 'general' ? ` Atiende: ${b.numero ? 'solo el número ' + N(b.numero).nombre : 'todos los números'}. ${filtroTxt(b)}.` : b.tipo === 'campana' ? ` Palabras clave de la campaña: ${(b.claves || []).length ? b.claves.join(', ') : 'ninguna'}.` : b.tipo === 'general' ? ` Atiende: ${b.numero ? 'solo el número ' + N(b.numero).nombre : 'todos los números'}. Palabras clave: ${(b.claves || []).length ? b.claves.join(', ') : 'ninguna'}.` : '';
  const textoTb = textoClaves + ' ' + (rg ? `${etFecha}: del ${fCorta(rg.a)} al ${fCorta(rg.b)}` : `${etFecha}: todas las fechas`) + ` · ${ts.length} ${ts.length === 1 ? 'tarjeta' : 'tarjetas'}`;
  return pagina(`Embudo · ${esc(b.n)}`, `${esc(b.desc || 'Arrastra una tarjeta para cambiar su etapa.')} ${textoTb}`, acc, `<div class="kanban">${cols}</div>`);
}
function embudoDeCampana(k) {
  const id = 'b' + Date.now();
  DB.embudos.push({ id, n: 'Campaña · ' + k.nombre, tipo: 'campana', campana: k.id, claves: (k.claves || '').split(',').map(y => y.trim()).filter(Boolean), desc: 'Se creó sola con la campaña, a partir del modelo de etapas.', etapas: [['Respondió', 'abierta', '#2563eb'], ['Interesado', 'abierta', '#7c3aed'], ['En seguimiento', 'abierta', '#f59e0b'], ['Compró', 'ganada', '#0e9f6e'], ['Sin interés', 'perdida', '#94a3b8']].map((e, i) => ({ id: id + 's' + i, n: e[0], tipo: e[1], c: e[2] })) });
}

/* ---------- Contactos ---------- */
function vContactos() {
  const q = E.buscaContacto.toLowerCase();
  const filas = DB.contactos.filter(c => !q || c.nombre.toLowerCase().includes(q) || c.tel.includes(q)).map(c => ({
    attr: `data-accion="fichaContacto" data-id="${c.id}" class="clic"`,
    c: [`<strong>${esc(c.nombre)}</strong>${c.especial ? ' ★' : ''}`, c.tel, chipTipo(c), c.tags.map(t => `<span class="tag" style="--c:${TAG(t).c}">${esc(TAG(t).n)}</span>`).join('') || '—', chipTab(c) || '<small class="nota">Sin embudo</small>', { otorgado: chip('Acepta campañas', 'verde'), baja: chip('Se dio de baja', 'rojo'), sin: chip('Sin permiso registrado', 'gris') }[c.consent], c.alta]
  }));
  const acc = `<input id="buscaContacto" class="buscador" placeholder="Buscar contacto" value="${esc(E.buscaContacto)}">` + (puede('AS') && !E.movil ? btn('Importar CSV', 'importar') + btn('Exportar CSV', 'exportar') : '') + btn('+ Nuevo contacto', 'nuevoContacto', 'primario');
  return pagina('Contactos', `${DB.contactos.length} contactos`, acc, tabla(['Nombre', 'Teléfono', 'Tipo', 'Tags', 'Embudo y etapa', 'Permiso para campañas', 'Alta'], filas));
}

/* ---------- Tickets ---------- */
function vTickets() {
  const b = ETK(), rg = rangoRep(E.tk), creado = k => hoy0() - k.dias * DIA, vista = E.vistaTk || 'tablero';
  const mios = DB.tickets.filter(k => (E.rol !== 'G' || k.asignado === E.usuario) && (!rg || (creado(k) >= rg.a && creado(k) <= rg.b)));
  const textoTk = (rg ? `Creados del ${fCorta(rg.a)} al ${fCorta(rg.b)}` : 'Creados en cualquier fecha') + ` · ${mios.length} ${mios.length === 1 ? 'ticket' : 'tickets'}`;
  const cuenta = p => mios.filter(k => estadoTk(k) === p).length;
  const resumen = `<div class="resumen-tk">${[['Abierto', 'Pendientes'], ['En proceso', 'En proceso'], ['Cerrado', 'Cerrados']].map(([p, et]) => `<span>${et} <b>${cuenta(p)}</b></span>`).join('')}</div>`;
  const tarjeta = (k, e) => `<div class="tarjeta" draggable="true" data-id="${k.id}"><strong>#${k.id} · ${esc(k.motivo)}</strong><small>${esc(C(k.contacto).nombre)} · asignado a ${esc(U(k.asignado).nombre)}</small><div class="t-pie"><span>${k.dias ? `hace ${k.dias} d` : 'hoy'}</span><a data-accion="verTicket" data-id="${k.id}" title="Abrir ticket">${ico('ticket')}</a></div><select class="solo-movil" data-cambio="etapa" data-b="${b.id}" data-id="${k.id}">${b.etapas.filter(x => !x.inactivo || x.id === e.id).map(x => `<option value="${x.id}" ${x.id === e.id ? 'selected' : ''}>${x.n}</option>`).join('')}</select></div>`;
  const tablero = `<div class="kanban">${b.etapas.filter(e => !e.inactivo).map(e => { const cs = mios.filter(k => k.etapa === e.id); return `<div class="columna" data-etapa="${e.id}"><header style="--c:${e.c}"><strong>${esc(e.n)}</strong><b>${cs.length}</b>${e.tipo !== 'abierta' ? '<small>cierra el ticket</small>' : ''}</header><div class="tarjetas">${cs.map(k => tarjeta(k, e)).join('')}</div></div>`; }).join('')}</div>`;
  const lista = mios.filter(k => estadoTk(k) === E.pestTickets);
  const pests = ['Abierto', 'En proceso', 'Cerrado'].map(p => `<button class="${E.pestTickets === p ? 'activo' : ''}" data-accion="pestTickets" data-p="${p}">${p === 'Abierto' ? 'Pendientes' : p} <b>${cuenta(p)}</b></button>`).join('');
  const vLista = `<div class="pests suelta">${pests}</div><div class="rejilla">${lista.length ? lista.map(k => `<a class="carta clic" data-accion="verTicket" data-id="${k.id}"><div class="c-top"><strong>#${k.id} · ${esc(k.motivo)}</strong>${estadoChip(estadoTk(k))}</div><p>${esc(k.desc)}</p><small>Etapa ${esc(ET(k.etapa).n)} · ${esc(C(k.contacto).nombre)} · asignado a ${esc(U(k.asignado).nombre)} · levantado por ${esc(U(k.por).nombre)} · ${k.creado}</small></a>`).join('') : '<div class="vacio">No hay tickets en esta pestaña.</div>'}</div>`;
  const acc = `<div class="chips-pl">${[['tablero', 'Tablero'], ['lista', 'Lista']].map(([v, et]) => `<button type="button" class="chip-pl ${vista === v ? 'activo' : ''}" data-accion="vistaTk" data-v="${v}">${et}</button>`).join('')}</div>` + filtroFechas(E.tk, 'tk', true, 'Creación del ticket') + (puede('A') && !E.movil ? btn('Gestionar etapas', 'etapasTk') : '');
  return pagina('Tickets', `El embudo de tickets: cada ticket es una tarjeta y su etapa dice si está pendiente, en proceso o cerrado. ${textoTk}`, acc, (vista === 'tablero' ? resumen + tablero : vLista));
}
function verTicket(id) {
  const k = DB.tickets.find(x => x.id === +id);
  const cuerpo = `<div class="d-fila">${estadoChip(estadoTk(k))}<span class="mini" style="--c:${ET(k.etapa).c}">Etapa: ${ET(k.etapa).n}</span><span>${esc(C(k.contacto).nombre)} · asignado a <strong>${esc(U(k.asignado).nombre)}</strong></span></div><p>${esc(k.desc)}</p>
    <h5>Comentarios internos</h5>${k.comentarios.map(c => `<div class="d-nota">${esc(c.t)}<small>${esc(U(c.por).nombre)} · ${c.f}</small></div>`).join('') || '<small class="nota">Aún sin comentarios. El primer comentario pasa el ticket a "En proceso" y registra el tiempo de primera respuesta.</small>'}
    ${estadoTk(k) !== 'Cerrado' ? `<label class="campo"><span>Nuevo comentario</span><textarea id="comTicket" rows="2"></textarea></label>` : ''}`;
  const pie = btn('Ir al chat', 'chatDe', '', `data-id="${k.contacto}"`) + (estadoTk(k) !== 'Cerrado' ? btn('Comentar', 'comentarTicket', '', `data-id="${k.id}"`) + btn('Cerrar ticket', 'cerrarTicket', 'primario', `data-id="${k.id}"`) : btn('Reabrir', 'reabrirTicket', '', `data-id="${k.id}"`));
  abrirModal(`Ticket #${k.id} · ${esc(k.motivo)}`, cuerpo, pie);
}

/* ---------- Campañas ---------- */
// Campañas de entrada: tienen fecha de inicio y de vencimiento, y su estado sale de esas fechas.
const estadoEntrada = k => { const t = Date.now(); return t < new Date(k.inicio) ? 'Programada' : t > new Date(k.fin) ? 'Finalizada' : 'Activa'; };
const rangoEntrada = k => fechaTxt(new Date(k.inicio)) + ' – ' + fechaTxt(new Date(k.fin));
function refrescaEntradas() { for (const k of DB.campanas) if (k.tipo === 'Entrada' && k.inicio) { k.estado = estadoEntrada(k); k.fecha = rangoEntrada(k); } }
// Campaña de entrada: capta con el filtro del embudo elegido; entre sus fechas, quien entra queda ligado a la campaña.
function nuevaEntrada() {
  const n0 = DB.numeros[0].id, ini = aLocal(new Date()), fin = aLocal(new Date(Date.now() + 30 * DIA));
  abrirModal('Campaña de entrada', `<form id="formEnt"><label class="campo"><span>Nombre</span><input name="nombre" value="Campaña de entrada"></label>
    <label class="campo"><span>Número</span><select name="numero" data-cambio="numEnt">${DB.numeros.map(n => `<option value="${n.id}">${esc(n.nombre)}</option>`).join('')}</select></label>
    <div class="campo"><span>Embudo</span><div class="en-fila"><select name="embudo" data-cambio="embEnt">${opsEmbCamp(n0)}</select>${btn('+ Embudo', 'irTagsCamp')}</div></div><div id="filtroEnt">${infoEmbCamp(embudosCamp(n0)[0], true)}</div>
    <label class="campo"><span>Fecha y hora de inicio</span><input type="datetime-local" name="i" value="${ini}"></label><label class="campo"><span>Fecha y hora de vencimiento</span><input type="datetime-local" name="f" value="${fin}"></label>
    <p class="nota">Hora de Ciudad de México. La campaña solo cuenta a quien entra por el filtro del embudo entre estas dos fechas: antes del inicio queda Programada y después del vencimiento queda Finalizada.</p></form>`,
    btn('Cancelar', 'descartarCamp') + btn('Crear campaña', 'crearEntrada', 'primario'));
  restauraBorrador();
}
const camposEntrada = (ini, fin) => [{ id: 'i', et: 'Fecha y hora de inicio', tipo: 'datetime-local', valor: ini }, { id: 'f', et: 'Fecha y hora de vencimiento', tipo: 'datetime-local', valor: fin }, { tipo: 'nota', et: 'Hora de Ciudad de México. La campaña solo cuenta a quien entra por el filtro del embudo entre estas dos fechas: antes del inicio la campaña queda Programada y no hace nada; después del vencimiento queda Finalizada y deja de contar.' }];
const fechasEntrada = f => { const i = new Date(f.i), v = new Date(f.f); if (!f.i || isNaN(i)) { aviso('Falta la fecha de inicio'); return null; } if (!f.f || isNaN(v)) { aviso('Falta la fecha de vencimiento'); return null; } if (v <= i) { aviso('El vencimiento debe ser después del inicio'); return null; } return { inicio: f.i, fin: f.f }; };
function vCampanas() {
  refrescaEntradas();
  const filas = DB.campanas.map(k => ({ attr: `data-accion="verCampana" data-id="${k.id}" class="clic"`, c: [`<strong>${esc(k.nombre)}</strong>`, chip(k.tipo, k.tipo === 'Envío' ? 'azul' : 'gris'), k.plantilla || (k.embudo && TB(k.embudo) ? `Embudo: ${esc(TB(k.embudo).n)}` : `Palabras clave: ${esc(k.claves)}`), estadoChip(k.estado) + (k.errores ? ` <small class="rojo">${k.errores} con error</small>` : ''), k.fecha, k.tipo === 'Envío' ? `<div class="progreso"><i style="width:${Math.round(k.enviados / k.total * 100)}%"></i></div><small>${k.enviados} / ${k.total}</small>` : `${k.total} conversaciones`, k.conversiones] }));
  return pagina('Campañas', 'Envíos masivos con plantilla aprobada y campañas de entrada que captan con el filtro de un embudo', btn('+ Campaña de entrada', 'nuevaEntrada') + btn('+ Nueva campaña', 'nuevaCampana', 'primario'), tabla(['Campaña', 'Tipo', 'Plantilla', 'Estado', 'Fecha', 'Progreso', 'Conversiones'], filas));
}
// Programación de campañas: mínimo 10 minutos después de la fecha y hora actual, en la zona horaria de la empresa.
const MIN_PROG = 10;
const masPronto = () => { const d = new Date(Date.now() + MIN_PROG * 60000); d.setSeconds(0, 0); d.setMinutes(d.getMinutes() + 1); return d; };
const aLocal = d => { const z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; };
const fechaTxt = d => d.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const campoFecha = (valor) => `<label class="campo"><span>Fecha y hora del envío</span><input type="datetime-local" name="cuando" id="cuandoCamp" min="${aLocal(masPronto())}" value="${valor || aLocal(new Date(Date.now() + 3600000))}"></label><p class="nota">Hora de Ciudad de México, la zona horaria de la empresa. Debe ser al menos ${MIN_PROG} minutos después de ahora: lo más pronto que puedes programar es ${fechaTxt(masPronto())}.</p>`;
const fechaValida = v => { const d = new Date(v); if (!v || isNaN(d)) { aviso('Elige la fecha y la hora del envío'); return null; } if (d.getTime() < Date.now() + MIN_PROG * 60000) { aviso(`Debe ser al menos ${MIN_PROG} minutos en el futuro: lo más pronto es ${fechaTxt(masPronto())}`); return null; } return d; };
function nuevaCampana() {
  const aprob = plantillasDe(DB.numeros[0].id).filter(p => p.estado === 'Aprobada');
  abrirModal('Nueva campaña', `<form id="formCamp" class="dos">
    <div><label class="campo"><span>Nombre</span><input name="nombre" value="Promoción de octubre"></label>
    <label class="campo"><span>Número</span><select name="numero" data-cambio="numCamp">${DB.numeros.map(n => `<option value="${n.id}">${esc(n.nombre)}</option>`).join('')}</select></label>
    <label class="campo"><span>1. Plantilla (solo aprobadas)</span><select name="plantilla" data-cambio="previaCamp">${aprob.map(p => `<option>${p.nombre}</option>`).join('')}</select></label>
    <div class="campo"><span>2. Destinatarios</span><select name="aud" data-cambio="audCamp"><option value="lista">Lista de difusión</option><option value="csv">Cargar CSV</option><option value="tags">Segmento por tags</option></select></div>
    ${siHtml(`<label class="campo"><span>Lista</span><select name="lista" data-cambio="listaCamp">${DB.listas.map(l => `<option value="${l.id}">${esc(l.nombre)} (${l.miembros.length})</option>`).join('')}</select></label>`, 'aud', 'lista')}
    ${siHtml(`<div class="campo"><span>Contactos que tengan alguno de estos tags</span><div class="tags-seg">${DB.gruposTags.map(g => g.tags.filter(t => !t.inactivo).map(t => `<label class="check"><input type="checkbox" name="segTag" value="${t.id}" data-cambio="segCamp" ${(campSeg || []).includes(t.id) ? 'checked' : ''}><span class="tag" style="--c:${t.c}">${esc(t.n)}</span></label>`).join('')).join('')}</div><small class="nota">Los datos salen de cada contacto: teléfono, nombre, apellido, nombre completo, correo y tipo.</small></div>`, 'aud', 'tags')}
    ${siHtml(`<div class="campo"><span>Archivo CSV</span><div class="en-fila"><label class="btn">Subir CSV<input type="file" id="csvCamp" accept=".csv,text/csv" hidden></label>${btn('Descargar CSV de ejemplo para esta plantilla', 'csvEjemploCamp', 'enlace')}</div><small class="nota" id="csvNombre">${campDatos ? esc(campDatos.nombre) + ' · ' + campDatos.filas.length + ' filas' : 'Sin archivo. El CSV de ejemplo trae justo las columnas que pide la plantilla.'}</small></div>`, 'aud', 'csv')}
    <div class="campo"><span>3. Datos de la plantilla</span><small class="tipo-p">Elige de qué columna sale cada variable, o pon un valor fijo igual para todos. Meta rechaza el mensaje si una variable va vacía.</small><div id="mapeoCamp"></div><small class="nota" id="cuentaCamp"></small></div>
    <label class="campo"><span>Envío</span><select name="envio" data-cambio="envioCamp"><option>Inmediato</option><option>Programar fecha y hora</option></select></label><div id="progCamp" class="oculto">${campoFecha()}</div>
    <div class="campo"><span>Embudo</span><div class="en-fila"><select name="embudo" data-cambio="embCamp">${opsEmbCamp(DB.numeros[0].id)}</select>${btn('+ Embudo', 'irTagsCamp')}</div></div><div id="filtroCamp">${infoEmbCamp(embudosCamp(DB.numeros[0].id)[0])}</div></div>
    <div><span class="et">Vista previa con datos reales</span><div class="previa" id="previaCamp"></div><div id="navCamp"></div></div></form>`,
    btn('Cancelar', 'descartarCamp') + btn('Revisar antes de enviar', 'revisarCamp', 'primario'), 'ancho extra');
  restauraBorrador();
  aplicarSi(); pintaCamp();
}
const medioPrev = (tipo, a) => a && a.medio === tipo ? (tipo === 'Foto' ? `<img class="pl-img" src="${a.url}" alt="">` : tipo === 'Video' ? `<video class="pl-img" src="${a.url}" controls muted></video>` : `<div class="pl-doc">📄 ${esc(a.nombre)}</div>`) : `<div class="pl-medio">${esc(tipo)}</div>`;
const previaPlantilla = p => `<div class="pl-prev"><div class="msg mio">${!p.tarjetas && p.encTipo && p.encTipo !== 'Ninguno' && p.encTipo !== 'Texto' ? (p.encTipo === 'Ubicación' ? '<div class="pl-medio">Ubicación</div>' : medioPrev(p.encTipo, p.archivo)) : ''}${p.encabezado ? `<strong class="pl-enc">${esc(p.encabezado)}</strong>` : ''}${p.oferta ? `<div class="pl-oferta"><b>${esc(p.oferta)}</b>${p.vence ? '<small>Vence en 2 días</small>' : ''}${p.codigo ? `<small>Código: ${esc(p.codigo)}</small>` : ''}</div>` : ''}<div>${esc(p.cuerpo)}</div>${p.pie ? `<small class="pl-pie">${esc(p.pie)}</small>` : ''}${(p.botones || []).map(b => `<div class="b-boton">${esc(b)}</div>`).join('')}</div>${p.tarjetas ? `<div class="pl-cards">${p.tarjetas.map(t => `<div class="pl-card">${medioPrev(p.encTipo || 'Foto', t.archivo)}<div>${esc(t.texto)}</div>${t.botones.map(b => `<div class="b-boton">${esc(b)}</div>`).join('')}</div>`).join('')}</div>` : ''}</div>`;
// Embudo de una campaña de envío: los embudos generales activos del número elegido, o uno nuevo solo para la campaña.
const embudosCamp = num => DB.embudos.filter(b => b.tipo === 'general' && !b.inactivo && (!b.numero || b.numero === num));
const opsEmbCamp = num => embudosCamp(num).map(b => `<option value="${b.id}">${esc(b.n)}</option>`).join('');
const cuandoFiltro = b => {
  if (filtroDe(b) === 'manual') return 'No aplica: este embudo no tiene filtro, solo se agregan contactos a mano.';
  if (b.aplicar !== 'fechas') return 'Siempre.';
  const t = Date.now(), i = new Date(b.inicio), f = new Date(b.fin), rango = 'Del ' + fechaAnio(i) + ' al ' + fechaAnio(f);
  return rango + (t < i ? ': todavía no empieza.' : t > f ? ': ya terminó.' : ': vigente.') + ' Fuera de esas fechas el filtro no agrega a nadie.';
};
const infoEmbCamp = (b, entrada) => b ? (entrada && filtroDe(b) === 'manual' ? '<div class="info-emb"><small class="rojo">Este embudo no tiene filtro, así que no captaría a nadie. Elige otro o ponle filtro en Tags y embudos.</small></div>' : '') + `<div class="info-emb"><div><b>Primera etapa:</b> ${esc(primeraActiva(b).n)}${b.etapas[0] !== primeraActiva(b) ? ` <small class="nota">(la etapa ${esc(b.etapas[0].n)} está inactiva, así que entran aquí)</small>` : ''}</div><small class="nota">Filtro de este embudo (solo lectura; se cambia en Tags y embudos)</small><div><b>Filtrar por:</b> ${esc(filtroDe(b) === 'claves' ? 'palabras clave ' + b.claves.join(', ') : filtroDe(b) === 'regex' ? 'expresión regular ' + b.regex : 'ninguno')}</div><div><b>Se aplica:</b> ${esc(cuandoFiltro(b))}</div><small class="nota">${entrada ? 'Quien escriba algo que cumpla el filtro entra a la primera etapa; si es entre las fechas de esta campaña, además queda ligado a ella.' : 'Quien responda la campaña entra a la primera etapa aunque el filtro esté fuera de fechas.'}</small></div>` : '<div class="info-emb"><small class="rojo">Este número no tiene embudos activos. Crea uno en Tags y embudos.</small></div>';
// Borrador de la campaña: se guarda al ir a Tags y embudos o a la revisión, y se recupera al volver.
let campBorrador = null;
const guardaBorrador = () => { const f = $('#formCamp') || $('#formEnt'); if (f) campBorrador = { ...Object.fromEntries(new FormData(f)), _tipo: f.id === 'formEnt' ? 'entrada' : 'envio' }; };
function restauraBorrador() {
  const f = $('#formCamp') || $('#formEnt'), b = campBorrador; if (!f || !b || (f.id === 'formEnt') !== (b._tipo === 'entrada')) return;
  if (f.id === 'formEnt') { ['nombre', 'numero', 'embudo', 'i', 'f'].forEach(n => { if (b[n] != null && f.elements[n]) { f.elements[n].value = b[n]; if (n === 'numero' || n === 'embudo') f.elements[n].dispatchEvent(new Event('change', { bubbles: true })); } }); return; }
  const pon = (n, ev) => { if (f.elements[n] && b[n] != null && [...(f.elements[n].options || [{ value: b[n] }])].some(o => o.value === b[n] || o.text === b[n])) { f.elements[n].value = b[n]; if (ev) f.elements[n].dispatchEvent(new Event('change', { bubbles: true })); } };
  pon('nombre'); pon('numero', true); pon('plantilla', true); pon('embudo', true); pon('aud'); pon('envio', true); if (f.elements.cuando && b.cuando) f.elements.cuando.value = b.cuando;
}
/* ---------- Campaña: variables de la plantilla y datos de los destinatarios ----------
   Meta pide al enviar un valor para cada variable de la plantilla, y rechaza el mensaje si alguna va vacía.
   1) Se elige la plantilla: de ahí salen sus variables (encabezado, cuerpo, final de enlaces, tarjetas, código).
   2) Se eligen los destinatarios: una lista de difusión o un CSV. Sus columnas son los datos disponibles.
   3) Emparejado: cada variable se toma de una columna, o lleva un valor fijo igual para todos.
   4) La vista previa muestra una fila real, con flechas para recorrerlas, y la revisión cuenta quién queda fuera. */
let campDatos = null, campMapeo = {}, campFila = 0, campArchivo = null, campSeg = [];
const plCamp = () => { const f = $('#formCamp'); if (!f) return null; return plantillasDe(f.elements.numero.value).find(p => p.nombre === f.elements.plantilla.value) || null; };
// Variables que pide la plantilla al enviarse, con su clave de envío y un nombre de columna sugerido.
function varsCamp(p) {
  if (!p) return [];
  const v = [], ej = p.ejemplos || {};
  varsDe(p.encabezado).forEach(k => v.push({ key: 'h_' + k, et: 'Encabezado {{' + k + '}}', col: 'encabezado_' + k, ej: (ej.h || {})[k] }));
  if (esAuth(p)) v.push({ key: 'b_1', et: 'Código de verificación', col: 'codigo_verificacion', ej: '483920' });
  else varsDe(p.cuerpo).forEach(k => v.push({ key: 'b_' + k, et: 'Cuerpo {{' + k + '}}', col: 'cuerpo_' + k, ej: (ej.b || {})[k] }));
  if (p.btnVars && p.btnVars.length) p.btnVars.forEach(x => v.push({ key: 'u_' + x.index, et: 'Final del enlace «' + x.texto + '» (índice ' + x.index + ')', col: 'enlace_' + x.index, ej: x.ej }));
  else if (p.urlVar) v.push({ key: 'u', et: 'Final del enlace «' + btnUrl(p) + '»', col: 'enlace', ej: ej.u });
  (p.tarjetas || []).forEach((t, i) => { varsDe(t.texto).forEach(k => v.push({ key: 'c' + i + '_' + k, et: 'Tarjeta ' + (i + 1) + ' {{' + k + '}}', col: 'tarjeta' + (i + 1) + '_' + k, ej: ((ej.c || [])[i] || {})[k] })); (t.btnVars || []).forEach(x => v.push({ key: 'c' + i + '_u' + x.index, et: 'Tarjeta ' + (i + 1) + ': final del enlace «' + x.texto + '»', col: 'tarjeta' + (i + 1) + '_enlace', ej: x.ej })); });
  if (p.codigo) v.push({ key: 'codigo', et: 'Código del cupón', col: 'codigo', ej: p.codigo });
  return v;
}
// Filas y columnas de los destinatarios elegidos.
function datosDestinatarios() {
  const f = $('#formCamp'); if (!f) return { columnas: [], filas: [] };
  if (f.elements.aud.value === 'csv') return campDatos || { columnas: [], filas: [] };
  if (f.elements.aud.value === 'tags') { const cs = DB.contactos.filter(c => c.tags.some(t => (campSeg || []).includes(t))); return { columnas: ['telefono', 'nombre', 'apellido', 'nombre_completo', 'correo', 'tipo'], filas: cs.map(c => { const [n, ...a] = c.nombre.split(' '); return { telefono: c.tel, nombre: n, apellido: a.join(' '), nombre_completo: c.nombre, correo: c.correo || '', tipo: c.tipo || '' }; }) }; }
  const l = DB.listas.find(x => x.id === f.elements.lista.value); if (!l) return { columnas: [], filas: [] };
  return { columnas: ['telefono', 'nombre', 'apellido', 'tipo'], filas: l.miembros.map(m => ({ telefono: m.tel, nombre: m.nombre, apellido: m.apellido || '', tipo: m.tipo || '' })) };
}
const sugerirCol = (v, cols) => cols.find(c => c.toLowerCase() === v.col) || (v.key === 'b_1' && cols.includes('nombre') && !esAuth(plCamp() || {}) ? 'nombre' : '');
function leeCsv(texto) {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter(x => x.trim());
  const parte = l => { const out = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur.trim()); cur = ''; } else cur += ch; } out.push(cur.trim()); return out; };
  const cab = parte(lineas[0] || '').map(x => x.toLowerCase());
  return { columnas: cab, filas: lineas.slice(1).map(l => { const v = parte(l); return Object.fromEntries(cab.map((c, i) => [c, v[i] || ''])); }) };
}
// Valores de las variables para una fila, según el emparejado.
function valoresFila(fila, vars) { return Object.fromEntries(vars.map(v => { const m = campMapeo[v.key] || {}; return [v.key, m.fijo ? (m.valor || '') : ((fila || {})[m.col] || '')]; })); }
const colTel = () => (campMapeo._tel || {}).col || 'telefono';
function evaluarCamp() {
  const p = plCamp(), vars = varsCamp(p), d = datosDestinatarios(), vistos = new Set(), r = { total: d.filas.length, invalidos: 0, repetidos: 0, bajas: 0, vacias: 0, final: 0 };
  const bajas = new Set(DB.bajas.map(b => soloDig(b.tel)));
  d.filas.forEach(f => {
    const tel = soloDig(f[colTel()] || ''), conLada = tel.length === 10 ? '52' + tel : tel;
    if (conLada.length < 11 || conLada.length > 15) return r.invalidos++;
    if (vistos.has(conLada)) return r.repetidos++; vistos.add(conLada);
    if (bajas.has(tel) || bajas.has(conLada)) return r.bajas++;
    const vals = valoresFila(f, vars); if (vars.some(v => !(vals[v.key] || '').trim())) return r.vacias++;
    r.final++;
  });
  return r;
}
function mapeoHtml() {
  const p = plCamp(), vars = varsCamp(p), d = datosDestinatarios(), cols = d.columnas;
  if (!campMapeo._tel) campMapeo._tel = { col: cols.find(c => /^(telefono|teléfono|tel|celular|whatsapp)$/.test(c)) || '' };
  vars.forEach(v => { if (!campMapeo[v.key]) campMapeo[v.key] = { col: sugerirCol(v, cols) }; });
  const ops = (sel, extraFijo) => `<option value="">Elige una columna</option>${cols.map(c => `<option ${c === sel ? 'selected' : ''}>${esc(c)}</option>`).join('')}${extraFijo ? `<option value="__fijo" ${extraFijo === 'sel' ? 'selected' : ''}>Valor fijo (igual para todos)</option>` : ''}`;
  const filas = vars.map(v => { const m = campMapeo[v.key]; return `<div class="map-fila"><span class="map-var">${esc(v.et)}</span><select name="map_${v.key}">${ops(m.fijo ? '' : m.col, m.fijo ? 'sel' : 'si')}</select>${m.fijo ? `<input name="fijo_${v.key}" value="${esc(m.valor || '')}" placeholder="${v.ej ? 'Ej. ' + esc(v.ej) : 'Valor para todos'}">` : ''}</div>`; }).join('');
  const sinVars = !vars.length ? '<p class="nota">Esta plantilla no tiene variables: todos reciben el mismo mensaje.</p>' : '';
  const medio = p && !p.tarjetas && ['Foto', 'Video', 'Documento'].includes(p.encTipo) ? `<div class="map-fila"><span class="map-var">${esc(p.encTipo)} del encabezado (igual para todos)</span><label class="btn">Subir archivo<input type="file" id="medioCamp" hidden></label><small class="nota">${campArchivo ? esc(campArchivo.nombre) : 'Sin archivo'}</small></div>` : '';
  const vence = p && p.oferta && p.vence ? `<div class="map-fila"><span class="map-var">La oferta vence el (igual para todos)</span><input type="datetime-local" name="venceCamp" value="${aLocal(new Date(Date.now() + 2 * DIA))}"></div>` : '';
  return `<div class="map-fila"><span class="map-var">Teléfono del destinatario *</span><select name="map__tel">${ops(campMapeo._tel.col)}</select></div>${filas}${medio}${vence}${sinVars}${!cols.length ? '<p class="nota">Elige una lista o sube el CSV para emparejar las columnas.</p>' : ''}`;
}
function pintaCamp() {
  const p = plCamp(), w = $('#mapeoCamp'), pv = $('#previaCamp'); if (!w || !pv) return;
  w.innerHTML = mapeoHtml();
  const d = datosDestinatarios(), vars = varsCamp(p); campFila = Math.max(0, Math.min(campFila, d.filas.length - 1));
  if (!p) { pv.innerHTML = '<p class="nota">Este número no tiene plantillas aprobadas.</p>'; $('#navCamp').innerHTML = ''; return; }
  const fila = d.filas[campFila], vals = valoresFila(fila, vars);
  const vacia = t => (t || '').replace(/\{\{(\w+)\}\}/g, '[vacío]');
  const q = { ...p, archivo: campArchivo || p.archivo, encabezado: vacia(llenar(p.encabezado, 'h_', vals)), cuerpo: vacia(llenar(p.cuerpo, 'b_', vals)), codigo: vals.codigo || p.codigo, tarjetas: p.tarjetas ? p.tarjetas.map((t, i) => ({ ...t, texto: vacia(llenar(t.texto, 'c' + i + '_', vals)) })) : undefined };
  pv.innerHTML = previaPlantilla(q);
  const faltan = vars.filter(v => !(vals[v.key] || '').trim());
  $('#navCamp').innerHTML = d.filas.length ? `<div class="nav-fila">${btn('‹', 'filaCamp', 'icono-bt', `data-d="-1" ${campFila === 0 ? 'disabled' : ''}`)}<span>Fila ${campFila + 1} de ${d.filas.length}: <b>${esc([fila.nombre, fila.apellido].filter(Boolean).join(' ') || fila[colTel()] || '')}</b> · ${esc(fila[colTel()] || 'sin teléfono')}</span>${btn('›', 'filaCamp', 'icono-bt', `data-d="1" ${campFila >= d.filas.length - 1 ? 'disabled' : ''}`)}</div>${faltan.length ? `<small class="rojo">Esta fila no tiene ${faltan.map(v => v.et).join(', ')}: se excluye, porque Meta rechaza una variable vacía.</small>` : '<small class="nota">Así le llega a este destinatario.</small>'}` : '<small class="nota">La vista previa muestra los datos reales cuando eliges los destinatarios.</small>';
  const r = evaluarCamp(); $('#cuentaCamp').innerHTML = d.filas.length ? `${r.final} de ${r.total} destinatarios listos${r.total - r.final ? ` · ${r.total - r.final} se excluyen (ver revisión)` : ''}` : '';
}
function csvEjemploCamp() {
  const p = plCamp(); if (!p) return aviso('Elige una plantilla');
  const vars = varsCamp(p), cab = ['telefono', 'nombre', 'apellido', ...vars.map(v => v.col)], fila = ['8155501234', 'María', 'López', ...vars.map(v => v.ej || 'ejemplo')];
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + cab.join(',') + '\n' + fila.map(x => /[,"]/.test(x) ? '"' + String(x).replace(/"/g, '""') + '"' : x).join(',') + '\n'], { type: 'text/csv;charset=utf-8' })); a.download = 'campana-' + p.nombre + '.csv'; a.click();
  aviso('CSV de ejemplo descargado con las columnas que pide ' + p.nombre + ': ' + cab.join(', '));
}
let campPendiente = null;
function revisarCamp() {
  const f = new FormData($('#formCamp'));
  if (!f.get('embudo')) return aviso('Elige un embudo; si no hay, créalo en Tags y embudos');
  guardaBorrador();
  const programada = f.get('envio').startsWith('Programar'), cuando = programada ? fechaValida(f.get('cuando')) : null;
  if (programada && !cuando) return;
  const pl = plCamp(); if (!pl) return aviso('Elige una plantilla aprobada');
  const vars = varsCamp(pl), d = datosDestinatarios();
  if (!d.filas.length) return aviso(f.get('aud') === 'csv' ? 'Sube el CSV de destinatarios' : f.get('aud') === 'tags' ? 'Elige al menos un tag con contactos' : 'La lista no tiene contactos');
  if (!(campMapeo._tel || {}).col) return aviso('Elige la columna del teléfono');
  const sinMapa = vars.find(v => { const m = campMapeo[v.key] || {}; return m.fijo ? !(m.valor || '').trim() : !m.col; }); if (sinMapa) return aviso('Falta decir de dónde sale: ' + sinMapa.et);
  if (!pl.tarjetas && ['Foto', 'Video', 'Documento'].includes(pl.encTipo) && !campArchivo) return aviso('Sube el archivo del encabezado');
  const r = evaluarCamp(); if (!r.final) return aviso('Ningún destinatario queda listo: revisa el emparejado de columnas');
  const precio = { Marketing: 0.0436, Utilidad: 0.0080, 'Autenticación': 0.0080 }[pl.cat] || 0.0436;
  campPendiente = { nombre: f.get('nombre') || 'Campaña sin nombre', plantilla: f.get('plantilla'), numero: f.get('numero'), programada, cuando, embudo: f.get('embudo'), total: r.final, mapeo: JSON.parse(JSON.stringify(campMapeo)), fuente: f.get('aud') === 'csv' ? 'CSV ' + (campDatos ? campDatos.nombre : '') : f.get('aud') === 'tags' ? 'Segmento por tags: ' + campSeg.map(t => TAG(t).n).join(', ') : 'Lista ' + (DB.listas.find(x => x.id === f.get('lista')) || {}).nombre, r, precio, cat: pl.cat };
  abrirModal('Revisión antes de enviar', `<p>El sistema limpia la audiencia y respeta el límite diario de Meta.</p>
    <div class="resumen"><div><small>Cargados</small><strong>${campPendiente.r.total}</strong></div><div class="rojo"><small>Bajas excluidas</small><strong>${campPendiente.r.bajas}</strong></div><div class="ambar"><small>Repetidos</small><strong>${campPendiente.r.repetidos}</strong></div><div class="ambar"><small>Teléfono inválido</small><strong>${campPendiente.r.invalidos}</strong></div><div class="ambar"><small>Variable vacía</small><strong>${campPendiente.r.vacias}</strong></div><div class="verde"><small>Se enviará a</small><strong>${campPendiente.r.final}</strong></div></div><div class="d-fila"><span>Destinatarios</span><strong>${esc(campPendiente.fuente)}</strong></div>
    <div class="d-fila"><span>Costo estimado (${campPendiente.cat}, ${campPendiente.r.final} × US$${campPendiente.precio})</span><strong>US$${(campPendiente.r.final * campPendiente.precio).toFixed(2)}</strong></div>
    <div class="d-fila"><span>Cupo disponible hoy</span><strong>1,480 de 2,000</strong></div>
    ${campPendiente.programada ? `<div class="d-fila"><span>Se enviará</span><strong>${fechaTxt(campPendiente.cuando)} · hora de Ciudad de México</strong></div>` : ''}
    <div class="d-fila"><span>Embudo</span><strong>${esc(TB(campPendiente.embudo).n)}</strong></div>
    <p class="nota">Alcanza en un solo día. Los botones de enlace se cambian por un enlace corto para saber quién hizo clic.</p>`,
    btn('Regresar', 'nuevaCampana') + btn(campPendiente.programada ? 'Programar campaña' : 'Enviar ahora', 'confirmarCamp', 'primario'));
}
function confirmarCamp() {
  const k = { id: 'k' + Date.now(), tipo: 'Envío', ...campPendiente, estado: campPendiente.programada ? 'Programada' : 'Enviando', fecha: campPendiente.programada ? fechaTxt(campPendiente.cuando) : 'hoy ' + ahora(), total: campPendiente.total || 0, enviados: 0, entregados: 0, leidos: 0, respuestas: 0, clics: 0, bajas: 0, conversiones: 0, errores: 0 };
  DB.campanas.unshift(k); campBorrador = null; campDatos = null; campMapeo = {}; campArchivo = null; campFila = 0; campSeg = []; cerrarModal(); render();
  if (k.estado === 'Programada') return aviso('Campaña programada para ' + k.fecha);
  aviso('Envío iniciado: se envía por lotes');
  const t = setInterval(() => {
    k.enviados = Math.min(k.total, k.enviados + 65);
    if (k.enviados >= k.total) { k.estado = 'Enviada'; k.entregados = 498; k.errores = 6; clearInterval(t); aviso(`"${k.nombre}" terminó de enviarse`); }
    if (E.ruta === 'campanas' && $('#modal').className) render();
  }, 700);
}
function verCampana(id) {
  refrescaEntradas();
  const k = DB.campanas.find(x => x.id === id);
  const d = [['Enviados', k.enviados], ['Entregados', k.entregados], ['Leídos', k.leidos], ['Respuestas', k.respuestas], ['Clics', k.clics], ['Bajas', k.bajas], ['Conversiones', k.conversiones], ['Con error', k.errores]];
  abrirModal(esc(k.nombre), `<div class="d-fila">${estadoChip(k.estado)}<span>${k.tipo} · ${k.fecha} · ${N(k.numero).nombre}</span></div><div class="resumen">${d.map(x => `<div><small>${x[0]}</small><strong>${x[1]}</strong></div>`).join('')}</div>${k.tipo === 'Envío' || k.embudo ? `<div class="d-fila"><span>Embudo</span><span>${k.embudo && TB(k.embudo) ? esc(TB(k.embudo).n) : 'Campaña · ' + esc(k.nombre)}</span></div>` : `<div class="d-fila"><span>Palabras clave</span><span>${k.claves ? esc(k.claves) : 'ninguna'}</span></div>`}<p class="nota">La conversión cuenta cuando el contacto llega a una etapa ganada dentro de los 15 días siguientes a la campaña.</p>`, (k.tipo === 'Entrada' && k.inicio && k.estado !== 'Finalizada' ? btn('Editar fechas', 'fechasCamp', '', `data-id="${k.id}"`) : '') + (k.estado === 'Programada' && k.tipo !== 'Entrada' ? btn('Cancelar campaña', 'cancelarCamp', 'peligro', `data-id="${k.id}"`) + btn('Reprogramar', 'reprogramarCamp', '', `data-id="${k.id}"`) : '') + (DB.embudos.some(b => b.campana === k.id) ? btn('Ver embudo de la campaña', 'selEmbudo', '', `data-id="${DB.embudos.find(b => b.campana === k.id).id}"`) : '') + btn('Cerrar', 'cerrarModal'), 'ancho');
}

/* ---------- Pantallas de configuración ---------- */
const soloDig = t => String(t).replace(/\D/g, '');
const normTel = t => { let d = soloDig(t); if (d.length === 10) d = '52' + d; return d.length >= 11 && d.length <= 15 ? '+' + d : null; };
const esBaja = tel => DB.bajas.some(b => soloDig(b.tel) === soloDig(tel));
function vListas() {
  return pagina('Listas de difusión', 'Listas guardadas que se envían como campaña con plantilla aprobada. Haz clic en una lista para ver sus contactos.', btn('+ Nueva lista', 'nuevaLista', 'primario'), tabla(['Lista', 'Contactos', 'Se dieron de baja', 'Creada', ''], DB.listas.map(l => ({ attr: `data-accion="verLista" data-id="${l.id}" class="clic"`, c: [`<strong>${esc(l.nombre)}</strong>`, l.miembros.length, l.miembros.filter(m => esBaja(m.tel)).length, l.creada, btn('Usar en campaña', 'nuevaCampana', 'enlace')] }))));
}
// Lee el CSV de una lista: columnas nombre, apellido, telefono. No falla todo el archivo: cuenta lo que rechaza y por qué.
function leerCsvLista(texto, existentes) {
  const filas = texto.replace(/^\uFEFF/, '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => l.split(/[,;\t]/).map(x => x.trim().replace(/^"|"$/g, '')));
  if (filas.length && /nombre/i.test(filas[0][0])) filas.shift();
  const r = { leidas: filas.length, ok: [], invalidos: 0, duplicados: 0, bajas: 0 }, vistos = new Set(existentes.map(m => soloDig(m.tel)));
  for (const [nombre, apellido, tel] of filas) {
    const t = normTel(tel || '');
    if (!nombre || !t) { r.invalidos++; continue; }
    if (vistos.has(soloDig(t))) { r.duplicados++; continue; }
    vistos.add(soloDig(t));
    if (esBaja(t)) { r.bajas++; continue; }
    r.ok.push({ nombre, apellido: apellido || '', tel: t, tipo: 'Importado' });
  }
  return r;
}
const camposCsv = () => `<label class="campo"><span>Archivo CSV con nombre, apellido y teléfono</span><input type="file" id="lstCsv" accept=".csv,text/csv"></label><div class="d-fila">${btn('Descargar plantilla de carga', 'plantillaCsv')}<small>Trae los encabezados exactos y una fila de ejemplo.</small></div>`;
function cargarCsv(lista, alTerminar) {
  const a = $('#lstCsv').files[0]; if (!a) return aviso('Falta elegir el archivo CSV');
  const lector = new FileReader();
  lector.onload = () => {
    const r = leerCsvLista(String(lector.result), lista.miembros);
    lista.miembros.push(...r.ok); alTerminar();
    abrirModal('Resultado de la carga', `<p>Lista <strong>${esc(lista.nombre)}</strong></p><div class="resumen"><div><small>Filas leídas</small><strong>${r.leidas}</strong></div><div class="verde"><small>Agregados</small><strong>${r.ok.length}</strong></div><div class="rojo"><small>Teléfono o nombre inválido</small><strong>${r.invalidos}</strong></div><div class="ambar"><small>Repetidos</small><strong>${r.duplicados}</strong></div><div class="rojo"><small>Se dieron de baja, excluidos</small><strong>${r.bajas}</strong></div></div><p class="nota">Los teléfonos de 10 dígitos se guardan con la lada de México (+52).</p>`, btn('Ver la lista', 'verLista', 'primario', `data-id="${lista.id}"`));
  };
  lector.readAsText(a);
}
function filasLista(l) {
  const q = (E.buscaLista || '').toLowerCase();
  const ms = l.miembros.filter(m => !q || (m.nombre + ' ' + m.apellido).toLowerCase().includes(q) || soloDig(m.tel).includes(soloDig(q) || '#'));
  return ms.length ? ms.map(m => `<tr><td><strong>${esc(m.nombre)} ${esc(m.apellido)}</strong></td><td>${esc(m.tel)}</td><td>${chip(m.tipo, 'azul')}</td><td>${esBaja(m.tel) ? chip('Se dio de baja', 'rojo') : chip('Recibe campañas', 'verde')}</td><td>${btn('Quitar', 'quitarDeLista', 'enlace rojo', `data-id="${l.id}" data-tel="${esc(m.tel)}"`)}</td></tr>`).join('') : '<tr><td colspan="5" class="vacio">Sin contactos</td></tr>';
}
function verLista(id) {
  const l = DB.listas.find(x => x.id === id), bajas = l.miembros.filter(m => esBaja(m.tel)).length;
  E.listaAbierta = id;
  abrirModal(esc(l.nombre), `<div class="resumen"><div><small>Contactos</small><strong>${l.miembros.length}</strong></div><div class="rojo"><small>Se dieron de baja</small><strong>${bajas}</strong></div><div class="verde"><small>Recibirían una campaña</small><strong>${l.miembros.length - bajas}</strong></div></div>
    <input id="buscaLista" placeholder="Buscar en la lista por nombre o teléfono" value="${esc(E.buscaLista || '')}">
    <div class="tabla-caja" style="margin-top:10px"><table><thead><tr><th>Nombre</th><th>Teléfono</th><th>Tipo</th><th>Permiso para campañas</th><th></th></tr></thead><tbody id="filasLista">${filasLista(l)}</tbody></table></div>`,
    btn('Agregar más por CSV', 'masCsvLista', '', `data-id="${l.id}"`) + btn('Usar en campaña', 'nuevaCampana', 'primario'), 'ancho');
}
// Filtro general de fechas de Reportes: un solo rango manda sobre todo lo que se ve, y la comparación sigue al rango elegido.
const DIA = 86400000;
const hoy0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const fCorta = d => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
function rangoRep(r = E.rep) {
  if (r.pre === 'todo') return null;
  const h = hoy0(); let a, b;
  if (r.pre === 'hoy') a = b = h;
  else if (r.pre === 'mes') { a = new Date(h.getFullYear(), h.getMonth(), 1); b = h; }
  else if (r.pre === 'per') { a = new Date(r.desde + 'T00:00'); b = new Date(r.hasta + 'T00:00'); }
  if (!a || isNaN(a) || isNaN(b) || a > b) { a = new Date(h - 6 * DIA); b = h; }
  const dias = Math.round((b - a) / DIA) + 1; let pa, pb;
  if (r.pre === 'mes') { pa = new Date(a.getFullYear(), a.getMonth() - 1, 1); pb = new Date(pa.getFullYear(), pa.getMonth(), Math.min(dias, new Date(a.getFullYear(), a.getMonth(), 0).getDate())); }
  else { pb = new Date(a - DIA); pa = new Date(pb - (dias - 1) * DIA); }
  return { a, b, pa, pb, dias };
}
function filtroFechas(r = E.rep, pref = 'rep', todo = false, etiqueta = 'Fechas') {
  const ops = [...(todo ? [['todo', 'Todas las fechas']] : []), ['hoy', 'Hoy'], ['7', 'Últimos 7 días'], ['mes', 'Este mes'], ['per', 'Rango personalizado']], tope = aLocal(hoy0()).slice(0, 10);
  return `<label class="en-linea">${etiqueta}<select data-cambio="${pref}Pre">${ops.map(o => `<option value="${o[0]}" ${r.pre === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></label>` + (r.pre === 'per' ? `<label class="en-linea">Del<input type="date" data-cambio="${pref}Desde" value="${r.desde}" max="${tope}"></label><label class="en-linea">al<input type="date" data-cambio="${pref}Hasta" value="${r.hasta}" max="${tope}"></label>` : '');
}
// Reportes: el número elegido arriba manda sobre toda la pantalla, igual que el rango de fechas.
const PESO_NUMERO = { n1: 0.62, n2: 0.38 }; // reparto de los datos de ejemplo entre los dos números
const enNumero = convId => !E.repNum || (DB.conversaciones.find(v => v.id === convId) || {}).numero === E.repNum;
const hFmt = h => h < 1 ? Math.round(h * 60) + ' min' : h < 48 ? Math.round(h) + ' h' : Math.round(h / 24) + ' d';
const promedio = xs => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
function cartaEmbudo(rg) {
  const lista = DB.embudos.filter(b => b.tipo !== 'tickets');
  if (!lista.some(b => b.id === E.repEmb)) E.repEmb = lista[0].id;
  const b = TB(E.repEmb), fechaDe = p => hoy0() - p.dias * DIA;
  const ps = DB.posiciones.filter(p => p.b === b.id && fechaDe(p) >= rg.a && fechaDe(p) <= rg.b && (!E.repNum || DB.conversaciones.some(v => v.contacto === p.c && v.numero === E.repNum)));
  const total = ps.length, max = Math.max(1, ...b.etapas.map(e => ps.filter(p => p.e === e.id).length));
  const cuenta = t => ps.filter(p => ET(p.e).tipo === t).length, pct = x => total ? Math.round(x / total * 100) + '%' : '—';
  return `<div class="carta"><div class="c-top"><h3>Conversión por embudo</h3><select data-cambio="repEmb" class="sel-embudo">${lista.map(x => `<option value="${x.id}" ${x.id === b.id ? 'selected' : ''}>${esc(x.n)}</option>`).join('')}</select></div>
    ${b.etapas.map(e => { const c = ps.filter(p => p.e === e.id).length; return `<div class="emb"><span>${esc(e.n)}</span><div><i style="width:${c / max * 100}%;background:${e.c}"></i></div><b>${c}</b></div>`; }).join('')}
    <div class="resumen"><div><small>Contactos que entraron</small><strong>${total}</strong></div><div class="verde"><small>Ganada</small><strong>${cuenta('ganada')} · ${pct(cuenta('ganada'))}</strong></div><div class="rojo"><small>Perdida</small><strong>${cuenta('perdida')} · ${pct(cuenta('perdida'))}</strong></div><div><small>En proceso</small><strong>${cuenta('abierta')}</strong></div></div>
    <p class="nota">Cuenta los contactos que entraron a este embudo en el rango de fechas${E.repNum ? ' y que escribieron al número elegido' : ''}.</p></div>`;
}
function seccionTickets(rg) {
  const creado = k => hoy0() - k.dias * DIA;
  const ts = DB.tickets.filter(k => creado(k) >= rg.a && creado(k) <= rg.b && enNumero(k.conv) && (E.rol !== 'G' || k.asignado === E.usuario));
  const abiertos = ts.filter(k => estadoTk(k) !== 'Cerrado'), cerrados = ts.filter(k => estadoTk(k) === 'Cerrado');
  const prim = promedio(ts.filter(k => k.primera).map(k => k.primera / 60)), cie = promedio(cerrados.filter(k => k.cierreH).map(k => k.cierreH));
  const kp = [['Levantados', ts.length], ['Siguen abiertos', abiertos.length], ['Cerrados', cerrados.length], ['Primera respuesta promedio', prim === null ? '—' : hFmt(prim)], ['Tiempo promedio de cierre', cie === null ? '—' : hFmt(cie)]];
  const agentes = [...new Set(ts.map(k => k.asignado))].map(id => { const m = ts.filter(k => k.asignado === id), p = promedio(m.filter(k => k.primera).map(k => k.primera / 60)), c = promedio(m.filter(k => estadoTk(k) === 'Cerrado' && k.cierreH).map(k => k.cierreH)); return { c: [esc(U(id).nombre), m.length, m.filter(k => estadoTk(k) !== 'Cerrado').length, m.filter(k => estadoTk(k) === 'Cerrado').length, p === null ? '—' : hFmt(p), c === null ? '—' : hFmt(c)] }; });
  const motivos = [...new Set(ts.map(k => k.motivo))].map(mo => ({ c: [esc(mo), ts.filter(k => k.motivo === mo).length, ts.filter(k => k.motivo === mo && estadoTk(k) !== 'Cerrado').length] }));
  return `<h3 class="sub">Resultados de tickets</h3><div class="indicadores suelta">${kp.map(k => `<div class="ind"><small>${k[0]}</small><strong>${k[1]}</strong></div>`).join('')}</div>
    ${ts.length ? `<div class="rejilla dos"><div>${tabla(['Asignado a', 'Tickets', 'Abiertos', 'Cerrados', 'Primera respuesta', 'Cierre'], agentes)}</div><div>${tabla(['Motivo', 'Tickets', 'Abiertos'], motivos)}</div></div>` : '<p class="nota">No hay tickets levantados en este rango.</p>'}`;
}
function vReportes() {
  const rg = rangoRep(), fac = rg.dias / 7 * (E.repNum ? PESO_NUMERO[E.repNum] || 0.5 : 1), n = v => Math.max(1, Math.round(v * fac)).toLocaleString('es-MX');
  const textoRango = `${E.repNum ? 'Número ' + N(E.repNum).nombre : 'Todos los números'} · del ${fCorta(rg.a)} al ${fCorta(rg.b)} (${rg.dias} ${rg.dias === 1 ? 'día' : 'días'}), comparado con el periodo anterior: del ${fCorta(rg.pa)} al ${fCorta(rg.pb)}`;
  const selNumero = `<label class="en-linea">Número<select data-cambio="repNum"><option value="">Todos los números</option>${DB.numeros.map(x => `<option value="${x.id}" ${E.repNum === x.id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></label>`;
  const R = DB.reporte, max = Math.max(...R.dias.map(d => d[1])), maxE = R.embudo[0][1];
  const kp = E.rol === 'G' ? [['Mis conversaciones', n(62)], ['Cerradas', n(51)], ['Primera respuesta', '6 min'], ['Resolución', '2 h 05 min']] : [['Mensajes recibidos', n(1254), '+8%'], ['Mensajes enviados (total)', n(1112), '+6%', 'todo lo que salió: agentes, automáticos y plantillas'], ['Plantillas enviadas', n(197), '+11%', `parte de los enviados (${Math.round(197 / 1112 * 100)}%) · son las que cobra Meta: US$${(2.0 * fac).toFixed(2)}`], ['% respondidas', '94%', '+2%'], ['Primera respuesta', '6 min', '−1 min'], ['Sin responder', n(14), '−3'], ['Contactos nuevos', n(96), '+12%'], ['Conversiones', n(53), '+9%']];
  return pagina('Reportes', textoRango, selNumero + filtroFechas() + btn('Exportar CSV', 'exportar'), `
    <div class="indicadores suelta">${kp.map(k => `<div class="ind"><small>${k[0]}</small><strong>${k[1]}</strong>${k[2] ? `<em>${k[2]}</em>` : ''}${k[3] ? `<small class="ind-nota">${k[3]}</small>` : ''}</div>`).join('')}</div>
    <div class="rejilla dos">
      <div class="carta"><h3>Mensajes por día</h3><small>Datos de ejemplo: las cifras cambian con el rango para mostrar el comportamiento.</small><div class="leyenda"><i class="s1"></i>Recibidos<i class="s2"></i>Enviados</div><div class="barras">${R.dias.map(d => `<div class="dia"><div class="par"><i class="s1" style="height:${d[1] / max * 100}%" title="${d[1]} recibidos"></i><i class="s2" style="height:${d[2] / max * 100}%" title="${d[2]} enviados"></i></div><small>${d[0]}</small></div>`).join('')}</div></div>
      ${cartaEmbudo(rg)}
    </div>
    ${seccionTickets(rg)}
    ${E.rol === 'G' ? '' : `<h3 class="sub">Plantillas enviadas, por plantilla</h3>` + tabla(['Plantilla', 'Categoría', 'Enviadas', 'Entregadas', 'Leídas', 'Costo estimado'], [['confirmacion_pedido', 'Utilidad', 185, 181, 150, 1.48], ['catalogo_otono', 'Marketing', 12, 12, 9, 0.52]].map(f => ({ c: [`<strong>${f[0]}</strong>`, chip(f[1], 'azul'), n(f[2]), n(f[3]), n(f[4]), 'US$' + (f[5] * fac).toFixed(2)] })).concat([{ c: ['<strong>Total</strong>', '', `<strong>${n(197)}</strong>`, `<strong>${n(193)}</strong>`, `<strong>${n(159)}</strong>`, `<strong>US$${(2.0 * fac).toFixed(2)}</strong>`] }])) + `<p class="nota">Meta cobra por plantilla entregada. Los mensajes libres dentro de la ventana de 24 h no tienen costo.</p><h3 class="sub">Desempeño por agente</h3>` + tabla(['Agente', 'Asignadas', 'Cerradas', 'Primera respuesta', 'Resolución'], R.agentes.map(a => ({ c: [a[0], n(a[1]), n(a[2]), a[3], a[4]] }))) + `<h3 class="sub">Campañas</h3>` + tabla(['Campaña', 'Enviados', 'Entregados', 'Leídos', 'Respuestas', 'Clics', 'Bajas', 'Conversiones'], DB.campanas.map(k => ({ c: [esc(k.nombre), k.enviados, k.entregados, k.leidos, k.respuestas, k.clics, k.bajas, k.conversiones] })))}`);
}
// Configuración de un número: lo que la empresa decide se edita; lo que viene de Meta solo se muestra.
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
// Horario de atención por bloques: lunes a viernes, sábado y domingo, cada uno abierto o cerrado con su hora.
const BLOQUES = [['lv', 'Lunes a viernes'], ['sab', 'Sábado'], ['dom', 'Domingo']];
const horarioNum = n => n.horario || { lv: { abierto: false, abre: '09:00', cierra: '18:00' }, sab: { abierto: false, abre: '10:00', cierra: '14:00' }, dom: { abierto: false, abre: '10:00', cierra: '14:00' } };
const horarioTxt = n => n.siempre || !n.horario ? 'Siempre abierto' : BLOQUES.map(([k, et]) => { const b = horarioNum(n)[k]; return et + ' ' + (b.abierto ? b.abre + ' a ' + b.cierra : 'cerrado'); }).join(' · ');
const cierreTxt = n => n.cierre ? 'Cierra sola tras ' + n.cierre + ' h sin mensajes' : 'No se cierra sola';
function editarNumero(id) {
  setTimeout(() => document.querySelectorAll('.bloque-h').forEach(bl => bl.classList.toggle('cerrado', !bl.querySelector('input[type=checkbox]').checked)), 0);
  const n = N(id), dias = n.dias || [];
  abrirModal('Configuración de ' + esc(n.nombre), `<form id="formNum">
    <h5>Lo que tú decides</h5>
    <label class="campo"><span>Nombre visible en la bandeja</span><input name="nombre" value="${esc(n.nombre)}"></label>
    <div class="campo"><span>Usuarios que pueden atender este número</span>${activos().map(u => `<label class="check"><input type="checkbox" name="u" value="${u.id}" ${u.numeros.includes(n.id) ? 'checked' : ''}>${esc(u.nombre)} <small>${u.rol}</small></label>`).join('')}</div>
    <label class="campo"><span>Cierre de conversaciones por inactividad</span><select name="cierre">${[[0, 'No cerrar solas'], [12, 'Después de 12 horas sin mensajes'], [24, 'Después de 24 horas sin mensajes'], [48, 'Después de 48 horas sin mensajes'], [72, 'Después de 72 horas sin mensajes']].map(o => `<option value="${o[0]}" ${(n.cierre || 0) === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></label>
    <label class="campo"><span>Horario de atención</span><select name="siempre"><option value="no" ${n.siempre || !n.horario ? '' : 'selected'}>Con horario</option><option value="si" ${n.siempre || !n.horario ? 'selected' : ''}>Siempre abierto</option></select></label>
    ${siHtml(`<div class="bloques-horario">${BLOQUES.map(([k, et]) => { const b = horarioNum(n)[k]; return `<div class="bloque-h"><label class="check"><input type="checkbox" name="${k}_ab" ${b.abierto ? 'checked' : ''}><b>${et}</b></label><label class="campo"><span>Abre</span><input type="time" name="${k}_abre" value="${b.abre}"></label><label class="campo"><span>Cierra</span><input type="time" name="${k}_cierra" value="${b.cierra}"></label><small class="nota estado-h">${b.abierto ? '' : 'Cerrado'}</small></div>`; }).join('')}</div>`, 'siempre', 'no')}
      <p class="nota">Marca los días que se atiende y su horario; un bloque sin marcar queda cerrado todo el día. Fuera del horario se envían los mensajes automáticos de "Fuera de horario".</p>
    <h5 style="margin-top:14px">Lo que viene de Meta (no se edita aquí)</h5>
    <div class="solo-lectura"><div><small>Número</small><strong>${n.tel}</strong></div><div><small>Tipo de conexión</small><strong>${n.tipo}</strong></div><div><small>Estado</small><strong>${n.estado}</strong></div><div><small>Calidad</small><strong>${n.calidad}</strong></div><div><small>Límite de envío</small><strong>${n.limite}</strong></div><div><small>Cuenta oficial</small><strong>${n.oficial ? 'Sí' : 'No'}</strong></div></div>
    <p class="nota">${n.tipo === 'QR' ? 'Este número usa el conector no oficial: no tiene calidad ni límite de Meta.' : 'Estos datos los asigna Meta y se actualizan solos. El número y el tipo de conexión no se cambian: para usar otro, se conecta un número nuevo.'}</p>
  </form>`, (n.estado === 'Conectado' ? btn('Desconectar número', 'desconectarNumero', 'peligro', `data-id="${n.id}"`) : '') + btn('Cancelar', 'cerrarModal') + btn('Guardar cambios', 'guardarNumero', 'primario', `data-id="${n.id}"`), 'ancho');
}
function vNumeros() {
  return pagina('Números', `${DB.numeros.length} de ${DB.empresa.numerosMax} números de tu plan`, btn('+ Conectar número', 'conectar', 'primario'), `<div class="rejilla">${DB.numeros.map(n => `<div class="carta"><div class="c-top"><strong>${esc(n.nombre)}</strong>${estadoChip(n.estado)}</div><p class="grande">${n.tel}</p><div class="d-fila">${chip(n.tipo, n.tipo === 'QR' ? 'rojo' : 'azul')}${n.oficial ? chip('Cuenta oficial', 'verde') : ''}</div><small>Calidad: ${n.calidad} · Límite: ${n.limite}</small><small>Con acceso: ${DB.usuarios.filter(u => u.numeros.includes(n.id)).map(u => u.nombre).join(', ') || 'nadie aún'}</small><small>Horario: ${horarioTxt(n)}</small><small>${cierreTxt(n)}</small><div>${btn('Editar configuración', 'editarNumero', '', `data-id="${n.id}"`)}</div></div>`).join('')}</div>`);
}
function conectar(paso) {
  if (!paso) return abrirModal('Conectar número', `<div class="opciones">
    <a data-accion="conectarPaso" data-p="Cloud API"><strong>Cloud API oficial</strong><small>Número nuevo para la plataforma. Sin riesgo de bloqueo por el conector.</small></a>
    <a data-accion="conectarPaso" data-p="Coexistencia"><strong>Coexistencia</strong><small>Sigues usando tu app WhatsApp Business en el celular y el CRM ve los mismos chats.</small></a>
    <a class="riesgo" data-accion="conectarPaso" data-p="QR"><strong>Conector QR (no oficial)</strong><small>Opción avanzada. Riesgo de bloqueo permanente del número.</small></a></div>`);
  if (paso === 'QR') return abrirModal('Conector QR · aviso de riesgo', `<p class="alerta">Este conector no es oficial y va contra los términos de WhatsApp. El número puede ser bloqueado de forma permanente y sin apelación.</p><label class="check"><input type="checkbox" id="aceptoQR">Entiendo el riesgo y lo acepto para este número</label><div class="qr"></div><p class="nota">Escanea el código desde WhatsApp en tu celular (simulado).</p>`, btn('Cancelar', 'cerrarModal') + btn('Ya lo escaneé', 'conectarFin', 'primario', 'data-p="QR"'));
  abrirModal('Conectar con Meta', `<div class="meta"><strong>Ventana de Meta (simulada)</strong><p>Inicia sesión con Facebook, elige tu portafolio comercial, tu cuenta de WhatsApp y el número.</p></div><label class="campo"><span>Nombre visible en el CRM</span><input id="nomNum" value="Ventas"></label>`, btn('Cancelar', 'cerrarModal') + btn('Continuar', 'conectarFin', 'primario', `data-p="${paso}"`));
}
// Tipos de plantilla de Meta. Los bloqueados existen en Meta pero dependen de algo que no entra en la primera versión.
const SIN_CATALOGO = 'requiere catálogo de productos (fase posterior)';
const TIPOS_PL = [
  { id: 'estandar', n: 'Mensaje estándar', cats: ['Marketing', 'Utilidad'], d: 'Encabezado opcional (texto, foto, video, documento o ubicación), cuerpo de hasta 1,024 caracteres, pie y hasta 10 botones.' },
  { id: 'carrusel', n: 'Carrusel', cats: ['Marketing'], d: 'Texto principal y de 2 a 10 tarjetas con foto o video, texto de hasta 160 caracteres y hasta 2 botones. Todas las tarjetas llevan la misma estructura.' },
  { id: 'oferta', n: 'Oferta por tiempo limitado', cats: ['Marketing'], d: 'Foto o video, etiqueta de oferta de 16 caracteres, cuerpo de hasta 600, código para copiar y botón de enlace. No admite pie ni se ve en WhatsApp de escritorio.' },
  { id: 'cupon', n: 'Código de cupón', cats: ['Marketing'], d: 'Texto con un botón que copia el cupón, de hasta 20 caracteres. No funciona en WhatsApp Web.' },
  { id: 'auth', n: 'Autenticación (código de verificación)', cats: ['Autenticación'], d: 'El texto lo pone Meta. No admite archivos, enlaces ni emojis.' },
  { id: 'catalogo', n: 'Catálogo', bloqueado: SIN_CATALOGO },
  { id: 'mpm', n: 'Varios productos', bloqueado: SIN_CATALOGO },
  { id: 'spm', n: 'Un producto', bloqueado: SIN_CATALOGO },
  { id: 'carruselProd', n: 'Carrusel de productos', bloqueado: SIN_CATALOGO },
  { id: 'llamada', n: 'Permiso para llamar', bloqueado: 'requiere llamadas de WhatsApp (fase posterior)' },
  { id: 'flow', n: 'Con formulario (Flows)', bloqueado: 'fuera del alcance por ahora' }
];
const cmp = (et, nombre, valor = '', extra = '') => `<label class="campo"><span>${et}</span><input name="${nombre}" value="${esc(valor)}" ${extra}></label>`;
const cmpSel = (et, nombre, ops, valor) => `<label class="campo"><span>${et}</span><select name="${nombre}">${ops.map(o => `<option ${o === valor ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`;
const cmpArea = (et, nombre, valor, max) => `<label class="campo"><span>${et}</span><textarea name="${nombre}" rows="3" maxlength="${max}">${esc(valor)}</textarea></label>`;
// Crear plantilla según la documentación de Meta: categoría, idioma, formato de variables con sus ejemplos,
// encabezado de texto o de archivo con muestra, cuerpo, pie y botones con sus límites.
const IDIOMAS_PL = [['Español (MX)', 'es_MX'], ['Español', 'es'], ['Español (España)', 'es_ES'], ['Inglés (EE. UU.)', 'en_US'], ['Inglés', 'en'], ['Portugués (Brasil)', 'pt_BR']];
const NOTA_CAT = {
  Marketing: 'Marketing: promociones, ofertas, novedades e invitaciones. Es la categoría más cara. El sistema agrega la forma de darse de baja y no deja quitarla.',
  Utilidad: 'Utilidad: solo algo que el cliente ya pidió o compró (confirmaciones, envíos, pagos, recordatorios). No puede promover nada; si Meta ve promoción la pasa a Marketing y avisa con un día.',
  'Autenticación': 'Autenticación: solo códigos de un solo uso. Meta pone el texto; no admite archivos, enlaces ni emojis.'
};
const MEDIO_PL = { Foto: 'JPG o PNG, hasta 5 MB', Video: 'MP4 (H.264 y AAC), hasta 16 MB', Documento: 'PDF, hasta 100 MB' };
const NO_SE_OFRECEN = [['Catálogo, Varios productos, Un producto y Carrusel de productos', 'requieren un catálogo de productos en Meta'], ['Permiso para llamar y botón de llamada por WhatsApp', 'requieren llamadas de WhatsApp, que son de una fase posterior'], ['Con formulario (Flows)', 'fuera del alcance'], ['Pedidos y pagos dentro de WhatsApp', 'fuera del alcance']];
const USOS_PL = ['Iniciar conversación', 'Seguimiento', 'Campaña'];
const FORMATO_PL = { estandar: 'Mensaje simple', carrusel: 'Carrusel', oferta: 'Oferta por tiempo limitado', cupon: 'Código de cupón', auth: 'Código de verificación' };
const formatosDe = cat => TIPOS_PL.filter(x => !x.bloqueado && x.cats.includes(cat)).map(x => x.id);

/* Crear plantilla. Sigue la forma con la que Meta recibe una plantilla (POST /<WABA>/message_templates):
   name, language, category y un ARREGLO de componentes (HEADER, BODY, FOOTER, BUTTONS, LIMITED_TIME_OFFER, CAROUSEL).
   - Cada texto con variables lleva su ARREGLO de ejemplos, en orden: header_text ["…"], body_text [["…", "…"]].
   - BUTTONS es un ARREGLO; WhatsApp los agrupa por tipo y cada botón se identifica por su posición (índice) al enviar.
   - CAROUSEL es un ARREGLO de tarjetas; cada tarjeta tiene su propio ARREGLO de componentes con sus propios ejemplos.
   La pantalla sigue el orden de la captura de Adely: nombre, categoría e idioma, formato del mensaje, encabezado, cuerpo
   con sus variables, pie, botones (o tarjetas) y tipo de plantilla. El borrador (borPl) guarda esos mismos arreglos. */
let borPl = null, subidasPl = {};
const conVarUrl = u => /\{\{1\}\}$/.test(u || '');
function borNuevo(tipo, nombre) {
  const cat = tipo === 'auth' ? 'Autenticación' : 'Marketing';
  const b = { tipo, nombre: nombre || '', cat, idioma: 'Español (MX)', numeroPl: E.numPl || DB.numeros[0].id, encTipo: 'Ninguno', encTexto: '', ejH: [], cuerpo: '', ejB: [], pie: '', botones: [], medio: 'Foto', tarjetas: [], tBotones: [], oferta: '', vence: true, codigo: '', otp: 'Copiar código', btnAuth: 'Copiar código', seg: true, min: '10', paquete: '', firma: '', terminos: false, uso: tipo === 'carrusel' ? 'Campaña' : 'Campaña' };
  if (tipo === 'estandar') b.cuerpo = 'Hola {{1}}, tenemos una oferta especial para ti.';
  if (tipo === 'carrusel') { b.cuerpo = 'Hola {{1}}, tenemos una oferta especial para ti.'; b.tBotones = ['Enlace']; b.tarjetas = [{ texto: '', ej: [], b: [{}] }, { texto: '', ej: [], b: [{}] }]; }
  if (tipo === 'oferta') { b.cuerpo = 'Hola {{1}}, solo esta semana en toda la tienda.'; b.oferta = '20% de descuento'.slice(0, 16); b.codigo = 'OTONO20'; b.botones = [{ tipo: 'Enlace', texto: 'Comprar', url: 'https://tienda.com/ofertas' }]; }
  if (tipo === 'cupon') { b.encTexto = 'Tu cupón de bienvenida'; b.encTipo = 'Texto'; b.cuerpo = 'Hola {{1}}, usa este cupón en tu próxima compra.'; b.codigo = 'BIENVENIDA10'; b.botones = [{ tipo: 'Respuesta rápida', texto: 'Quiero comprar' }]; }
  if (tipo === 'auth') b.uso = 'Iniciar conversación';
  return b;
}
// Botones como los recibe Meta: el arreglo completo en su orden final. WhatsApp los muestra agrupados por tipo:
// primero las respuestas rápidas (con "Darme de baja"), después enlaces y teléfono. Su posición es el índice.
function botonesFinales(b) {
  const tipoMeta = { 'Respuesta rápida': 'QUICK_REPLY', Enlace: 'URL', Llamar: 'PHONE_NUMBER' };
  const usuario = b.botones.map((x, i) => ({ ...x, tipo: tipoMeta[x.tipo], conVar: conVarUrl(x.url), de: i }));
  const qr = usuario.filter(x => x.tipo === 'QUICK_REPLY'), otros = usuario.filter(x => x.tipo !== 'QUICK_REPLY');
  const baja = b.cat === 'Marketing' ? [{ tipo: 'QUICK_REPLY', texto: 'Darme de baja', sistema: true }] : [];
  if (b.tipo === 'auth') return [{ tipo: 'OTP', texto: b.btnAuth || 'Copiar código', sistema: true }];
  if (b.tipo === 'oferta') return [...(b.codigo ? [{ tipo: 'COPY_CODE', texto: 'Copiar código', sistema: true }] : []), ...otros];
  if (b.tipo === 'cupon') return [...qr, ...baja, { tipo: 'COPY_CODE', texto: 'Copiar código', sistema: true }, ...otros];
  if (b.tipo === 'estandar') return [...qr, ...baja, ...otros];
  return [];
}
const textoAuth = b => '{{1}} es tu código de verificación.' + (b.seg ? ' Por tu seguridad, no lo compartas.' : '');
// Lo que se manda a Meta al crear la plantilla.
function crearMeta(b) {
  const fmt = { Foto: 'IMAGE', Video: 'VIDEO', Documento: 'DOCUMENT', 'Ubicación': 'LOCATION' }, cat = { Marketing: 'MARKETING', Utilidad: 'UTILITY', 'Autenticación': 'AUTHENTICATION' }[b.cat];
  const handle = k => subidasPl[k] ? '<identificador de ' + subidasPl[k].nombre + ' (Resumable Upload)>' : '<falta subir el archivo>';
  const ejemplos = (clave, arr, doble) => arr.length ? { example: { [clave]: doble ? [arr] : arr } } : {};
  const url = (texto, u, ej) => ({ type: 'URL', text: texto || '', url: u || '', ...(conVarUrl(u) ? { example: [(u || '').replace('{{1}}', ej || '')] } : {}) });
  const comps = [];
  if (b.tipo === 'auth') {
    comps.push({ type: 'BODY', add_security_recommendation: !!b.seg });
    if (b.min) comps.push({ type: 'FOOTER', code_expiration_minutes: +b.min });
    const otp = { 'Copiar código': 'COPY_CODE', 'Autocompletar con un toque (solo Android)': 'ONE_TAP', 'Sin toque (solo Android)': 'ZERO_TAP' }[b.otp];
    comps.push({ type: 'BUTTONS', buttons: [{ type: 'OTP', otp_type: otp, text: b.btnAuth || 'Copiar código', ...(otp !== 'COPY_CODE' ? { supported_apps: [{ package_name: b.paquete, signature_hash: b.firma }] } : {}), ...(otp === 'ZERO_TAP' ? { zero_tap_terms_accepted: !!b.terminos } : {}) }] });
    return { name: b.nombre, language: idiomaMeta(b.idioma), category: cat, components: comps };
  }
  if ((b.tipo === 'estandar' || b.tipo === 'cupon') && b.encTipo === 'Texto' && b.encTexto) comps.push({ type: 'HEADER', format: 'TEXT', text: b.encTexto, ...ejemplos('header_text', b.ejH) });
  if (b.tipo === 'estandar' && ['Foto', 'Video', 'Documento'].includes(b.encTipo)) comps.push({ type: 'HEADER', format: fmt[b.encTipo], example: { header_handle: [handle('muestraH')] } });
  if (b.tipo === 'estandar' && b.encTipo === 'Ubicación') comps.push({ type: 'HEADER', format: 'LOCATION' });
  if (b.tipo === 'oferta') comps.push({ type: 'HEADER', format: fmt[b.medio], example: { header_handle: [handle('muestraH')] } });
  if (b.tipo === 'oferta') comps.push({ type: 'LIMITED_TIME_OFFER', limited_time_offer: { text: b.oferta, has_expiration: !!b.vence } });
  comps.push({ type: 'BODY', text: b.cuerpo, ...ejemplos('body_text', b.ejB, true) });
  if (b.tipo === 'estandar' && b.pie) comps.push({ type: 'FOOTER', text: b.pie });
  const fin = botonesFinales(b);
  if (fin.length) comps.push({ type: 'BUTTONS', buttons: fin.map(x => x.tipo === 'QUICK_REPLY' ? { type: 'QUICK_REPLY', text: x.texto } : x.tipo === 'URL' ? url(x.texto, x.url, x.ej) : x.tipo === 'PHONE_NUMBER' ? { type: 'PHONE_NUMBER', text: x.texto, phone_number: (x.tel || '').replace(/\s/g, '') } : { type: 'COPY_CODE', example: b.codigo }) });
  if (b.tipo === 'carrusel') comps.push({ type: 'CAROUSEL', cards: b.tarjetas.map((t, i) => ({ components: [
    { type: 'HEADER', format: fmt[b.medio], example: { header_handle: [handle('tM' + i)] } },
    ...(t.texto ? [{ type: 'BODY', text: t.texto, ...ejemplos('body_text', t.ej, true) }] : []),
    { type: 'BUTTONS', buttons: b.tBotones.map((tp, k) => { const x = t.b[k] || {}; return tp === 'Respuesta rápida' ? { type: 'QUICK_REPLY', text: x.texto || '' } : url(x.texto, x.url, x.ej); }) }
  ] })) });
  return { name: b.nombre, language: idiomaMeta(b.idioma), category: cat, components: comps };
}

/* ---------- Dibujo del formulario ---------- */
const contador = (nombre, valor, max) => `<small class="contador" data-cont="${nombre}">${(valor || '').length}/${max}</small>`;
const muestraPl = (nombre, medio, et) => `<div class="archivo-pl"><span class="${subidasPl[nombre] ? 'ok' : 'rojo'}">${subidasPl[nombre] ? '📎 ' + esc(subidasPl[nombre].nombre) : '⦸ Sin archivo'}</span><small class="tipo-p">${et || ''}${MEDIO_PL[medio] || MEDIO_PL.Foto}</small><label class="btn">⬆ Elegir<input type="file" data-subir="${nombre}" hidden></label></div>`;
const botonVar = campo => `<button type="button" class="btn enlace mini-var" data-accion="agregarVarPl" data-campo="${campo}">+ Agregar variable</button>`;
// Variables de un texto: un ejemplo por variable, en orden; es el arreglo que se manda a Meta.
function ejemplosHtml(pref, texto, valores) {
  const n = varsDe(texto).length;
  if (!n) return `<div id="ejw_${pref}"></div>`;
  return `<div class="ejemplos-pl" id="ejw_${pref}"><b class="tit-ej">{x} Declarar variables (ejemplo, requerido)</b>${Array.from({ length: n }, (_, i) => `<label class="en-linea-ej"><span>{{${i + 1}}}</span><input name="${pref}${i}" value="${esc(valores[i] || '')}" placeholder="Ej. María"></label>`).join('')}</div>`;
}
const faltanEjHtml = (pref, texto, valores) => { const f = varsDe(texto).map((k, i) => !(valores[i] || '').trim() ? '{{' + (i + 1) + '}}' : null).filter(Boolean); return f.length ? `<small class="rojo aviso-ej">⚠ Declara un ejemplo para ${f.join(', ')}.</small>` : ''; };
const areaPl = (et, nombre, valor, max, ph = '') => `<div class="campo"><span>${et}</span><textarea name="${nombre}" rows="3" maxlength="${max}" placeholder="${esc(ph)}">${esc(valor)}</textarea><div class="pie-campo"><small class="nota">ⓘ Usa {{1}}, {{2}}… para variables. ${botonVar(nombre)}</small>${contador(nombre, valor, max)}</div><div id="fej_${nombre}"></div></div>`;
const textoPl = (et, nombre, valor, max, ph, conVar) => `<div class="campo"><span>${et}</span><input name="${nombre}" value="${esc(valor)}" maxlength="${max}" placeholder="${esc(ph || '')}"><div class="pie-campo"><small class="nota">${conVar ? botonVar(nombre) : ''}</small>${contador(nombre, valor, max)}</div></div>`;
const chipsPl = (accion, opciones, actual, extra = '') => `<div class="chips-pl">${opciones.map(o => `<button type="button" class="chip-pl ${o === actual ? 'activo' : ''}" data-accion="${accion}" data-v="${esc(o)}" ${extra}>${esc(o)}</button>`).join('')}</div>`;
function filaBoton(x, i, idx, quitar, nombres) {
  const n = nombres || { txt: 'bt_txt_' + i, url: 'bt_url_' + i, ej: 'bt_ej_' + i, tel: 'bt_tel_' + i };
  const chip = { 'Respuesta rápida': '↩ Respuesta rápida', Enlace: '🔗 URL', Llamar: '✆ Llamar' }[x.tipo];
  return `<div class="fila-bt"><span class="chip-tipo">${chip}</span><input name="${n.txt}" value="${esc(x.texto || '')}" maxlength="25" placeholder="Texto del botón">${idx != null ? `<small class="nota">índice ${idx}</small>` : ''}${quitar || ''}</div>
    ${x.tipo === 'Enlace' ? `<input class="bt-url" name="${n.url}" value="${esc(x.url || '')}" maxlength="2000" placeholder="https://tu-sitio.com/oferta"><small class="nota">Debe iniciar con https://. Admite una variable, siempre al final: https://tu-sitio.com/pedido/{{1}}</small>${conVarUrl(x.url) ? `<label class="en-linea-ej"><span>{{1}}</span><input name="${n.ej}" value="${esc(x.ej || '')}" placeholder="Ejemplo del final del enlace (requerido)"></label>` : ''}` : ''}
    ${x.tipo === 'Llamar' ? `<input class="bt-url" name="${n.tel}" value="${esc(x.tel || '')}" maxlength="20" placeholder="+52 81 5550 0101">` : ''}`;
}
function botonesHtml(b) {
  const fin = botonesFinales(b), cuenta = t => b.botones.filter(x => x.tipo === t).length;
  const filas = fin.map((x, idx) => x.sistema ? `<div class="fila-bt sistema"><span class="chip-tipo">${x.tipo === 'COPY_CODE' ? '⧉ Copiar código' : '↩ Respuesta rápida'}</span><span>${x.tipo === 'COPY_CODE' ? 'El código se pone al enviar' : esc(x.texto)}</span><small class="nota">índice ${idx} · lo agrega el sistema</small></div>` : filaBoton(b.botones[x.de], x.de, idx, btn('🗑', 'quitarBotonPl', 'enlace rojo icono-bt', `data-i="${x.de}" title="Quitar botón"`))).join('');
  const puede = { 'Respuesta rápida': b.tipo === 'estandar' || b.tipo === 'cupon', Enlace: b.tipo !== 'cupon' || cuenta('Enlace') < 1, Llamar: b.tipo === 'estandar' && cuenta('Llamar') < 1 };
  if (b.tipo === 'oferta') { puede['Respuesta rápida'] = false; puede.Enlace = cuenta('Enlace') < 1; }
  if (cuenta('Enlace') >= 2) puede.Enlace = false;
  const total = fin.length, adds = total < 10 ? Object.entries(puede).filter(([, v]) => v).map(([t]) => btn('+ ' + { 'Respuesta rápida': 'Respuesta rápida', Enlace: 'URL', Llamar: 'Llamar' }[t], 'agregarBotonPl', '', `data-t="${t}"`)).join('') : '';
  return `<span class="et">Botones${b.tipo === 'oferta' ? ' (el de URL es obligatorio)' : ''}</span>${filas}<div class="adds-bt">${adds}<small class="nota">${total}/10</small></div><small class="nota">ⓘ Puedes combinar tipos hasta 10 botones, máx. 2 de enlace y 1 de llamada. WhatsApp los muestra agrupados por tipo; el índice es su posición.</small>`;
}
function tarjetasHtml(b) {
  const quitarBt = k => btn('🗑', 'quitarBotonTarjetaPl', 'enlace rojo icono-bt', `data-k="${k}" title="Quitar este botón de todas las tarjetas"`);
  return `<div class="campo"><span>Tarjetas *</span><div class="fila-cab"><small class="nota">Tipo de archivo de las tarjetas</small>${chipsPl('medioPl', ['Foto', 'Video'], b.medio)}<small class="nota der">${b.tarjetas.length}/10</small></div></div>
    ${b.tarjetas.map((t, i) => `<div class="tarjeta-pl"><div class="bt-cab"><b>Tarjeta ${i + 1}</b><small class="nota">índice ${i}</small><span class="der">${btn('↑', 'moverTarjetaPl', 'icono-bt', `data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} title="Subir"`)}${btn('↓', 'moverTarjetaPl', 'icono-bt', `data-i="${i}" data-d="1" ${i === b.tarjetas.length - 1 ? 'disabled' : ''} title="Bajar"`)}${btn('🗑', 'quitarTarjetaPl', 'icono-bt rojo', `data-i="${i}" title="Quitar tarjeta" ${b.tarjetas.length <= 2 ? 'disabled' : ''}`)}</span></div>
      ${muestraPl('tM' + i, b.medio, '')}
      <input name="tc_txt_${i}" value="${esc(t.texto)}" maxlength="160" placeholder="Texto de la tarjeta (opcional)"><div class="pie-campo"><small class="nota">${botonVar('tc_txt_' + i)}</small>${contador('tc_txt_' + i, t.texto, 160)}</div>${ejemplosHtml('tc_ej_' + i + '_', t.texto, t.ej)}
      ${b.tBotones.map((tp, k) => filaBoton({ tipo: tp, ...(t.b[k] || {}) }, null, null, i === 0 ? quitarBt(k) : '', { txt: `tc_b_${k}_${i}`, url: `tc_u_${k}_${i}`, ej: `tc_uej_${k}_${i}`, tel: `tc_u_${k}_${i}` })).join('')}
      ${i === 0 ? `<div class="adds-bt">${b.tBotones.length < 2 ? btn('+ URL', 'agregarBotonTarjetaPl', '', 'data-t="Enlace"') + btn('+ Respuesta rápida', 'agregarBotonTarjetaPl', '', 'data-t="Respuesta rápida"') : ''}<small class="nota">${b.tBotones.length}/2</small></div>` : ''}
    </div>`).join('')}
    ${b.tarjetas.length < 10 ? btn('+ Agregar tarjeta', 'agregarTarjetaPl') : ''}
    <small class="nota">ⓘ De 2 a 10 tarjetas. Todas llevan archivo, del mismo tipo, y los mismos botones (se definen en la tarjeta 1); el texto de tarjeta va en todas o en ninguna.</small>`;
}
function camposPl(b) {
  const t = b.tipo;
  if (t === 'auth') return cmpSel('Cómo recibe el código', 'otp', ['Copiar código', 'Autocompletar con un toque (solo Android)', 'Sin toque (solo Android)'], b.otp) +
    cmp('Texto del botón (25)', 'btnAuth', b.btnAuth, 'maxlength="25"') +
    `<label class="check"><input type="checkbox" name="seg" ${b.seg ? 'checked' : ''}>Agregar "Por tu seguridad, no lo compartas"</label>` +
    cmp('El código vence en (1 a 90 minutos; vacío = sin aviso)', 'min', b.min, 'type="number" min="1" max="90"') +
    siHtml(`<div class="dos-campos">${cmp('Paquete de la app Android *', 'paquete', b.paquete, 'placeholder="com.empresa.app"')}${cmp('Firma de la app * (11 caracteres)', 'firma', b.firma, 'maxlength="11"')}</div>`, 'otp', 'Autocompletar|Sin toque') +
    siHtml(`<label class="check"><input type="checkbox" name="terminos" ${b.terminos ? 'checked' : ''}>Acepto las condiciones de Meta para la entrega sin toque</label>`, 'otp', 'Sin toque') +
    '<p class="nota">Meta pone el texto: "{{1}} es tu código de verificación." Aquí solo se elige el aviso de seguridad, la vigencia y la forma de entrega. Al enviar, el código va en el cuerpo y en el botón.</p>';
  let h = '';
  if (t === 'estandar' || t === 'cupon') {
    const media = ['Foto', 'Video', 'Documento', 'Ubicación'].includes(b.encTipo);
    h += `<div class="campo"><span>Encabezado${t === 'cupon' ? ' (opcional, solo texto)' : ''}</span>${media ? `<div class="enc-medio"><b>${esc(b.encTipo)}</b>${b.encTipo === 'Ubicación' ? '<small class="nota">La ubicación (latitud, longitud, nombre y dirección) se indica al enviar.</small>' : muestraPl('muestraH', b.encTipo, 'Archivo de muestra para Meta: ')}${btn('Quitar y usar texto', 'encabezadoPl', 'enlace', 'data-v="Texto"')}</div>` : `<input name="encTexto" value="${esc(b.encTexto)}" maxlength="60" placeholder="Encabezado de texto (opcional)"><div class="pie-campo"><small class="nota">${botonVar('encTexto')} Una variable como máximo.</small>${contador('encTexto', b.encTexto, 60)}</div>${ejemplosHtml('ej_h_', b.encTexto, b.ejH)}`}
      ${t === 'estandar' && !media ? `<div class="chips-pl">${['Foto', 'Video', 'Documento', 'Ubicación'].map(o => `<button type="button" class="chip-pl" data-accion="encabezadoPl" data-v="${o}">${{ Foto: '🖼 Foto', Video: '🎬 Video', Documento: '📄 Documento', 'Ubicación': '📍 Ubicación' }[o]}</button>`).join('')}</div>` : ''}</div>`;
  }
  if (t === 'oferta') h += `<div class="campo"><span>Encabezado * (obligatorio)</span><div class="fila-cab">${chipsPl('medioPl', ['Foto', 'Video'], b.medio)}</div>${muestraPl('muestraH', b.medio, 'Archivo de muestra para Meta: ')}</div>` +
    `<div class="dos-campos">${cmp('Texto de la oferta * (16)', 'oferta', b.oferta, 'maxlength="16"')}${cmp('Ejemplo de código (15, opcional)', 'codigo', b.codigo, 'maxlength="15"')}</div>` +
    `<label class="check"><input type="checkbox" name="vence" ${b.vence ? 'checked' : ''}>Mostrar cuándo vence la oferta (la fecha se indica al enviar)</label>`;
  h += areaPl(t === 'carrusel' ? 'Cuerpo del mensaje * <small class="nota">· va arriba del carrusel</small>' : 'Cuerpo del mensaje *', 'cuerpo', b.cuerpo, t === 'oferta' ? 600 : 1024) + ejemplosHtml('ej_b_', b.cuerpo, b.ejB);
  if (t === 'estandar') h += textoPl('Pie de página (opcional)', 'pie', b.pie, 60, 'Ej. Responde STOP para baja', false);
  if (t === 'cupon') h += cmp('Ejemplo del código del cupón * (20)', 'codigo', b.codigo, 'maxlength="20"') + '<p class="nota">El código real se indica al enviar; aquí va solo un ejemplo para la revisión de Meta. No funciona en WhatsApp Web.</p>';
  h += t === 'carrusel' ? tarjetasHtml(b) : botonesHtml(b);
  if (t === 'oferta') h += '<p class="nota">No lleva pie de página. En WhatsApp de escritorio se ve un aviso en lugar de la oferta.</p>';
  return h;
}

/* ---------- Lectura del formulario hacia el borrador ---------- */
function leerPl() {
  const f = $('#formPl'), b = borPl; if (!f || !b) return b;
  const v = Object.fromEntries(new FormData(f)), val = n => f.elements[n] ? v[n] ?? '' : undefined;
  ['nombre', 'cat', 'idioma', 'numeroPl', 'encTexto', 'cuerpo', 'pie', 'oferta', 'codigo', 'otp', 'btnAuth', 'min', 'paquete', 'firma'].forEach(k => { const x = val(k); if (x !== undefined) b[k] = x; });
  ['vence', 'seg', 'terminos'].forEach(k => { if (f.elements[k]) b[k] = !!v[k]; });
  if (f.elements.encTexto && !['Foto', 'Video', 'Documento', 'Ubicación'].includes(b.encTipo)) b.encTipo = b.encTexto.trim() ? 'Texto' : 'Ninguno';
  const lista = pref => [...f.querySelectorAll(`[name^="${pref}"]`)].map(i => i.value);
  if (f.querySelector('[name^="ej_h_"]') || f.elements.encTexto) b.ejH = lista('ej_h_'); if ($('#ejw_ej_b_')) b.ejB = lista('ej_b_');
  b.botones.forEach((x, i) => { if (f.elements['bt_txt_' + i]) x.texto = v['bt_txt_' + i] || ''; if (f.elements['bt_url_' + i]) x.url = v['bt_url_' + i] || ''; if (f.elements['bt_ej_' + i]) x.ej = v['bt_ej_' + i] || ''; if (f.elements['bt_tel_' + i]) x.tel = v['bt_tel_' + i] || ''; });
  b.tarjetas.forEach((t, i) => { if (!f.elements['tc_txt_' + i]) return; t.texto = v['tc_txt_' + i] || ''; t.ej = lista('tc_ej_' + i + '_'); t.b = b.tBotones.map((tp, k) => ({ texto: v[`tc_b_${k}_${i}`] ?? '', url: v[`tc_u_${k}_${i}`] ?? '', ej: v[`tc_uej_${k}_${i}`] ?? ((t.b[k] || {}).ej || '') })); });
  return b;
}
// Plantilla con la forma que usan la lista, el chat y "Probar plantilla".
function datosPl() {
  const b = leerPl(), fin = botonesFinales(b), pre = { QUICK_REPLY: '', URL: '↗ ', PHONE_NUMBER: '✆ ', COPY_CODE: '⧉ ', OTP: '⧉ ' };
  const obj = arr => Object.fromEntries((arr || []).map((x, i) => [String(i + 1), x]));
  const p = { tipo: b.tipo, nombre: b.nombre.trim(), cat: b.cat, idioma: b.idioma, uso: b.tipo === 'carrusel' ? 'Campaña' : b.uso, formato: TIPOS_PL.find(x => x.id === b.tipo).n, cuerpo: b.tipo === 'auth' ? textoAuth(b) : b.cuerpo, botones: (b.tipo === 'auth' && (b.otp || '').startsWith('Sin toque')) ? [] : fin.map(x => pre[x.tipo] + (x.tipo === 'COPY_CODE' ? 'Copiar código' : x.texto)), envios: 0, clics: 0, fmtVars: 'Numeradas',
    ejemplos: { h: obj(b.ejH), b: obj(b.ejB), c: b.tarjetas.map(t => obj(t.ej)) }, btnVars: fin.map((x, i) => x.tipo === 'URL' && x.conVar ? { index: i, texto: x.texto, ej: x.ej || '' } : null).filter(Boolean) };
  if (p.btnVars.length) { p.urlVar = true; p.ejemplos.u = p.btnVars[0].ej; }
  if (b.tipo === 'estandar') { p.encTipo = b.encTipo; p.encabezado = b.encTipo === 'Texto' ? b.encTexto : ''; p.pie = b.pie; p.archivo = subidasPl.muestraH && subidasPl.muestraH.medio === b.encTipo ? subidasPl.muestraH : null; }
  if (b.tipo === 'carrusel') { const pt = { Enlace: '↗ ', 'Respuesta rápida': '' }; p.encTipo = b.medio; p.tarjetas = b.tarjetas.map((t, i) => ({ archivo: subidasPl['tM' + i] || null, texto: t.texto, botones: b.tBotones.map((tp, k) => pt[tp] + ((t.b[k] || {}).texto || '')), btnVars: b.tBotones.map((tp, k) => tp === 'Enlace' && conVarUrl((t.b[k] || {}).url) ? { index: k, texto: (t.b[k] || {}).texto || '', ej: (t.b[k] || {}).ej || '' } : null).filter(Boolean) })); }
  if (b.tipo === 'oferta') { p.encTipo = b.medio; p.archivo = subidasPl.muestraH && subidasPl.muestraH.medio === b.medio ? subidasPl.muestraH : null; p.oferta = b.oferta; p.vence = b.vence; p.codigo = b.codigo; }
  if (b.tipo === 'cupon') { p.encabezado = b.encTipo === 'Texto' ? b.encTexto : ''; p.codigo = b.codigo; }
  if (b.tipo === 'auth') { p.pie = b.min ? `Este código vence en ${b.min} minutos.` : ''; p.otp = b.otp; p.min = b.min ? +b.min : null; p.paquete = b.paquete; p.firma = b.firma; p.terminos = b.terminos; }
  return p;
}
// Errores que Meta rechaza en las variables de un texto.
function erroresTexto(texto, et, esCuerpo, max1) {
  const ks = varsDe(texto), e = [], t = (texto || '').trim();
  if (ks.some(k => !/^\d+$/.test(k))) e.push(et + ': las variables van numeradas: {{1}}, {{2}}…');
  else if (ks.map(Number).sort((a, b) => a - b).some((k, i) => k !== i + 1)) e.push(et + ': las variables van en orden, empezando en {{1}}');
  if (max1 && ks.length > 1) e.push(et + ': admite una sola variable');
  if (esCuerpo && (/^\{\{\w+\}\}/.test(t) || /\{\{\w+\}\}[.!?…]?$/.test(t))) e.push(et + ': no puede empezar ni terminar con una variable');
  if (/\}\}\s*\{\{/.test(t)) e.push(et + ': no puede haber dos variables seguidas');
  return e;
}
function erroresPl(b) {
  if (b.tipo === 'auth') return [];
  let e = erroresTexto(b.cuerpo, 'Cuerpo', true, false);
  if (b.encTipo === 'Texto' && b.encTexto) e = e.concat(erroresTexto(b.encTexto, 'Encabezado', false, true));
  b.tarjetas.forEach((t, i) => { e = e.concat(erroresTexto(t.texto, 'Tarjeta ' + (i + 1), false, false)); });
  if (b.pie && /\{\{/.test(b.pie)) e.push('El pie de página no admite variables');
  [...b.botones.map(x => x.url), ...b.tarjetas.flatMap(t => t.b.map(x => x.url))].forEach(u => { if (u && /\{\{/.test(u.replace(/\{\{1\}\}$/, ''))) e.push('El enlace admite una sola variable, {{1}}, siempre al final'); });
  return [...new Set(e)];
}
const pintaPreviaPl = () => { const d = $('#previaPl'); if (!d) return; d.innerHTML = previaPlantilla(datosPl()); const j = $('#jsonPl'); if (j) j.textContent = JSON.stringify(crearMeta(borPl), null, 2); };
function pintaFaltanEj() {
  const f = $('#formPl'); if (!f) return;
  const marca = (campo, pref, texto, vals) => { const d = $('#fej_' + campo); if (d) d.innerHTML = faltanEjHtml(pref, texto, vals); };
  marca('cuerpo', 'ej_b_', borPl.cuerpo, borPl.ejB);
}
// Al escribir: contadores, ejemplos del texto que cambió y avisos; al cambiar categoría se redibuja.
function actualizaPl(ev) {
  const f = $('#formPl'); if (!f || !borPl) return;
  const n = ev && ev.target && ev.target.name || '';
  leerPl();
  if (n === 'cat') { const fs_ = formatosDe(borPl.cat); if (!fs_.includes(borPl.tipo)) { const nuevo = borNuevo(fs_[0], borPl.nombre); Object.assign(nuevo, { cat: borPl.cat, idioma: borPl.idioma, numeroPl: borPl.numeroPl }); borPl = nuevo; } return repintaPl(); }
  if (/^(bt_url_|tc_u_)/.test(n)) { const tenia = ev.target.dataset.var === '1', tiene = conVarUrl(ev.target.value); if (tenia !== tiene) return repintaPl(); }
  const c = f.querySelector(`[data-cont="${n}"]`); if (c && ev.target.maxLength > 0) c.textContent = ev.target.value.length + '/' + ev.target.maxLength;
  const cambiaEj = { cuerpo: ['ej_b_', () => [borPl.cuerpo, borPl.ejB]], encTexto: ['ej_h_', () => [borPl.encTexto, borPl.ejH]] }[n] || (/^tc_txt_\d+$/.test(n) ? (() => { const i = +n.split('_')[2]; return ['tc_ej_' + i + '_', () => [borPl.tarjetas[i].texto, borPl.tarjetas[i].ej]]; })() : null);
  if (cambiaEj) { const w = $('#ejw_' + cambiaEj[0]); if (w) { const [txt, vals] = cambiaEj[1](); w.outerHTML = ejemplosHtml(cambiaEj[0], txt, vals); } }
  pintaFaltanEj();
  if ($('#notaCat')) $('#notaCat').textContent = NOTA_CAT[borPl.cat] || '';
  const err = $('#errPl'); if (err) err.innerHTML = erroresPl(borPl).map(x => '<div class="rojo">' + esc(x) + '</div>').join('');
  pintaPreviaPl();
}
function repintaPl() { const c = $('.m-cuerpo'), sc = c ? c.scrollTop : 0; modalPlantilla(borPl.tipo, null, true); const c2 = $('.m-cuerpo'); if (c2) c2.scrollTop = sc; }
function modalPlantilla(tipo = 'estandar', nombre = '', mantener = false) {
  if (!mantener || !borPl) borPl = borNuevo(tipo, nombre);
  const b = borPl, T = TIPOS_PL.find(x => x.id === b.tipo), ed = E.editPl && DB.plantillas.find(x => x.id === E.editPl);
  const numOps = ed ? numerosDeCuenta(ed.cuenta).slice(0, 1) : DB.numeros, formatos = formatosDe(b.cat);
  // Al editar, lo que no se puede cambiar se lee como dato, no como campos apagados.
  const fijos = ed ? `<div class="datos-fijos"><div><small>Nombre</small><b>${esc(ed.nombre)}</b></div><div><small>Categoría</small><b>${esc(b.cat)}</b></div><div><small>Idioma</small><b>${esc(b.idioma)} (${idiomaMeta(b.idioma)})</b></div><div><small>Cuenta</small><b>${esc((DB.cuentas.find(w => w.id === ed.cuenta) || {}).nombre || '—')}</b></div><div><small>Formato</small><b>${FORMATO_PL[b.tipo]}</b></div><p class="nota">Meta no deja cambiar el nombre, la categoría, el idioma, la cuenta ni el formato de una plantilla; para eso se crea una nueva.</p></div>` : '';
  abrirModal(ed ? 'Editar plantilla · ' + esc(ed.nombre) : 'Nueva plantilla', `<form id="formPl" class="dos"><div>
      ${ed ? fijos : `${cmp('Nombre (sin espacios)', 'nombre', b.nombre, 'maxlength="512" placeholder="ej. oferta_julio"')}
      <div class="dos-campos">${cmpSel('Categoría', 'cat', ['Marketing', 'Utilidad', 'Autenticación'], b.cat)}${cmpSel('Idioma', 'idioma', IDIOMAS_PL.map(x => x[0]), b.idioma)}</div>
      <p class="nota" id="notaCat">${NOTA_CAT[b.cat]}</p>
      <label class="campo"><span>Número (la plantilla queda en la cuenta de WhatsApp Business de ese número)</span><select name="numeroPl">${numOps.map(n => `<option value="${n.id}" ${n.id === b.numeroPl ? 'selected' : ''}>${esc(n.nombre)} · ${esc(cuentaDe(n.id).nombre)}</option>`).join('')}</select></label>
      <div class="campo"><span>Formato del mensaje</span><div class="chips-pl">${formatos.map(id => `<button type="button" class="chip-pl ${id === b.tipo ? 'activo' : ''}" data-accion="tipoPl" data-t="${id}">${{ estandar: '▤ ', carrusel: '◫ ', oferta: '⏱ ', cupon: '⧉ ', auth: '🔐 ' }[id]}${FORMATO_PL[id]}</button>`).join('')}</div><small class="nota">${T.d}</small></div>`}
      ${camposPl(b)}
      ${b.tipo === 'auth' ? '' : `<div class="campo"><span>Tipo de plantilla</span>${b.tipo === 'carrusel' ? chipsPl('usoPl', ['Campaña'], 'Campaña') + '<small class="nota">🔒 Un carrusel solo se envía por campaña, así que no se ofrece en la Bandeja.</small>' : chipsPl('usoPl', USOS_PL, b.uso) + '<small class="nota">Iniciar conversación y Seguimiento se ofrecen en la Bandeja; Campaña solo en campañas.</small>'}</div>`}
      <div id="errPl"></div>
      ${ed ? '<p class="nota">Al guardar, la plantilla vuelve a revisión de Meta; mientras tanto se puede seguir usando la versión aprobada.</p>' : `<details class="no-ofrece"><summary>Tipos de Meta que este producto no ofrece</summary>${NO_SE_OFRECEN.map(([a, c]) => `<div>${a}: ${c}.</div>`).join('')}</details>`}
    </div><div><span class="et">Vista previa (WhatsApp)</span><div class="previa" id="previaPl"></div><p class="nota">ⓘ Meta suele aprobar en minutos a 24 h.</p><details class="nota"><summary>Datos que se mandan a Meta al crearla</summary><pre class="json-pl" id="jsonPl"></pre></details></div></form>`,
    btn('Cancelar', 'cerrarModal') + btn(ed ? 'Guardar y enviar a revisión' : '➤ Enviar a aprobación', 'guardarPl', 'primario'), 'ancho extra');
  aplicarSi();
  // marca los enlaces que ya llevan variable, para redibujar solo cuando eso cambia
  document.querySelectorAll('#formPl .bt-url').forEach(i => { i.dataset.var = conVarUrl(i.value) ? '1' : '0'; });
  actualizaPl();
}

/* ---------- Archivos ---------- */
const ACEPTA_PL = { Foto: [/^image\/(jpeg|png)$/, 5, 'JPG o PNG'], Video: [/^video\/mp4$/, 16, 'MP4'], Documento: [/^application\/pdf$/, 100, 'PDF'] };
function medioDeSubida(nombre) { if (nombre === 'muestraH' && borPl.tipo === 'estandar') return borPl.encTipo; return borPl.medio; }
function subirPl(input) {
  const a = input.files[0], nombre = input.dataset.subir; if (!a) return;
  const medio = medioDeSubida(nombre), [tipo, mb, txt] = ACEPTA_PL[medio];
  if (!tipo.test(a.type)) return aviso(`Este archivo debe ser ${medio.toLowerCase()}: sube un ${txt}`);
  if (a.size > mb * 1024 * 1024) return aviso(`El archivo pesa más de ${mb} MB, el máximo de Meta para ${medio.toLowerCase()}`);
  if (subidasPl[nombre]) URL.revokeObjectURL(subidasPl[nombre].url);
  subidasPl[nombre] = { nombre: a.name, url: URL.createObjectURL(a), medio };
  repintaPl();
}

/* ---------- Guardar ---------- */
function guardarPl() {
  const b = leerPl(), p = datosPl(), ed = E.editPl && DB.plantillas.find(x => x.id === E.editPl), cuenta = ed ? ed.cuenta : N(b.numeroPl).cuenta, fin = botonesFinales(b);
  if (!/^[a-z0-9_]{1,512}$/.test(p.nombre)) return aviso('El nombre solo puede llevar minúsculas, números y guion bajo, sin espacios');
  if (!ed && DB.plantillas.some(x => x.cuenta === cuenta && x.nombre === p.nombre && (x.idioma || 'Español (MX)') === p.idioma)) return aviso('Ya hay una plantilla con ese nombre y ese idioma en esta cuenta');
  if (b.tipo !== 'auth' && !b.cuerpo.trim()) return aviso('El cuerpo es obligatorio');
  const err = erroresPl(b); if (err.length) return aviso(err[0]);
  const faltaEj = [...$('#formPl').querySelectorAll('.ejemplos-pl input')].find(i => !i.value.trim()); if (faltaEj) return aviso('Declara un ejemplo para cada variable');
  if (!ed && ((b.tipo === 'estandar' && ['Foto', 'Video', 'Documento'].includes(b.encTipo)) || b.tipo === 'oferta') && !p.archivo) return aviso('Sube el archivo de muestra del encabezado');
  for (const x of fin.filter(y => !y.sistema)) {
    if (!(x.texto || '').trim()) return aviso('Falta el texto de un botón');
    if (x.tipo === 'URL' && !/^https:\/\/\S+$/.test(x.url || '')) return aviso('El botón «' + x.texto + '» necesita un enlace que empiece con https://');
    if (x.tipo === 'URL' && x.conVar && !(x.ej || '').trim()) return aviso('Falta el ejemplo del final del enlace del botón «' + x.texto + '»');
    if (x.tipo === 'PHONE_NUMBER' && !/^\+\d[\d ]{7,19}$/.test(x.tel || '')) return aviso('El botón «' + x.texto + '» necesita el teléfono con + y código de país');
  }
  if (fin.length > 10) return aviso('Meta permite máximo 10 botones, contando los que agrega el sistema');
  if (b.tipo === 'oferta' && !b.oferta.trim()) return aviso('Falta el texto de la oferta');
  if (b.tipo === 'oferta' && !fin.some(x => x.tipo === 'URL')) return aviso('La oferta por tiempo limitado necesita su botón de URL');
  if (b.tipo === 'cupon' && !b.codigo.trim()) return aviso('Falta el ejemplo del código del cupón');
  if (b.tipo === 'carrusel') {
    if (b.tarjetas.length < 2 || b.tarjetas.length > 10) return aviso('El carrusel lleva de 2 a 10 tarjetas');
    if (!b.tBotones.length) return aviso('Las tarjetas llevan al menos un botón');
    const conTexto = b.tarjetas.filter(t => t.texto.trim()).length; if (conTexto && conTexto < b.tarjetas.length) return aviso('El texto de tarjeta va en todas o en ninguna');
    for (let i = 0; i < b.tarjetas.length; i++) {
      const t = b.tarjetas[i];
      if (!ed && (!subidasPl['tM' + i] || subidasPl['tM' + i].medio !== b.medio)) return aviso('Tarjeta ' + (i + 1) + ': sube su archivo de ' + b.medio.toLowerCase());
      for (let k = 0; k < b.tBotones.length; k++) { const x = t.b[k] || {}; if (!(x.texto || '').trim()) return aviso('Tarjeta ' + (i + 1) + ': falta el texto del botón ' + (k + 1)); if (b.tBotones[k] === 'Enlace' && !/^https:\/\/\S+$/.test(x.url || '')) return aviso('Tarjeta ' + (i + 1) + ': el botón ' + (k + 1) + ' necesita un enlace que empiece con https://'); if (b.tBotones[k] === 'Enlace' && conVarUrl(x.url) && !(x.ej || '').trim()) return aviso('Tarjeta ' + (i + 1) + ': falta el ejemplo del final del enlace'); }
    }
    for (let k = 0; k < b.tBotones.length; k++) if (b.tBotones[k] === 'Enlace') { const vars = b.tarjetas.map(t => conVarUrl((t.b[k] || {}).url)); if (vars.some(Boolean) && !vars.every(Boolean)) return aviso('Si el enlace de una tarjeta lleva variable, el de todas debe llevarla'); }
  }
  if (b.tipo === 'auth' && b.min !== '' && !(+b.min >= 1 && +b.min <= 90)) return aviso('La vigencia del código va de 1 a 90 minutos');
  if (b.tipo === 'auth' && b.otp !== 'Copiar código' && (!b.paquete || !b.firma)) return aviso('Para autocompletar o sin toque faltan el paquete y la firma de la app Android');
  if (b.tipo === 'auth' && b.otp.startsWith('Sin toque') && !b.terminos) return aviso('Para la entrega sin toque hay que aceptar las condiciones de Meta');
  const guardado = { ...p, bor: JSON.parse(JSON.stringify(b)), meta: crearMeta(b) };
  if (ed) { const antes = ed.estado; Object.assign(ed, { ...guardado, id: ed.id, cuenta: ed.cuenta, cat: ed.cat, idioma: ed.idioma || p.idioma, envios: ed.envios, clics: ed.clics, ventas: ed.ventas, motivo: '', estado: 'En revisión', archivo: p.archivo || ed.archivo, ediciones: [...(ed.ediciones || []), ...(antes === 'Aprobada' ? [Date.now()] : [])] }); E.editPl = null; cerrarModal(); render(); return aviso('Cambios enviados a revisión de Meta'); }
  DB.plantillas.unshift({ ...guardado, id: 'p' + Date.now(), cuenta, estado: 'En revisión' }); cerrarModal(); render(); aviso('Enviada a aprobación de Meta');
}
// Borrador a partir de una plantilla ya hecha (para editarla).
function borDesdePlantilla(p) {
  if (p.bor && p.bor.tBotones) return JSON.parse(JSON.stringify(p.bor));
  const tipo = p.tipo || ({ 'Carrusel': 'carrusel', 'Oferta por tiempo limitado': 'oferta', 'Código de cupón': 'cupon', 'Autenticación': 'auth' }[p.formato] || 'estandar'), b = borNuevo(tipo, p.nombre);
  const arr = o => Object.keys(o || {}).sort((x, y) => x - y).map(k => o[k]), ej = p.ejemplos || {};
  Object.assign(b, { cat: p.cat, idioma: p.idioma || 'Español (MX)', uso: p.uso || 'Campaña', cuerpo: tipo === 'auth' ? b.cuerpo : p.cuerpo || '', ejB: arr(ej.b), ejH: arr(ej.h), pie: tipo === 'auth' ? '' : p.pie || '', oferta: p.oferta || '', vence: p.vence !== false, codigo: p.codigo || '' });
  if (tipo === 'estandar') { b.encTipo = p.encTipo && p.encTipo !== 'Ninguno' ? p.encTipo : (p.encabezado ? 'Texto' : 'Ninguno'); b.encTexto = p.encabezado || ''; }
  if (tipo === 'cupon') { b.encTexto = p.encabezado || ''; b.encTipo = b.encTexto ? 'Texto' : 'Ninguno'; }
  if (tipo === 'oferta' || tipo === 'carrusel') b.medio = p.encTipo || 'Foto';
  const deBoton = s => s.startsWith('↗ ') ? { tipo: 'Enlace', texto: s.slice(2), url: 'https://tienda.com/' + (p.urlVar ? '{{1}}' : ''), ej: ej.u || '' } : s.startsWith('✆ ') ? { tipo: 'Llamar', texto: s.slice(2), tel: '+52 81 5550 0101' } : { tipo: 'Respuesta rápida', texto: s };
  if (tipo !== 'auth' && tipo !== 'carrusel') b.botones = (p.botones || []).filter(s => !s.startsWith('⧉') && s !== 'Darme de baja').map(deBoton);
  if (tipo === 'carrusel') { const t0 = (p.tarjetas || [])[0] || { botones: [] }; b.tBotones = (t0.botones || []).slice(0, 2).map(s => s.startsWith('↗ ') ? 'Enlace' : 'Respuesta rápida'); b.tarjetas = (p.tarjetas || []).map((t, i) => ({ texto: t.texto || '', ej: arr((ej.c || [])[i]), b: b.tBotones.map((tp, k) => ({ texto: ((t.botones || [])[k] || '').replace(/^[↗✆] /, ''), url: tp === 'Enlace' ? 'https://tienda.com/' : '' })) })); }
  if (tipo === 'auth') Object.assign(b, { otp: p.otp || 'Copiar código', min: p.min ? String(p.min) : '', paquete: p.paquete || '', firma: p.firma || '', seg: (p.cuerpo || '').includes('seguridad') });
  return b;
}
// Envío de una plantilla desde el chat: se piden todos sus parámetros antes de poder enviarla.
const varsDe = t => [...new Set([...(t || '').matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]))];
// Las variables no tienen nombre: el campo dice qué variable es y muestra el ejemplo que se declaró al crear la plantilla.
const ejDe = (p, lugar, k, i) => { const e = p.ejemplos || {}; const v = lugar === 'c' ? ((e.c || [])[i] || {})[k] : lugar === 'u' ? e.u : (e[lugar] || {})[k]; return v ? 'placeholder="Ejemplo: ' + esc(v) + '"' : ''; };
const btnUrl = p => ((p.botones || []).find(b => b.startsWith('↗')) || '↗ enlace').slice(2);
const llenar = (t, pref, vals) => (t || '').replace(/\{\{(\w+)\}\}/g, (m, k) => vals[pref + k] || m);
let plEnvio = null;
// Datos que pide una plantilla al enviarla, según la documentación de Meta (componentes del mensaje de plantilla):
// encabezado de texto o de medio (foto, video, documento o ubicación con latitud y longitud), variables del cuerpo
// (posicionales {{1}} o con nombre {{nombre}}), vencimiento de la oferta, código del cupón (20 caracteres; 15 en ofertas),
// final del enlace del botón de URL, y el código de un solo uso de autenticación (15 caracteres; va en el cuerpo y en el botón).
let plPrueba = false;
const esAuth = p => p.tipo === 'auth' || p.formato === 'Autenticación';
function modalEnviarPl(id, prueba) {
  const p = DB.plantillas.find(x => x.id === id), v = prueba ? null : CONV(), c = v && v.contacto ? C(v.contacto) : null; plEnvio = p; plPrueba = !!prueba;
  // En el chat sí se conoce al contacto: un atajo de un clic pone su nombre, y lo decide la persona.
  const nomC = c ? c.nombre.split(' ')[0] : '', atajo = n => nomC && !esAuth(p) && /^(h_|b_|c\d+_)/.test(n) ? `<a class="atajo-var" data-accion="usarNombreVar" data-campo="${n}" data-v="${esc(nomC)}">Usar el nombre del contacto (${esc(nomC)})</a>` : '';
  const inp = (et, nombre, tipo, valor = '', extra = '') => `<label class="campo"><span>${esc(et)} *</span><small class="tipo-p">${esc(tipo)}</small><input name="${nombre}" value="${esc(valor)}" required ${extra}></label>${atajo(nombre)}`;
  const acepta = { Foto: 'image/png,image/jpeg', Video: 'video/mp4', Documento: 'application/pdf' };
  const arch = (et, nombre, tipo, medio) => `<label class="campo"><span>${esc(et)} *</span><small class="tipo-p">${esc(tipo)}; se sube al enviar</small><input type="file" name="${nombre}" accept="${acepta[medio] || ''}" required></label>`;
  const medioTipo = { Foto: 'Imagen JPG o PNG, hasta 5 MB', Video: 'Video MP4, hasta 16 MB', Documento: 'Documento PDF, hasta 100 MB; se envía con su nombre de archivo' };
  let f = '';
  if (prueba) {
    const nums = numerosDeCuenta(p.cuenta);
    f += `<label class="campo"><span>1. Número de salida *</span><small class="tipo-p">Números de la cuenta ${esc((DB.cuentas.find(w => w.id === p.cuenta) || {}).nombre || '')}, dueña de la plantilla</small><select name="salida">${nums.map(n => `<option value="${n.id}">${esc(n.nombre)} · ${esc(n.tel)}</option>`).join('')}</select></label>`;
    f += `<label class="campo"><span>2. Número de destino *</span><small class="tipo-p">Formato internacional: + código de país y número, por ejemplo +52 81 1234 5678</small><input name="destino" placeholder="+52 81 1234 5678" required></label><span class="et">3. Datos de la plantilla</span>`;
  }
  if (!p.tarjetas && ['Foto', 'Video', 'Documento'].includes(p.encTipo)) f += arch(p.encTipo + ' del encabezado', 'hMedio', medioTipo[p.encTipo], p.encTipo);
  if (p.encTipo === 'Ubicación') f += inp('Latitud', 'lat', 'Número decimal, por ejemplo 25.6866', '', 'inputmode="decimal"') + inp('Longitud', 'lng', 'Número decimal, por ejemplo -100.3161', '', 'inputmode="decimal"') + inp('Nombre del lugar', 'lugar', 'Texto') + inp('Dirección', 'direccion', 'Texto');
  for (const k of varsDe(p.encabezado)) f += inp('Variable {{' + k + '}} del encabezado', 'h_' + k, 'Texto; el encabezado completo es de hasta 60 caracteres', '', ejDe(p, 'h', k));
  for (const k of varsDe(p.cuerpo)) f += esAuth(p) ? inp('Código de verificación', 'b_' + k, 'Texto de hasta 15 caracteres; va en el cuerpo y en el botón', '', 'maxlength="15"') : inp('Variable {{' + k + '}} del cuerpo', 'b_' + k, 'Texto', '', ejDe(p, 'b', k));
  if (p.oferta && p.vence) f += inp('La oferta vence el', 'vence', 'Fecha y hora; Meta la recibe en milisegundos', aLocal(new Date(Date.now() + 2 * DIA)), `type="datetime-local" min="${aLocal(new Date())}"`);
  if (p.codigo) f += inp('Código que se copia', 'codigo', 'Código de cupón de hasta ' + (p.oferta ? 15 : 20) + ' caracteres', '', `maxlength="${p.oferta ? 15 : 20}" placeholder="Ejemplo: ${esc(p.codigo)}"`);
  if (p.btnVars && p.btnVars.length) p.btnVars.forEach(x => { f += inp('Final del enlace del botón «' + x.texto + '» (índice ' + x.index + ')', 'u_' + x.index, 'Texto que se agrega al final del enlace; sin espacios', '', x.ej ? 'placeholder="Ejemplo: ' + esc(x.ej) + '"' : ''); });
  else if (p.urlVar) f += inp('Final del enlace del botón «' + btnUrl(p) + '»', 'u', 'Texto que se agrega al final del enlace; sin espacios', '', ejDe(p, 'u'));
  (p.tarjetas || []).forEach((t, i) => { f += `<div class="f-grupo"><h4>Tarjeta ${i + 1} · índice ${i}</h4>${arch((p.encTipo || 'Foto') + ' de la tarjeta (índice ' + i + ')', 'c' + i + '_medio', medioTipo[p.encTipo || 'Foto'], p.encTipo || 'Foto')}${varsDe(t.texto).map(k => inp('Variable {{' + k + '}} de la tarjeta ' + (i + 1) + ' (índice ' + i + ')', 'c' + i + '_' + k, 'Texto', '', ejDe(p, 'c', k, i))).join('')}${(t.btnVars || []).map(x => inp('Tarjeta ' + (i + 1) + ': final del enlace del botón «' + x.texto + '» (botón índice ' + x.index + ')', 'c' + i + '_u' + x.index, 'Texto que se agrega al final del enlace', '', x.ej ? 'placeholder="Ejemplo: ' + esc(x.ej) + '"' : '')).join('')}</div>`; });
  const titulo = (prueba ? 'Probar plantilla · ' : 'Enviar plantilla · ') + esc(p.nombre);
  const nota = prueba ? 'Llena los datos que esta plantilla necesita. Meta rechaza una plantilla a la que le falta un dato, así que el botón se activa cuando están todos.' : 'Llena los datos de esta plantilla. Meta rechaza una plantilla a la que le falta un dato, así que el botón de enviar se activa cuando están todos.';
  abrirModal(titulo, `<form id="formEnv" class="dos"><div><p class="nota">${nota}</p>${f || '<p>Esta plantilla no tiene datos por llenar.</p>'}</div><div><span class="et">${prueba ? 'Así llegará el mensaje' : 'Así lo recibirá ' + (c ? esc(c.nombre.split(' ')[0]) : 'el grupo')}</span><div class="previa" id="previaEnv"></div><p class="nota" id="faltanEnv"></p>${prueba ? '<details class="nota"><summary>Datos que se mandan a Meta</summary><pre class="json-pl" id="jsonEnv"></pre></details><p class="nota">Es una prueba: el prototipo no envía nada. Ya programado, este botón manda la plantilla al número de destino y se cobra como cualquier envío de su categoría.</p>' : ''}</div></form>`,
    (prueba ? btn('Cerrar', 'cerrarModal') + btn('Enviar prueba', 'enviarPrueba', 'primario', 'id="btnEnv"') : btn('Elegir otra plantilla', 'plantilla') + btn('Enviar plantilla', 'enviarPl', 'primario', 'id="btnEnv"')), 'ancho');
  pintaEnv();
}
// Mensaje que se manda a Meta con los datos llenos.
const idiomaMeta = t => (IDIOMAS_PL.find(x => x[0] === t) || [0, 'es_MX'])[1];
const paramTxt = (k, texto) => isNaN(k) ? { type: 'text', parameter_name: k, text: texto } : { type: 'text', text: texto };
function cargaMeta(p, vals) {
  const comp = [], medio = { Foto: 'image', Video: 'video', Documento: 'document' }, liga = t => ({ link: 'https://archivos.ejemplo/plantillas/' + p.nombre + '.' + ({ image: 'jpg', video: 'mp4', document: 'pdf' }[t]) });
  if (!p.tarjetas && medio[p.encTipo]) { const t = medio[p.encTipo]; const fh = vals.hMedio && vals.hMedio.name; comp.push({ type: 'header', parameters: [{ type: t, [t]: fh ? { link: '<' + fh + ' subido>' , ...(t === 'document' ? { filename: fh } : {}) } : (t === 'document' ? { ...liga(t), filename: p.nombre + '.pdf' } : liga(t)) }] }); }
  if (p.encTipo === 'Ubicación') comp.push({ type: 'header', parameters: [{ type: 'location', location: { latitude: vals.lat || '', longitude: vals.lng || '', name: vals.lugar || '', address: vals.direccion || '' } }] });
  if (varsDe(p.encabezado).length) comp.push({ type: 'header', parameters: varsDe(p.encabezado).map(k => paramTxt(k, vals['h_' + k] || '')) });
  if (varsDe(p.cuerpo).length) comp.push({ type: 'body', parameters: varsDe(p.cuerpo).map(k => paramTxt(k, vals['b_' + k] || '')) });
  if (p.oferta && p.vence) comp.push({ type: 'limited_time_offer', parameters: [{ type: 'limited_time_offer', limited_time_offer: { expiration_time_ms: vals.vence ? new Date(vals.vence).getTime() : 0 } }] });
  const bi = pre => (p.botones || []).findIndex(b => b.startsWith(pre));
  if (p.codigo && bi('⧉') >= 0) comp.push({ type: 'button', sub_type: 'copy_code', index: bi('⧉'), parameters: [{ type: 'coupon_code', coupon_code: vals.codigo || '' }] });
  if (p.btnVars && p.btnVars.length) p.btnVars.forEach(x => comp.push({ type: 'button', sub_type: 'url', index: x.index, parameters: [{ type: 'text', text: vals['u_' + x.index] || '' }] }));
  else if (p.urlVar && bi('↗') >= 0) comp.push({ type: 'button', sub_type: 'url', index: bi('↗'), parameters: [{ type: 'text', text: vals.u || '' }] });
  if (esAuth(p)) { const k = varsDe(p.cuerpo)[0]; comp.push({ type: 'button', sub_type: 'url', index: 0, parameters: [{ type: 'text', text: vals['b_' + k] || '' }] }); }
  if (p.tarjetas) comp.push({ type: 'carousel', cards: p.tarjetas.map((t, i) => { const tm = medio[p.encTipo || 'Foto'], fc = vals['c' + i + '_medio'] && vals['c' + i + '_medio'].name, cc = [{ type: 'header', parameters: [{ type: tm, [tm]: fc ? { link: '<' + fc + ' subido>' } : liga(tm) }] }]; if (varsDe(t.texto).length) cc.push({ type: 'body', parameters: varsDe(t.texto).map(k => paramTxt(k, vals['c' + i + '_' + k] || '')) }); (t.btnVars || []).forEach(x => cc.push({ type: 'button', sub_type: 'url', index: x.index, parameters: [{ type: 'text', text: vals['c' + i + '_u' + x.index] || '' }] })); return { card_index: i, components: cc }; }) });
  return { messaging_product: 'whatsapp', recipient_type: 'individual', to: soloDig(vals.destino || ''), type: 'template', template: { name: p.nombre, language: { code: idiomaMeta(p.idioma) }, components: comp } };
}
const destinoValido = d => { const x = soloDig(d || ''); return /^\s*\+/.test(d || '') && x.length >= 8 && x.length <= 15; };
function datosEnv() {
  const p0 = plEnvio, form = $('#formEnv'), vals = Object.fromEntries(new FormData(form));
  const faltan = [...form.querySelectorAll('[required]')].filter(i => !i.value.trim()).map(i => i.closest('label').querySelector('span').textContent.replace(' *', ''));
  const p = { ...p0, encabezado: llenar(p0.encabezado, 'h_', vals), cuerpo: llenar(p0.cuerpo, 'b_', vals), codigo: vals.codigo || p0.codigo, tarjetas: p0.tarjetas ? p0.tarjetas.map((t, i) => ({ ...t, texto: llenar(t.texto, 'c' + i + '_', vals) })) : undefined };
  const fa = (n, medio) => { const i = form.elements[n], a = i && i.files && i.files[0]; return a ? { nombre: a.name, url: URL.createObjectURL(a), medio } : null; };
  if (!p0.tarjetas && form.elements.hMedio) p.archivo = fa('hMedio', p0.encTipo);
  if (p.tarjetas) p.tarjetas = p.tarjetas.map((t, i) => ({ ...t, archivo: fa('c' + i + '_medio', p0.encTipo || 'Foto') || t.archivo }));
  if (p0.encTipo === 'Ubicación' && vals.lugar) p.encabezado = vals.lugar + (vals.direccion ? ' · ' + vals.direccion : '');
  return { p, valores: vals, faltan, completo: !faltan.length, medio: ['Foto', 'Video', 'Documento', 'Ubicación'].includes(p0.encTipo) ? p0.encTipo : '', vence: vals.vence ? fechaTxt(new Date(vals.vence)) : '' };
}
function pintaEnv() {
  const r = datosEnv(); $('#previaEnv').innerHTML = previaPlantilla(r.p);
  if (plPrueba) { const d = $('#formEnv [name=destino]').value; if (d.trim() && !destinoValido(d)) { r.faltan = r.faltan.filter(x => x !== '2. Número de destino'); r.faltan.push('el número de destino en formato internacional (+ código de país)'); } r.completo = !r.faltan.length; $('#jsonEnv').textContent = JSON.stringify(cargaMeta(plEnvio, r.valores), null, 2); }
  $('#btnEnv').disabled = !r.completo; $('#faltanEnv').textContent = r.completo ? 'Todo listo para enviar.' : 'Falta: ' + r.faltan.join(', ') + '.';
}
// Plantillas por número: el número lleva a su cuenta de WhatsApp Business, y la plantilla es de la cuenta.
const cuentaDe = num => DB.cuentas.find(w => w.id === N(num).cuenta) || { nombre: '—' };
const numerosDeCuenta = w => DB.numeros.filter(n => n.cuenta === w);
const plantillasDe = num => DB.plantillas.filter(p => !num || p.cuenta === N(num).cuenta);
function vPlantillas() {
  const sel = `<label class="en-linea">Número<select data-cambio="numPl"><option value="">Todos los números</option>${DB.numeros.map(x => `<option value="${x.id}" ${E.numPl === x.id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></label>`;
  const q = (E.buscaPl || '').toLowerCase().trim();
  const lista = plantillasDe(E.numPl).filter(p => !q || (p.nombre + ' ' + p.cuerpo + ' ' + p.cat + ' ' + p.formato).toLowerCase().includes(q));
  const busca = `<input id="buscaPl" class="buscador" placeholder="Buscar plantilla por nombre o texto" value="${esc(E.buscaPl || '')}">`;
  const tarjeta = p => `<div class="carta"><div class="c-top"><strong>${p.nombre}</strong>${estadoChip(p.estado)}</div><div class="d-fila">${chip(p.cat, 'azul')}${chip(p.formato, 'gris')}${chip(p.idioma || 'Español (MX)', 'gris')}${p.uso ? chip(p.uso, 'gris') : ''}</div><div class="previa">${previaPlantilla(p)}</div>${p.motivo ? `<small class="rojo">${esc(p.motivo)}</small>` : ''}<div class="metricas-pl"><div><small>Envíos</small><b>${(p.envios || 0).toLocaleString('es-MX')}</b></div><div><small>Clics</small><b>${(p.clics || 0).toLocaleString('es-MX')}</b></div><div title="Contactos que llegaron a una etapa Ganada dentro de los 15 días siguientes al envío"><small>Ventas</small><b>${(p.ventas || 0).toLocaleString('es-MX')}</b></div></div><small class="nota">Números: ${esc(numerosDeCuenta(p.cuenta).map(n => n.nombre).join(', ') || 'ninguno')}</small><div class="acciones-pl">${p.estado === 'Aprobada' ? btn('Probar plantilla', 'probarPl', '', `data-id="${p.id}"`) : ''}${['Aprobada', 'Rechazada', 'Pausada'].includes(p.estado) ? btn('Editar', 'editarPl', 'enlace', `data-id="${p.id}"`) : ''}${btn('Eliminar', 'borrarPl', 'enlace rojo', `data-id="${p.id}"`)}</div></div>`;
  return pagina('Plantillas de Meta', 'Solo las aprobadas se pueden usar en el chat y en campañas. Cada plantilla es de una cuenta de WhatsApp Business y la comparten todos los números de esa cuenta', sel + busca + btn('+ Crear plantilla', 'nuevaPlantilla', 'primario'),
    (E.numPl ? `<p class="nota">El número ${esc(N(E.numPl).nombre)} es de la cuenta ${esc(cuentaDe(E.numPl).nombre)}; estas son sus plantillas.</p>` : '') + `<p class="nota">${lista.length} ${lista.length === 1 ? 'plantilla' : 'plantillas'}. Ventas: contactos que llegaron a una etapa Ganada dentro de los 15 días siguientes a recibir la plantilla.</p>` +
    (lista.length ? `<div class="rejilla">${lista.map(tarjeta).join('')}</div>` : '<p class="nota">No hay plantillas que coincidan.</p>'));
}
// Editar una plantilla: Meta deja editar el contenido, no el nombre, el idioma ni la categoría; una aprobada se edita
// como máximo una vez cada 24 horas y 10 veces en 30 días, y vuelve a revisión.
function editarPl(id) {
  const p = DB.plantillas.find(x => x.id === id), H = 3600000, ahoraMs = Date.now(), eds = (p.ediciones || []).filter(t => ahoraMs - t < 30 * 24 * H);
  if (p.estado === 'Aprobada' && eds.some(t => ahoraMs - t < 24 * H)) return aviso('Meta deja editar una plantilla aprobada una vez cada 24 horas');
  if (p.estado === 'Aprobada' && eds.length >= 10) return aviso('Meta deja editar una plantilla aprobada hasta 10 veces en 30 días');
  E.editPl = id; subidasPl = {}; borPl = borDesdePlantilla(p); borPl.numeroPl = (numerosDeCuenta(p.cuenta)[0] || {}).id;
  modalPlantilla(borPl.tipo, null, true);
  if (p.estado === 'Aprobada') { const n = document.createElement('p'); n.className = 'nota'; n.textContent = 'Ediciones en los últimos 30 días: ' + eds.length + ' de 10 (una cada 24 horas).'; const r = $('.datos-fijos'); if (r) r.appendChild(n); }
}
function borrarPl(id) {
  const p = DB.plantillas.find(x => x.id === id), usada = DB.campanas.find(k => k.plantilla === p.nombre && k.estado === 'Programada');
  if (usada) return aviso(`No se puede eliminar: la campaña programada "${usada.nombre}" la usa. Cancélala o cámbiale la plantilla primero.`);
  abrirModal('Eliminar plantilla · ' + esc(p.nombre), `<p>Se elimina en Meta, en todos sus idiomas, y deja de aparecer en el chat y en campañas.</p><p class="nota">Meta no deja volver a usar el nombre <b>${esc(p.nombre)}</b> durante 30 días. Lo ya enviado y sus reportes se conservan.</p>`,
    btn('Cancelar', 'cerrarModal') + btn('Eliminar plantilla', 'confirmarBorrarPl', 'primario rojo-btn', `data-id="${p.id}"`));
}
// Respuestas rápidas por número: cada una es para "Todos los números" o "Solo el número…", igual que los mensajes automáticos.
const rapidasDe = num => DB.respuestas.filter(r => !r.numero || !num || r.numero === num);
const POR_PAGINA_RAP = 12;
function vRespuestas() {
  const sel = `<label class="en-linea">Número<select data-cambio="numRap"><option value="">Todos los números</option>${DB.numeros.map(x => `<option value="${x.id}" ${E.numRap === x.id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></label>`;
  const q = (E.buscaRap || '').toLowerCase().trim();
  const lista = rapidasDe(E.numRap).filter(r => !q || (r.titulo + ' ' + r.texto).toLowerCase().includes(q));
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA_RAP)), pag = Math.min(E.pagRap || 1, paginas), vista = lista.slice((pag - 1) * POR_PAGINA_RAP, pag * POR_PAGINA_RAP);
  const busca = `<input id="buscaRap" class="buscador" placeholder="Buscar por título o texto" value="${esc(E.buscaRap || '')}">`;
  const nav = paginas > 1 ? `<div class="paginado">${btn('‹ Anterior', 'pagRap', '', `data-p="${pag - 1}" ${pag === 1 ? 'disabled' : ''}`)}<span>Página ${pag} de ${paginas}</span>${btn('Siguiente ›', 'pagRap', '', `data-p="${pag + 1}" ${pag === paginas ? 'disabled' : ''}`)}</div>` : '';
  const tarjeta = r => `<div class="carta"><div class="c-top"><strong>${esc(r.titulo)}</strong>${chip(numeroTxt(r.numero), r.numero ? 'azul' : 'gris')}</div><p class="recorte">${esc(r.texto)}</p>${r.archivo ? `<small>${ico('plant')} ${esc(r.archivo)}</small>` : ''}<div class="acciones-pl">${btn('Editar', 'editarRespuesta', 'enlace', 'data-id="' + r.id + '"')}${btn('Eliminar', 'eliminarRespuesta', 'enlace rojo', 'data-id="' + r.id + '"')}</div></div>`;
  return pagina('Respuestas rápidas', 'Mensajes guardados para usar desde el chat. En cada chat solo aparecen las de su número y las de todos los números', sel + busca + btn('+ Nueva respuesta', 'nuevaRespuesta', 'primario'),
    `<p class="nota">${lista.length} ${lista.length === 1 ? 'respuesta' : 'respuestas'}${q ? ' que coinciden con la búsqueda' : ''}${paginas > 1 ? ` · mostrando ${(pag - 1) * POR_PAGINA_RAP + 1} a ${(pag - 1) * POR_PAGINA_RAP + vista.length}` : ''}</p>` +
    (vista.length ? `<div class="rejilla">${vista.map(tarjeta).join('')}</div>` + nav : '<p class="nota">No hay respuestas rápidas que coincidan.</p>'));
}
function formRespuesta(r) {
  const x = r || {};
  formModal(r ? 'Editar respuesta rápida' : 'Nueva respuesta rápida', [
    { id: 't', et: 'Título', valor: x.titulo || '' },
    { id: 'nu', et: 'Conversaciones de', tipo: 'select', ops: opsNumero(), valor: numeroTxt(x.numero) },
    { tipo: 'nota', et: 'En el chat solo aparece en las conversaciones de ese número. Con "Todos los números" aparece en todas.' },
    { id: 'm', et: 'Mensaje', tipo: 'area', valor: x.texto || '' }
  ], f => {
    if (!(f.t || '').trim()) return aviso('Falta el título');
    if (!(f.m || '').trim()) return aviso('Falta el mensaje');
    const datos = { titulo: f.t.trim(), numero: numeroDeOp(f.nu), texto: f.m };
    if (r) Object.assign(r, datos); else DB.respuestas.push({ id: 'r' + Date.now(), archivo: '', ...datos });
    render();
  }, r ? 'Guardar' : 'Crear');
}
// Mensajes automáticos. Mismos términos que embudos y campañas: "conversaciones de", "palabras clave", "fecha de inicio" y "fecha de vencimiento".
const numeroTxt = id => id ? 'Solo el número ' + N(id).nombre : 'Todos los números';
const opsNumero = () => ['Todos los números', ...DB.numeros.map(n => 'Solo el número ' + n.nombre)];
const numeroDeOp = op => (DB.numeros.find(n => 'Solo el número ' + n.nombre === op) || {}).id || null;
const fechasAuto = a => a.inicio && a.fin ? fechaTxt(new Date(a.inicio)) + ' – ' + fechaTxt(new Date(a.fin)) : 'Siempre';
// El estado sale del interruptor y de las fechas: Apagado, Programado, Activo o Finalizado.
const estadoAuto = a => { if (!a.activo) return 'Apagado'; if (!(a.inicio && a.fin)) return 'Activo'; const t = Date.now(); return t < new Date(a.inicio) ? 'Programado' : t > new Date(a.fin) ? 'Finalizado' : 'Activo'; };
const regexValida = r => { try { new RegExp(r, 'i'); return true; } catch (e) { return false; } };
function pruebaRegex() { const f = $('#formGen'), d = $('#resRegex'); if (!f || !d || !f.elements.r) return; const r = f.elements.r.value.trim(), t = f.elements.prueba.value; if (!r) return d.textContent = 'Escribe la expresión regular.'; if (!regexValida(r)) return d.innerHTML = '<b class="rojo">La expresión no es válida.</b>'; if (!t) return d.textContent = 'Escribe un mensaje de ejemplo para ver si coincide.'; const m = t.match(new RegExp(r, 'i')); d.innerHTML = m ? `<b class="verde-t">Sí coincide</b> con «${esc(m[0])}».` : '<b class="rojo">No coincide</b> con ese mensaje.'; }
function formAuto(a) {
  const n = a || { nombre: '', numero: null, cuando: 'Por defecto', claves: '', coincidencia: 'Palabra completa', mensaje: '', inicio: '', fin: '' };
  const opCuando = { 'Por defecto': 'Por defecto (primer mensaje del cliente)', 'Fuera de horario': 'Fuera de horario', 'Palabras clave': 'Palabras clave', 'Expresión regular': 'Expresión regular (avanzado)' };
  formModal(a ? 'Editar mensaje automático' : 'Nuevo mensaje automático', [
    { id: 'n', et: 'Nombre', valor: n.nombre },
    { id: 'nu', et: 'Este mensaje responde en las conversaciones de', tipo: 'select', ops: opsNumero(), valor: numeroTxt(n.numero) },
    { id: 't', et: 'Cuándo se envía', tipo: 'select', ops: Object.values(opCuando), valor: opCuando[n.cuando] },
    { id: 'p', si: ['t', 'Palabras clave'], et: 'Palabras clave, separadas por coma', ph: 'precio, costo', valor: n.claves },
    { tipo: 'nota', si: ['t', 'Palabras clave'], et: 'Se envía si el mensaje del cliente trae alguna de estas palabras completas. No importan mayúsculas ni acentos, igual que en embudos y campañas.' },
    { id: 'r', si: ['t', 'Expresión regular'], et: 'Expresión regular. Ejemplo: pedido\\s*#?\\d{4,6} reconoce "pedido 4821" o "Pedido #48210"', ph: 'pedido\\s*#?\\d{4,6}', valor: n.regex || '' },
    { id: 'prueba', si: ['t', 'Expresión regular'], et: 'Pruébala con un mensaje de ejemplo', ph: 'Hola, ¿cómo va mi pedido 4821?', valor: '' },
    { tipo: 'nota', si: ['t', 'Expresión regular'], et: '<span id="resRegex">Escribe un mensaje de ejemplo para ver si coincide.</span> No importan mayúsculas. Úsala solo cuando una palabra clave no alcanza, por ejemplo para reconocer números de pedido.' },
    { id: 'm', et: 'Mensaje', tipo: 'area', valor: n.mensaje },
    { id: 'v', et: 'Cuándo está en uso', tipo: 'select', ops: ['Siempre', 'Entre dos fechas'], valor: n.inicio && n.fin ? 'Entre dos fechas' : 'Siempre' },
    { id: 'i', si: ['v', 'Entre dos fechas'], et: 'Fecha inicial', tipo: 'datetime-local', valor: n.inicio },
    { id: 'f', si: ['v', 'Entre dos fechas'], et: 'Fecha final', tipo: 'datetime-local', valor: n.fin },
    { tipo: 'nota', si: ['v', 'Entre dos fechas'], et: 'Antes de la fecha inicial el mensaje queda Programado y no se envía; después de la fecha final queda Finalizado.' }
  ], f => {
    const cuando = f.t.startsWith('Por defecto') ? 'Por defecto' : f.t.startsWith('Expresión regular') ? 'Expresión regular' : f.t, conFechas = f.v === 'Entre dos fechas';
    if (cuando === 'Expresión regular') { if (!(f.r || '').trim()) return aviso('Falta la expresión regular'); if (!regexValida(f.r)) return aviso('La expresión regular no es válida; revisa paréntesis y corchetes'); }
    if (!f.m.trim()) return aviso('Falta el mensaje');
    if (cuando === 'Palabras clave' && !f.p.trim()) return aviso('Faltan las palabras clave');
    if (conFechas && (!f.i || !f.f)) return aviso('Faltan la fecha inicial y la fecha final');
    if (conFechas && new Date(f.f) <= new Date(f.i)) return aviso('La fecha final debe ser después de la inicial');
    const datos = { nombre: f.n || 'Mensaje automático', numero: numeroDeOp(f.nu), cuando, claves: cuando === 'Palabras clave' ? f.p : '', regex: cuando === 'Expresión regular' ? f.r.trim() : '', mensaje: f.m, inicio: conFechas ? f.i : '', fin: conFechas ? f.f : '' };
    if (a) Object.assign(a, datos); else DB.automaticos.push({ id: 'a' + Date.now(), ...datos, activo: true });
    render(); aviso(a ? 'Cambios guardados' : 'Mensaje automático guardado');
  }, a ? 'Guardar cambios' : 'Guardar');
}
function vAutomaticos() {
  return pagina('Mensajes automáticos', 'Se envían solos cuando se cumple su condición; a cada mensaje del cliente se le aplica uno solo', btn('+ Nuevo mensaje automático', 'nuevoAuto', 'primario'), tabla(['Nombre', 'Conversaciones de', 'Cuándo se envía', 'Palabras clave o expresión', 'Mensaje', 'En uso', 'Estado', 'Encendido', ''], DB.automaticos.map(a => ({ c: [`<strong>${esc(a.nombre)}</strong>`, numeroTxt(a.numero), chip(a.cuando, 'azul'), a.cuando === 'Palabras clave' ? esc(a.claves) : a.cuando === 'Expresión regular' ? `<code>${esc(a.regex)}</code>` : '<small class="nota">No aplica</small>', esc(a.mensaje), fechasAuto(a), estadoChip(estadoAuto(a)), `<label class="interruptor"><input type="checkbox" data-cambio="autoActivo" data-id="${a.id}" ${a.activo ? 'checked' : ''}><i></i></label>`, btn('Editar', 'editarAuto', 'enlace', `data-id="${a.id}"`)] }))));
}
// Tipos de contacto: catálogo que administra cada empresa. Ningún cálculo depende de ellos.
const tipoDe = c => c.tipo || 'Sin tipo';
const chipTipo = c => chip(tipoDe(c), c.tipo ? 'azul' : 'gris');
const usanTipo = t => DB.contactos.filter(c => c.tipo === t).length;
function cartaTipos() {
  return `<div class="carta"><h3>Tipos de contacto ${btn('+ Tipo', 'nuevoTipo', 'enlace')}</h3><p class="nota">Tu propia lista para clasificar contactos. Es la que aparece en "Nuevo contacto".</p>${DB.tiposContacto.map((t, i) => `<div class="d-fila etapa"><span>${chip(t, 'azul')} <small>${usanTipo(t)} ${usanTipo(t) === 1 ? 'contacto' : 'contactos'}</small></span><span>${btn('Renombrar', 'renombrarTipo', 'enlace', `data-i="${i}"`)}${btn('Eliminar', 'eliminarTipo', 'enlace rojo', `data-i="${i}"`)}</span></div>`).join('') || '<small class="nota">No hay tipos. Los contactos quedan "Sin tipo".</small>'}</div>`;
}
function vTags() {
  return pagina('Tags y embudos', 'Un tag es una etiqueta que el contacto carga; una etapa es el paso en el que va dentro de un embudo', btn('+ Grupo de tags', 'nuevoGrupo') + btn('+ Nuevo embudo', 'nuevoEmbudo', 'primario'), `<div class="rejilla dos">
    <div class="carta"><h3>Grupos de tags</h3>${DB.gruposTags.map(g => `<div class="f-grupo"><h4>${esc(g.nombre)} ${btn('+ Tag', 'nuevoTag', 'enlace', `data-id="${g.id}"`)}</h4><div class="tags">${g.tags.map(t => `<span class="tag-fila ${t.inactivo ? 'fila-inactiva' : ''}"><a class="tag" style="--c:${t.c}" data-accion="editarTag" data-id="${t.id}" title="Editar tag">${esc(t.n)}</a>${swEstado('tagActivo', `data-id="${t.id}"`, !t.inactivo)}</span>`).join('')}</div></div>`).join('')}<p class="nota">El interruptor activa o desactiva el tag sin entrar a editarlo. Un tag inactivo ya no se puede poner; los contactos que lo tienen lo conservan.</p></div>
    <div class="carta"><h3>Embudos y sus etapas</h3><p class="nota">El interruptor activa o desactiva el embudo sin entrar a editarlo.</p>${DB.embudos.map(b => `<div class="f-grupo"><h4 class="emb-cab"><span>${esc(b.n)} ${chip({ general: 'General', tickets: 'Tickets', campana: 'Campaña' }[b.tipo], 'gris')}${b.inactivo ? ' ' + chip('Inactivo', 'rojo') : ''}</span><span>${b.tipo === 'tickets' ? '<small class="nota" title="El embudo de tickets no se puede desactivar ni borrar">Siempre activo</small>' : swEstado('embudoActivo', `data-id="${b.id}"`, !b.inactivo)}${btn('Editar', 'editarEmbudo', 'enlace', `data-id="${b.id}"`)}${btn('Etapas', 'abrirEtapas', 'enlace', `data-id="${b.id}"`)}${b.tipo === 'general' ? btn('Eliminar', 'eliminarEmbudo', 'enlace rojo', `data-id="${b.id}"`) : ''}</span></h4><div class="tags">${b.etapas.map(e => `<span class="mini ${e.inactivo ? 'inactiva' : ''}" style="--c:${e.c}">${esc(e.n)}${e.tipo === 'ganada' ? ' ✓' : e.tipo === 'perdida' ? ' ✕' : ''}${e.inactivo ? ' · inactiva' : ''}</span>`).join('')}</div>${b.tipo === 'general' ? `<small class="nota">${esc(filtroTxt(b))}</small>` : b.tipo === 'campana' ? `<small class="nota">Palabras clave: ${(b.claves || []).length ? esc(b.claves.join(', ')) : 'ninguna'}</small>` : ''}</div>`).join('')}<p class="nota">✓ resultado Ganada · ✕ resultado Perdida · sin marca, En proceso. Los embudos de campaña se crean solos y se archivan al terminar la campaña.</p></div>${cartaTipos()}</div>`);
}
function vBajas() { return pagina('Bajas', 'Lista de supresión: ninguna campaña puede enviar a estos teléfonos', btn('Exportar CSV', 'exportar') + btn('+ Baja manual', 'nuevaBaja', 'primario'), tabla(['Teléfono', 'Contacto', 'Fecha', 'Origen', 'Campaña', ''], DB.bajas.map((b, i) => ({ c: [b.tel, esc(b.contacto), b.fecha, chip(b.origen, 'gris'), esc(b.campana), puede('A') ? btn('Quitar baja', 'quitarBaja', 'enlace rojo', `data-i="${i}"`) : ''] }))) + `<p class="nota">Palabras de baja: BAJA, STOP. Toda plantilla de marketing lleva botón de baja.</p>`); }
// Estado de acceso al CRM: un usuario inactivo no puede entrar; no se borra y su historial se conserva.
const activos = () => DB.usuarios.filter(u => !u.inactivo);
const pendientesDe = id => ({ convs: DB.conversaciones.filter(v => v.resp === id && v.estado === 'abierta'), tickets: DB.tickets.filter(k => k.asignado === id && estadoTk(k) !== 'Cerrado') });
function vUsuarios() {
  return pagina('Usuarios', `${activos().length} de ${DB.empresa.usuariosMax} usuarios activos de tu plan · los inactivos no ocupan lugar`, btn('+ Invitar usuario', 'nuevoUsuario', 'primario'), tabla(['Nombre', 'Correo', 'Rol', 'Sucursal', 'Números', 'Disponibilidad', 'Acceso al CRM'], DB.usuarios.map(u => ({ attr: u.inactivo ? 'class="fila-inactiva"' : '', c: [`<span class="avatar chico">${u.ini}</span> <strong>${esc(u.nombre)}</strong>`, esc(u.correo), chip(u.rol, 'azul'), u.sucursal, u.numeros.map(n => N(n).nombre).join(', ') || '—', u.inactivo ? '<small class="nota">No aplica</small>' : `<i class="punto ${u.disp ? 'ok' : ''}"></i> ${u.disp ? 'Disponible' : 'No disponible'}`, `<span class="estado-sw">${swEstado('usuarioActivo', `data-id="${u.id}"`, !u.inactivo)}<b>${u.inactivo ? 'Inactivo' : 'Activo'}</b>${u.inactivo ? ` <small class="nota">desde el ${esc(u.inactivoDesde || 'hoy')}</small>` : ''}</span>`] }))));
}
// Empresa: los datos de la empresa que usa el CRM. Solo el administrador la edita. El ícono se ve en la barra lateral.
const iniEmpresa = () => (DB.empresa.nombre || 'E').split(/\s+/).filter(x => x.length > 3).filter((x, i, a) => i === 0 || i === a.length - 1).map(x => x[0]).join('').toUpperCase() || 'E';
const logoMenu = () => E.rol !== 'P' && DB.empresa.icono ? `<span class="logo con-img"><img src="${DB.empresa.icono}" alt=""></span>` : `<span class="logo">${E.rol === 'P' ? 'E' : esc(iniEmpresa())}</span>`;
function vEmpresa() {
  const e = DB.empresa, v = k => esc((E.empTmp || e)[k] || '');
  // Logo e ícono: cada uno en su línea; a la izquierda el nombre, la ayuda y los botones, y a la derecha la imagen.
  const img = (k, et, medida, ancho) => `<div class="fila-img"><div class="fila-img-datos"><span class="et-img">${et}</span><small class="tipo-p">${medida}</small><div class="img-emp"><label class="btn">Elegir imagen<input type="file" accept="image/png,image/jpeg,image/svg+xml" data-img="${k}" hidden></label>${e[k] ? btn('Quitar', 'quitarImg', 'enlace rojo', `data-k="${k}"`) : ''}</div></div><div class="img-prev ${ancho ? 'ancho' : ''}">${e[k] ? `<img src="${e[k]}" alt="">` : `<b>${esc(iniEmpresa())}</b>`}</div></div>`;
  return pagina('Empresa', 'Datos de la empresa que usa el CRM. Solo el administrador los cambia.', btn('Guardar cambios', 'guardarEmpresa', 'primario'), `<form id="formEmp" class="rejilla dos">
    <div class="carta"><h3>Datos de la empresa</h3>
      <div class="imgs-emp">${img('logo', 'Logo', 'PNG, JPG o SVG, horizontal, de 512 × 128 px o más; hasta 2 MB', true)}${img('icono', 'Ícono cuadrado', 'PNG o JPG de 512 × 512 px; hasta 2 MB. Se ve en la barra lateral', false)}</div>
      <label class="campo"><span>Nombre comercial *</span><input name="nombre" value="${v('nombre')}" maxlength="200"></label>
      <label class="campo"><span>Razón social o nombre legal</span><input name="razon" value="${v('razon')}" maxlength="250"></label>
      <div class="dos-campos"><label class="campo"><span>Teléfono</span><input name="tel" value="${v('tel')}" placeholder="+52 81 5550 0100" maxlength="20"></label><label class="campo"><span>Correo</span><input name="correo" type="email" value="${v('correo')}" placeholder="contacto@empresa.com"></label></div>
      <label class="campo"><span>Domicilio</span><textarea name="domicilio" rows="2" maxlength="500">${v('domicilio')}</textarea></label>
      <label class="campo"><span>Sitio web o red social</span><input name="web" value="${v('web')}" placeholder="https://www.empresa.com o https://instagram.com/empresa" maxlength="300"></label>
      <label class="campo"><span>Zona horaria</span><select name="zona">${['America/Mexico_City', 'America/Monterrey', 'America/Cancun', 'America/Chihuahua', 'America/Hermosillo', 'America/Tijuana'].map(z => `<option ${(e.zona || 'America/Mexico_City') === z ? 'selected' : ''}>${z}</option>`).join('')}</select></label>
      <p class="nota">La zona horaria manda sobre el horario de atención, la programación de campañas y los reportes.</p>
    </div>
    <div class="carta"><h3>Descripción del negocio</h3>
      <p class="aviso-ia">Estos campos son para el agente de IA, que hoy está fuera de alcance. Se pueden llenar desde ya; todavía no los usa ninguna función.</p>
      <label class="campo"><span>¿A qué se dedica la empresa?</span><textarea name="giro" rows="3" maxlength="1000" placeholder="Ejemplo: vendemos aromas para el hogar por catálogo y en línea.">${v('giro')}</textarea></label>
      <label class="campo"><span>¿Qué vende?</span><textarea name="vende" rows="3" maxlength="1000" placeholder="Velas, difusores, aceites esenciales y kits de regalo.">${v('vende')}</textarea></label>
      <label class="campo"><span>¿Qué no vende?</span><textarea name="noVende" rows="3" maxlength="1000" placeholder="No vendemos perfumes corporales ni hacemos envíos fuera de México.">${v('noVende')}</textarea></label>
    </div>
    <div class="carta"><h3>Límite de envíos de plantillas</h3>
      <p class="nota">Cuántas plantillas puede mandar la empresa desde la bandeja. Solo cuenta las que un usuario envía desde el chat; no cuenta campañas ni mensajes automáticos.</p>
      <label class="campo"><span>Límite</span><select name="limTipo">${['Sin límite', 'Limitado en total'].map(o => `<option ${((E.empTmp || e).limTipo || 'Sin límite') === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
      ${siHtml(`<div class="dos-campos"><label class="campo"><span>Periodo</span><select name="limPeriodo">${['Diario', 'Semanal', 'Mensual'].map(o => `<option ${((E.empTmp || e).limPeriodo || 'Diario') === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label><label class="campo"><span>Cantidad (al menos 1)</span><input name="limCant" type="number" min="1" value="${v('limCant') || 100}"></label></div><p class="nota">Usadas en este periodo: <b>${e.limUsadas || 0}</b>${e.limTipo === 'Limitado en total' ? ' de ' + e.limCant : ''}. Al llegar al límite la bandeja avisa y no deja enviar más plantillas hasta el siguiente periodo.</p>`, 'limTipo', 'Limitado')}
    </div>
    <div class="carta"><h3>Datos de facturación</h3>
      <p class="nota">Datos del SAT para la factura del servicio del CRM a esta empresa.</p>
      <label class="campo"><span>Razón social (como aparece en la constancia fiscal)</span><input name="fRazon" value="${v('fRazon')}" maxlength="300" placeholder="AROMAS DEL NORTE"></label>
      <div class="dos-campos"><label class="campo"><span>RFC</span><input name="rfc" value="${v('rfc')}" maxlength="13" placeholder="ADN150312AB1" style="text-transform:uppercase"></label><label class="campo"><span>Código postal fiscal</span><input name="fCp" value="${v('fCp')}" maxlength="5" inputmode="numeric" placeholder="64000"></label></div>
      <label class="campo"><span>Régimen fiscal</span><select name="regimen"><option value="">Elige el régimen</option>${REGIMENES.map(([c, n]) => `<option value="${c}" ${(E.empTmp || e).regimen === c ? 'selected' : ''}>${c} · ${n}</option>`).join('')}</select></label>
      <label class="campo"><span>Uso del CFDI</span><select name="usoCfdi"><option value="">Elige el uso</option>${USOS_CFDI.map(([c, n]) => `<option value="${c}" ${(E.empTmp || e).usoCfdi === c ? 'selected' : ''}>${c} · ${n}</option>`).join('')}</select></label>
      <label class="campo"><span>Correo de facturación</span><input name="fCorreo" type="email" value="${v('fCorreo')}" placeholder="facturas@empresa.com"></label>
      <p class="nota">RFC de 12 caracteres para persona moral o 13 para persona física. El régimen debe corresponder al tipo de RFC.</p>
    </div></form>`);
}
// Marca automática del permiso: el cliente responde que sí (o toca un botón que empieza con "Sí") a la última plantilla que se le envió.
function permisoAutomatico(v, texto) {
  const c = v.contacto && C(v.contacto); if (!c || c.consent !== 'sin') return;
  const prev = v.msgs.slice(0, -1).reverse().find(m => m.de !== 's'); if (!prev || prev.tipo !== 'plantilla') return;
  const t = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (!/^(si|sip|claro|acepto|de acuerdo|ok|si,|si\b)/.test(t)) return;
  c.consent = 'otorgado'; c.permiso = { fecha: fCorta(new Date()), origen: 'respondió que sí a una plantilla' };
  v.msgs.push({ de: 's', t: 'Se registró que ' + c.nombre + ' acepta campañas porque respondió que sí a la plantilla', h: ahora() });
}
// Límite de plantillas enviadas desde la bandeja (no cuenta campañas ni automáticos).
const limiteAlcanzado = () => DB.empresa.limTipo === 'Limitado en total' && (DB.empresa.limUsadas || 0) >= DB.empresa.limCant;
// Catálogos del SAT más usados para la facturación (clave y nombre).
const REGIMENES = [['601', 'General de Ley Personas Morales', 'M'], ['603', 'Personas Morales con Fines no Lucrativos', 'M'], ['605', 'Sueldos y Salarios', 'F'], ['606', 'Arrendamiento', 'F'], ['612', 'Personas Físicas con Actividades Empresariales y Profesionales', 'F'], ['616', 'Sin obligaciones fiscales', 'F'], ['621', 'Incorporación Fiscal', 'F'], ['625', 'Actividades Empresariales con ingresos a través de Plataformas Tecnológicas', 'F'], ['626', 'Régimen Simplificado de Confianza', 'A']];
const USOS_CFDI = [['G01', 'Adquisición de mercancías'], ['G03', 'Gastos en general'], ['I04', 'Equipo de cómputo y accesorios'], ['I08', 'Otra maquinaria y equipo'], ['S01', 'Sin efectos fiscales'], ['CP01', 'Pagos']];
function vPlan() {
  const e = DB.empresa, uso = (a, b) => `<div class="progreso"><i style="width:${a / b * 100}%"></i></div><small>${a} de ${b}</small>`;
  return pagina('Mi plan', 'Paquete actual y uso', '', `<div class="rejilla dos"><div class="carta"><h3>${e.plan}</h3><p class="alerta suave">Te quedan ${e.diasPrueba} días de prueba. Al terminar, la cuenta queda en pausa hasta que se active un paquete.</p>${btn('Ver cómo se ve la cuenta en pausa', 'ir', '', 'data-ruta="pausa"')}</div><div class="carta"><h3>Uso</h3><span class="et">Usuarios</span>${uso(DB.usuarios.length, e.usuariosMax)}<span class="et">Números conectados</span>${uso(DB.numeros.length, e.numerosMax)}</div></div>`);
}
function vEmpresas() {
  const acc = (e, i) => e.estado === 'Activa' ? btn('Suspender', 'empAccion', 'enlace rojo', `data-i="${i}" data-e="Suspendida"`) : e.estado === 'En prueba' ? btn('Activar paquete', 'empAccion', 'enlace', `data-i="${i}" data-e="Activa"`) + btn('Extender prueba', 'empExtender', 'enlace', `data-i="${i}"`) : btn(e.estado === 'Suspendida' ? 'Reactivar' : 'Activar paquete', 'empAccion', 'enlace', `data-i="${i}" data-e="Activa"`);
  return pagina('Empresas', 'Empresas registradas en la plataforma', '', tabla(['Empresa', 'Estado', 'Paquete', 'Fin de prueba', 'Usuarios', 'Números', 'Alta', 'Acciones'], DB.empresas.map((e, i) => ({ c: [`<strong>${esc(e.nombre)}</strong>`, estadoChip(e.estado), e.plan, e.fin, e.usuarios, e.numeros, e.alta, acc(e, i)] }))));
}
function vPaquetes() { return pagina('Paquetes', 'Lo que incluye cada paquete', '', tabla(['Paquete', 'Conexión', 'Usuarios', 'Números', 'Campañas masivas', 'Precio'], DB.paquetes.map(p => ({ c: [`<strong>${p.nombre}</strong>`, p.conexion, p.usuarios, p.numeros, p.campanas, p.precio] })))); }
function vNumerosPlat() { return pagina('Números conectados', 'Estado ante Meta de los números de todas las empresas', '', tabla(['Empresa', 'Número', 'Tipo', 'Estado', 'Calidad'], [['Aromas del Norte', 'Pedidos', 'Cloud API', 'Conectado', 'Alta'], ['Aromas del Norte', 'Atención a clientes', 'Coexistencia', 'Conectado', 'Media'], ['Ferretería El Tornillo', 'Ventas', 'Cloud API', 'Conectado', 'Alta'], ['Autopartes Rivas', 'Mostrador', 'QR', 'Suspendida', '—']].map(f => ({ c: [f[0], f[1], chip(f[2], f[2] === 'QR' ? 'rojo' : 'azul'), estadoChip(f[3]), f[4]] })))); }
function vPerfil() {
  const u = U(E.usuario);
  return pagina('Perfil', 'Tu cuenta y disponibilidad', '', `<div class="carta estrecha centro"><span class="avatar grande">${u.ini}</span><h3>${esc(u.nombre)}</h3><small>${esc(u.correo)} · ${E.rol === 'P' ? 'Superadministrador' : u.rol} · ${u.sucursal}</small>
    <div class="d-fila"><span>Disponible para recibir conversaciones</span><label class="interruptor"><input type="checkbox" data-cambio="disp" ${u.disp ? 'checked' : ''}><i></i></label></div>
    <div class="d-fila"><span>Notificaciones</span><label class="interruptor"><input type="checkbox" checked><i></i></label></div>${btn('Cerrar sesión', 'ir', 'ancho', 'data-ruta="login"')}</div>`);
}
const vLogin = () => `<div class="acceso"><div class="a-caja"><span class="logo grande">E</span><h1>Enlaza CRM</h1><p>Atiende todos tus chats de WhatsApp desde un solo lugar</p>
  <label class="campo"><span>Correo</span><input value="adely@aromasdelnorte.test"></label><label class="campo"><span>Contraseña</span><input type="password" value="prototipo"></label>
  ${btn('Entrar', 'entrar', 'primario ancho')}<a data-accion="registro">Registrar mi empresa · 7 días gratis</a><a data-accion="aviso" data-t="Se enviaría un correo para recuperar la contraseña">Olvidé mi contraseña</a></div></div>`;
const vPausa = () => `<div class="acceso"><div class="a-caja"><span class="logo grande ambar">!</span><h1>Tu prueba terminó</h1><p>Tu cuenta está en pausa. Tus mensajes entrantes se siguen guardando, pero no puedes responder ni enviar campañas hasta activar un paquete.</p>${btn('Contactar para activar mi paquete', 'aviso', 'primario ancho', 'data-t="Se abriría el contacto de ventas"')}<a data-accion="entrar">Volver al prototipo</a></div></div>`;

const VISTAS = { empresa: vEmpresa, bandeja: vBandeja, embudo: vEmbudo, contactos: vContactos, tickets: vTickets, campanas: vCampanas, listas: vListas, reportes: vReportes, numeros: vNumeros, plantillas: vPlantillas, respuestas: vRespuestas, automaticos: vAutomaticos, tags: vTags, bajas: vBajas, usuarios: vUsuarios, plan: vPlan, empresas: vEmpresas, paquetes: vPaquetes, numerosPlat: vNumerosPlat, perfil: vPerfil };

/* ---------- Pintado ---------- */
function render() {
  document.body.classList.toggle('movil', E.movil);
  const app = $('#app');
  if (E.ruta === 'login') return app.innerHTML = vLogin();
  if (E.ruta === 'pausa') return app.innerHTML = vPausa();
  let it = ITEMS.find(i => i.r === E.ruta);
  if (!permite(it)) { E.ruta = E.rol === 'P' ? 'empresas' : 'bandeja'; it = ITEMS.find(i => i.r === E.ruta); }
  const cuerpo = E.movil && !it.movil ? `<div class="vacio alto">${ico('tel')}<h3>${it.n}</h3><p>Esta sección se usa desde una computadora.</p></div>` : VISTAS[E.ruta]();
  app.innerHTML = `<div class="shell">${menu()}<main class="contenido">${cuerpo}</main>${navMovil()}</div>`;
  const m = $('#msgs'); if (m) m.scrollTop = m.scrollHeight;
  if ($('#formEmp')) aplicarSi();
}

/* ---------- Acciones ---------- */
const A = {
  ir: d => { E.ruta = d.ruta; E.panel = 'lista'; cerrarModal(); render(); },
  entrar: () => { E.ruta = E.rol === 'P' ? 'empresas' : 'bandeja'; render(); },
  aviso: d => aviso(d.t),
  registro: () => formModal('Registrar mi empresa', [{ id: 'e', et: 'Nombre comercial' }, { id: 'n', et: 'Tu nombre' }, { id: 'c', et: 'Correo', tipo: 'email' }, { id: 't', et: 'Celular' }, { id: 'p', et: 'Contraseña', tipo: 'password' }, { tipo: 'nota', et: 'Tendrás 7 días de prueba gratis. Al terminar, la cuenta queda en pausa hasta activar un paquete.' }], () => { aviso('Empresa creada: te enviamos un correo de confirmación'); E.ruta = 'bandeja'; render(); }, 'Crear cuenta'),
  cerrarModal,
  colMenu: () => { E.menuCol = !E.menuCol; try { localStorage.setItem('crmMenuCol', E.menuCol ? '1' : ''); } catch (e) {} render(); },
  // Si la validación falla, el formulario queda abierto con lo escrito; si el guardado abre otra ventana, no se cierra.
  guardarForm: () => { const form = $('#formGen'), v = Object.fromEntries(new FormData(form)); const resultado = alGuardar && alGuardar(v); if (resultado === false) return; if ($('#formGen') === form) cerrarModal(); },
  abrirConv: d => { E.conv = d.id; CONV().noLeidos = 0; E.panel = 'chat'; render(); },
  panel: d => { E.panel = d.p; render(); },
  pest: d => { E.pest = d.p; render(); },
  toggleFiltros: () => { E.verFiltros = !E.verFiltros; render(); },
  limpiar: () => { E.f = { tags: [], embudo: '', etapa: '', resp: '', campana: '', misTickets: false, especial: false }; E.busca = ''; E.pest = 'todas'; render(); },
  enviar: () => { const t = $('#texto'); if (!t.value.trim()) return; enviarMsg({ t: t.value.trim() }); t.value = ''; t.focus(); },
  emoji: () => { const t = $('#texto'); t.value += '🙂'; t.focus(); },
  voz: () => { enviarMsg({ tipo: 'audio', t: 'Nota de voz · 0:08' }); aviso('Nota de voz enviada (simulada)'); },
  menuMas: () => abrirModal('Adjuntar', `<div class="opciones">${[['rapidas', 'Respuestas rápidas'], ['plantilla', 'Plantilla aprobada'], ['adjFoto', 'Foto'], ['adjVideo', 'Video'], ['adjDoc', 'Archivo']].map(o => `<a data-accion="${o[0]}"><strong>${o[1]}</strong></a>`).join('')}</div>`),
  adjFoto: () => { cerrarModal(); enviarMsg({ tipo: 'imagen', t: 'Foto · producto.jpg' }); },
  adjVideo: () => { cerrarModal(); enviarMsg({ tipo: 'imagen', t: 'Video · demostracion.mp4' }); },
  adjDoc: () => { cerrarModal(); enviarMsg({ tipo: 'doc', t: 'Lista-de-precios.pdf' }); },
  rapidas: () => abrirModal('Respuestas rápidas · ' + (CONV() ? N(CONV().numero).nombre : 'todos los números'), `<div class="opciones">${rapidasDe(CONV() && CONV().numero).map(r => `<a data-accion="usarRapida" data-id="${r.id}"><strong>${esc(r.titulo)}</strong><small>${esc(r.texto)}</small></a>`).join('')}</div>`),
  usarRapida: d => { const r = DB.respuestas.find(x => x.id === d.id); cerrarModal(); const t = $('#texto'); if (t) { t.value = r.texto; t.focus(); } },
  plantilla: () => limiteAlcanzado() ? aviso(`Se alcanzó el límite de ${DB.empresa.limCant} plantillas ${{ Diario: 'por día', Semanal: 'por semana', Mensual: 'por mes' }[DB.empresa.limPeriodo]} desde la bandeja. Lo cambia el administrador en Empresa.`) : abrirModal('Enviar plantilla', `<p class="nota">Solo aparecen las plantillas aprobadas por Meta de la cuenta del número ${esc(N(CONV().numero).nombre)}. Con la ventana cerrada es la única forma de escribirle al cliente.</p><div class="opciones">${plantillasDe(CONV().numero).filter(p => p.estado === 'Aprobada' && p.uso !== 'Campaña').map(p => `<a data-accion="usarPlantilla" data-id="${p.id}"><strong>${p.nombre}</strong> ${chip(p.cat, 'azul')}<small>${esc(p.cuerpo)}</small></a>`).join('')}</div>`),
  usarPlantilla: d => modalEnviarPl(d.id),
  probarPl: d => modalEnviarPl(d.id, true),
  usarNombreVar: d => { const i = $('#formEnv [name=' + d.campo + ']'); if (!i) return; i.value = d.v; i.dispatchEvent(new Event('input', { bubbles: true })); },
  enviarPrueba: () => { const r = datosEnv(), num = N($('#formEnv [name=salida]').value), dest = $('#formEnv [name=destino]').value; if (!destinoValido(dest)) return aviso('Escribe el número de destino en formato internacional: + código de país y número'); if (!r.completo) return aviso('Faltan datos de la plantilla'); cerrarModal(); aviso(`Prueba simulada: ${plEnvio.nombre} desde ${num.nombre} a ${dest}. En el prototipo no se envía nada.`); },
  enviarPl: () => { const r = datosEnv(); if (!r.completo) return aviso('Faltan datos de la plantilla'); if (limiteAlcanzado()) return aviso('Se alcanzó el límite de plantillas desde la bandeja'); DB.empresa.limUsadas = (DB.empresa.limUsadas || 0) + 1; const p = r.p, v = CONV(); cerrarModal(); enviarMsg({ tipo: 'plantilla', t: p.cuerpo, botones: p.botones, enc: p.encabezado, medio: p.tarjetas ? '' : r.medio, oferta: p.oferta ? p.oferta + (r.vence ? ' · vence ' + r.vence : '') : '', nTarjetas: p.tarjetas ? p.tarjetas.length : 0, params: r.valores }); aviso(v.gratis > 0 ? 'Plantilla enviada sin costo: el chat entró por anuncio' : `Plantilla de ${p.cat} enviada: se suma al contador de costo`); },
  simular: () => formModal('Simular mensaje del cliente', [{ id: 't', et: 'Lo que escribe el cliente', tipo: 'area', valor: 'Hola, ¿me pasas el precio del catálogo?' }, { tipo: 'nota', et: 'Palabras clave de los embudos: ' + (DB.embudos.filter(b => (b.claves || []).length).map(b => esc(b.n) + ' (' + esc(b.claves.join(', ')) + ')').join('; ') || 'ninguna') + '. Si el mensaje contiene una, el contacto entra solo a ese embudo.' }], f => { const v = CONV(), texto = (f.t || '').trim() || 'Hola'; v.msgs.push({ de: 'c', autor: v.grupo ? 'Mariana Solís' : '', t: texto, h: ahora() }); if (v.estado !== 'abierta') { v.estado = 'abierta'; v.msgs.push({ de: 's', t: 'La conversación se reabrió porque el cliente escribió', h: ahora() }); } const entro = aplicarClaves(v, texto); permisoAutomatico(v, texto); v.ventana = 1440; v.espera = '1 min'; v.hora = ahora(); render(); aviso(entro.length ? 'Entró solo a: ' + entro.join(', ') : 'Llegó un mensaje: la ventana de 24 h se reinicia'); }, 'Recibir mensaje'),
  asignar: () => abrirModal('Asignar conversación', `<div class="opciones">${activos().filter(u => u.numeros.includes(CONV().numero)).filter(u => puede('AS') || u.id === E.usuario).map(u => `<a data-accion="asignarA" data-id="${u.id}"><strong><span class="avatar chico">${u.ini}</span> ${esc(u.nombre)}${u.id === E.usuario ? ' (yo)' : ''}</strong><small><i class="punto ${u.disp ? 'ok' : ''}"></i>${u.disp ? 'Disponible' : 'No disponible'} · ${DB.conversaciones.filter(v => v.resp === u.id && v.estado === 'abierta').length} conversaciones abiertas</small></a>`).join('')}</div>${puede('AS') ? '' : '<p class="nota">Como agente solo puedes tomar la conversación para ti.</p>'}`),
  desactivarUsuario: d => {
    const u = U(d.id), p = pendientesDe(u.id), otros = activos().filter(x => x.id !== u.id);
    if (u.id === E.usuario) return aviso('No puedes desactivar tu propio usuario');
    if (u.rol === 'Administrador' && !otros.some(x => x.rol === 'Administrador')) return aviso('Debe quedar al menos un administrador activo');
    const hay = p.convs.length + p.tickets.length;
    formModal('Desactivar a ' + esc(u.nombre), [
      { tipo: 'nota', et: `${esc(u.nombre)} ya no podrá entrar al CRM. No se borra: su historial, sus mensajes y lo que atendió se conservan, y se puede volver a activar.` },
      ...(hay ? [{ id: 'a', et: `Tiene ${p.convs.length} ${p.convs.length === 1 ? 'conversación abierta' : 'conversaciones abiertas'} y ${p.tickets.length} ${p.tickets.length === 1 ? 'ticket pendiente' : 'tickets pendientes'}. ¿A quién se los paso?`, tipo: 'select', ops: ['Dejarlos sin asignar', ...otros.map(x => x.nombre)] }] : [{ tipo: 'nota', et: 'No tiene conversaciones abiertas ni tickets pendientes.' }])
    ], f => {
      const a = otros.find(x => x.nombre === f.a);
      p.convs.forEach(v => { v.resp = a ? a.id : null; v.msgs.push({ de: 's', t: `${U(E.usuario).nombre} desactivó a ${u.nombre}; la conversación pasó a ${a ? a.nombre : 'sin asignar'}`, h: ahora() }); });
      p.tickets.forEach(k => { k.asignado = a ? a.id : null; });
      u.inactivo = true; u.disp = false; u.inactivoDesde = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
      render(); aviso(`${u.nombre} quedó inactivo${hay ? '; lo pendiente pasó a ' + (a ? a.nombre : 'sin asignar') : ''}`);
    }, 'Desactivar');
  },
  activarUsuario: d => { const u = U(d.id); if (activos().length >= DB.empresa.usuariosMax) return aviso('Llegaste al máximo de usuarios activos de tu plan'); u.inactivo = false; delete u.inactivoDesde; render(); aviso(u.nombre + ' puede volver a entrar al CRM'); },
  asignarA: d => { const v = CONV(); v.resp = d.id; v.msgs.push({ de: 's', t: `${U(E.usuario).nombre} asignó la conversación a ${U(d.id).nombre}`, h: ahora() }); cerrarModal(); render(); aviso(`Asignada a ${U(d.id).nombre}`); },
  finalizar: () => { const v = CONV(); if (ticketsAbiertosDe(v) && !confirm('Esta conversación tiene tickets abiertos. ¿Cerrarla de todos modos?')) return; v.estado = 'cerrada'; v.espera = ''; v.msgs.push({ de: 's', t: `${U(E.usuario).nombre} cerró la conversación`, h: ahora() }); E.pest = 'cerradas'; render(); aviso('Conversación cerrada'); },
  reabrir: () => { const v = CONV(); v.estado = 'abierta'; v.msgs.push({ de: 's', t: `${U(E.usuario).nombre} reabrió la conversación`, h: ahora() }); E.pest = 'todas'; render(); },
  tagModal: () => abrirModal('Agregar tag', DB.gruposTags.map(g => `<div class="f-grupo"><h4>${esc(g.nombre)}</h4><div class="tags">${g.tags.filter(t => !t.inactivo).map(t => `<a class="tag" style="--c:${t.c}" data-accion="ponerTag" data-id="${t.id}">${esc(t.n)}</a>`).join('')}</div></div>`).join('')),
  ponerTag: d => { const v = CONV(); if (!v.tags.includes(d.id)) v.tags.push(d.id); cerrarModal(); render(); },
  quitarTag: d => { const v = CONV(), c = C(v.contacto); v.tags = v.tags.filter(t => t !== d.id); c.tags = c.tags.filter(t => t !== d.id); render(); },
  notaModal: () => formModal('Nota interna', [{ id: 't', et: 'Nota (no se envía al cliente)', tipo: 'area' }], v => { if (v.t) C(CONV().contacto).notas.push({ t: v.t, por: E.usuario, f: 'hoy' }); render(); }),
  ticketModal: () => formModal('Levantar ticket', [{ id: 'm', et: 'Motivo', tipo: 'select', ops: DB.motivos }, { id: 'd', et: 'Descripción', tipo: 'area' }, { id: 'a', et: 'Asignar a', tipo: 'select', ops: activos().map(u => u.nombre) }], f => { const v = CONV(), u = DB.usuarios.find(x => x.nombre === f.a); DB.tickets.unshift({ id: Math.max(...DB.tickets.map(k => k.id)) + 1, conv: v.id, contacto: v.contacto, motivo: f.m, etapa: primeraActiva(ETK()).id, dias: 0, por: E.usuario, asignado: u.id, creado: 'hoy ' + ahora(), desc: f.d || 'Sin descripción', comentarios: [] }); v.msgs.push({ de: 's', t: `${U(E.usuario).nombre} levantó un ticket: ${f.m}`, h: ahora() }); render(); aviso(`Ticket asignado a ${u.nombre}`); }, 'Levantar ticket'),
  registrarPermiso: () => { const c = C(CONV().contacto); formModal('Registrar que acepta campañas', [{ id: 'o', et: 'Cómo lo aceptó', tipo: 'select', ops: ['Lo dijo en el chat', 'Lo dijo por teléfono', 'Lo firmó en un formulario', 'Otro'] }, { id: 'n', et: 'Nota (opcional)' }, { tipo: 'nota', et: 'Es solo un registro: no cambia a quién le llegan las campañas. Le llegan a todos menos a quien se dio de baja.' }], f => { c.consent = 'otorgado'; c.permiso = { fecha: fCorta(new Date()), origen: f.o.toLowerCase() + ' (registró ' + U(E.usuario).nombre + ')' + (f.n ? ': ' + f.n : '') }; render(); aviso('Quedó registrado que ' + c.nombre + ' acepta campañas'); }, 'Registrar'); },
  quitarPermiso: () => { const c = C(CONV().contacto); c.consent = 'sin'; delete c.permiso; render(); aviso('Se quitó el registro; las campañas le siguen llegando mientras no se dé de baja'); },
  baja: () => { const c = C(CONV().contacto); if (!confirm(`¿Dar de baja a ${c.nombre}? Ya no recibirá campañas. Podrás seguir atendiéndolo cuando escriba.`)) return; c.consent = 'baja'; DB.bajas.unshift({ tel: c.tel, contacto: c.nombre, fecha: new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }), origen: 'Manual', campana: '—' }); render(); aviso('Agregado a la lista de supresión'); },
  verTicket: d => verTicket(d.id),
  // Eliminar un embudo: solo los generales, y solo si ya no tiene contactos ni lo usa una campaña. Si no, se desactiva.
  eliminarEmbudo: d => { const b = TB(d.id), n = DB.posiciones.filter(x => x.b === b.id).length, camp = DB.campanas.find(k => k.embudo === b.id);
    if (b.tipo !== 'general') return aviso(b.tipo === 'tickets' ? 'El embudo de tickets no se puede eliminar' : 'El embudo de una campaña no se elimina: guarda su historial');
    if (n) return aviso(`No se puede eliminar: tiene ${n} ${n === 1 ? 'contacto' : 'contactos'}. Muévelos o quítalos primero, o desactívalo para que ya no reciba nuevos.`);
    if (camp) return aviso(`No se puede eliminar: la campaña "${camp.nombre}" lo usa. Desactívalo si ya no quieres que reciba contactos.`);
    abrirModal('Eliminar embudo · ' + esc(b.n), '<p>Se elimina el embudo con sus etapas. No tiene contactos ni lo usa ninguna campaña.</p>', btn('Cancelar', 'cerrarModal') + btn('Eliminar', 'confirmarEliminarEmbudo', 'primario rojo-btn', `data-id="${b.id}"`)); },
  confirmarEliminarEmbudo: d => { const b = TB(d.id); DB.embudos = DB.embudos.filter(x => x.id !== d.id); if (E.embudo === d.id) E.embudo = (DB.embudos.find(x => x.tipo !== 'tickets') || {}).id; cerrarModal(); render(); aviso('Embudo ' + b.n + ' eliminado'); },
  vistaTk: d => { E.vistaTk = d.v; render(); },
  etapasTk: () => { E.embudo = ETK().id; A.gestionarEtapas(); },
  comentarTicket: d => { const k = DB.tickets.find(x => x.id === +d.id), t = $('#comTicket').value.trim(); if (!t) return; k.comentarios.push({ por: E.usuario, t, f: 'hoy ' + ahora() }); if (estadoTk(k) === 'Abierto') k.etapa = siguienteAbiertaTk(k).id; E.pestTickets = estadoTk(k); render(); verTicket(k.id); },
  cerrarTicket: d => { const k = DB.tickets.find(x => x.id === +d.id), cierres = etapasCierreTk(); formModal('Cerrar ticket #' + k.id, [{ id: 'e', et: 'Etapa de cierre', tipo: 'select', ops: cierres.map(e => e.n) }, { tipo: 'nota', et: 'El ticket se cierra al pasar a una etapa que cierra (Ganada o Perdida) del embudo de tickets.' }], f => { k.etapa = cierres.find(e => e.n === f.e).id; E.pestTickets = 'Cerrado'; render(); aviso(`Ticket #${k.id} cerrado en ${f.e}`); }, 'Cerrar ticket'); },
  reabrirTicket: d => { const k = DB.tickets.find(x => x.id === +d.id), ab = ETK().etapas.filter(e => e.tipo === 'abierta' && !e.inactivo); k.etapa = (ab[1] || ab[0]).id; E.pestTickets = estadoTk(k); cerrarModal(); render(); aviso(`Ticket #${k.id} reabierto en ${ETK().etapas.find(e => e.id === k.etapa).n}`); },
  pestTickets: d => { E.pestTickets = d.p; render(); },
  chatDe: d => { const v = DB.conversaciones.find(x => x.contacto === d.id); cerrarModal(); if (!v) return aviso('Este contacto aún no tiene conversación'); E.conv = v.id; E.ruta = 'bandeja'; E.panel = 'chat'; E.pest = v.estado === 'abierta' ? 'todas' : 'cerradas'; render(); },
  nuevaConv: () => formModal('Nueva conversación', [{ id: 'n', et: 'Nombre' }, { id: 't', et: 'Celular', ph: '10 dígitos' }, { tipo: 'nota', et: 'Como no hay ventana abierta, el primer mensaje debe ser una plantilla aprobada.' }], f => { if (!f.n || !f.t) return aviso('Nombre y celular son obligatorios'); const c = { id: 'c' + Date.now(), nombre: f.n, tel: '+52 ' + f.t, tipo: DB.tiposContacto[0] || '', especial: false, correo: '', consent: 'sin', tags: [], alta: 'hoy', notas: [] }; DB.contactos.push(c); const v = { id: 'v' + Date.now(), numero: E.numero === 'todos' ? 'n1' : E.numero, contacto: c.id, resp: E.usuario, estado: 'abierta', noLeidos: 0, espera: '', ventana: 0, tags: [], campana: null, hora: ahora(), msgs: [{ de: 's', t: 'Conversación creada', h: ahora() }] }; DB.conversaciones.unshift(v); E.conv = v.id; E.panel = 'chat'; E.pest = 'todas'; render(); }, 'Crear'),
  nuevoContacto: () => formModal('Nuevo contacto', [{ id: 'n', et: 'Nombre' }, { id: 't', et: 'Celular' }, { id: 'c', et: 'Correo', tipo: 'email' }, { id: 'tp', et: 'Tipo de contacto', tipo: 'select', ops: [...DB.tiposContacto, 'Sin tipo'] }], f => { if (!f.n || !f.t) return aviso('Nombre y celular son obligatorios'); DB.contactos.push({ id: 'c' + Date.now(), nombre: f.n, tel: '+52 ' + f.t, tipo: f.tp === 'Sin tipo' ? '' : f.tp, especial: f.tp === 'Cliente especial', correo: f.c, consent: 'sin', tags: [], alta: 'hoy', notas: [] }); render(); aviso('Contacto creado'); }),
  fichaContacto: d => { const c = C(d.id); abrirModal(esc(c.nombre), `<div class="d-fila"><span>${c.tel}${c.correo ? ' · ' + esc(c.correo) : ''}</span>${chipTipo(c)}</div><div class="d-fila"><span>Embudos</span><span>${posDe(c).map(p => `<span class="mini" style="--c:${ET(p.e).c}">${esc(TB(p.b).n)}: ${esc(ET(p.e).n)}</span>`).join(' ') || 'En ninguno'}</span></div><div class="d-fila"><span>Monto en embudos</span><strong>$${posDe(c).reduce((s, p) => s + p.m, 0).toLocaleString('es-MX')}</strong></div><div class="d-fila"><span>Permiso para campañas</span>${chip({ otorgado: 'Acepta campañas', baja: 'Se dio de baja', sin: 'Sin permiso registrado' }[c.consent], c.consent === 'baja' ? 'rojo' : c.consent === 'otorgado' ? 'verde' : 'gris')}</div><h5>Notas</h5>${c.notas.map(n => `<div class="d-nota">${esc(n.t)}</div>`).join('') || '<small class="nota">Sin notas</small>'}`, btn('Abrir chat', 'chatDe', 'primario', `data-id="${c.id}"`)); },
  importar: () => abrirModal('Importar contactos', `<p>Resultado de validar <strong>contactos-octubre.csv</strong> (simulado):</p><p class="nota">Columna opcional <b>permiso_campanas</b>: "si" registra que el contacto acepta campañas; vacío lo deja sin permiso registrado. Es solo un registro: las campañas llegan a todos menos a las bajas. 118 filas traen "si".</p><div class="resumen"><div class="verde"><small>Nuevos</small><strong>182</strong></div><div><small>Se actualizan</small><strong>41</strong></div><div class="ambar"><small>Duplicados</small><strong>9</strong></div><div class="rojo"><small>Inválidos</small><strong>3</strong></div></div>`, btn('Cancelar', 'cerrarModal') + btn('Importar 223 contactos', 'aviso', 'primario', 'data-t="Importación en proceso: te avisamos al terminar"')),
  exportar: () => aviso('Se descargaría un archivo CSV con lo filtrado'),
  nuevaCampana, revisarCamp, confirmarCamp,
  descartarCamp: () => { campBorrador = null; campDatos = null; campMapeo = {}; campArchivo = null; campFila = 0; campSeg = []; cerrarModal(); },
  filaCamp: d => { campFila += +d.d; pintaCamp(); },
  csvEjemploCamp,
  irTagsCamp: () => { guardaBorrador(); E.ruta = 'tags'; E.panel = 'lista'; cerrarModal(); render(); aviso('Guardé lo que llevabas de la campaña; vuelve con "Volver a la campaña"'); },
  volverCamp: () => { const ent = campBorrador && campBorrador._tipo === 'entrada'; E.ruta = 'campanas'; render(); ent ? nuevaEntrada() : nuevaCampana(); },
  verCampana: d => verCampana(d.id),
  reprogramarCamp: d => { const k = DB.campanas.find(x => x.id === d.id); abrirModal('Reprogramar ' + esc(k.nombre), `<p>Programada hoy para <strong>${esc(k.fecha)}</strong>.</p>${campoFecha(k.cuando ? aLocal(k.cuando) : '')}`, btn('Regresar', 'verCampana', '', `data-id="${k.id}"`) + btn('Guardar nueva fecha', 'guardarProg', 'primario', `data-id="${k.id}"`)); },
  guardarProg: d => { const k = DB.campanas.find(x => x.id === d.id), c = fechaValida($('#cuandoCamp').value); if (!c) return; k.cuando = c; k.fecha = fechaTxt(c); cerrarModal(); render(); aviso('Reprogramada para ' + k.fecha); },
  cancelarCamp: d => { const k = DB.campanas.find(x => x.id === d.id); if (!confirm(`¿Cancelar la campaña "${k.nombre}"? No se enviará ningún mensaje.`)) return; k.estado = 'Cancelada'; cerrarModal(); render(); aviso('Campaña cancelada'); },
  nuevaEntrada,
  crearEntrada: () => { const f = Object.fromEntries(new FormData($('#formEnt'))), b = TB(f.embudo); if (!b) return aviso('Elige un embudo; si no hay, créalo con + Embudo'); if (filtroDe(b) === 'manual') return aviso('Ese embudo no tiene filtro: elige otro o ponle filtro en Tags y embudos'); const d = fechasEntrada(f); if (!d) return; DB.campanas.unshift({ id: 'k' + Date.now(), nombre: f.nombre || 'Campaña de entrada', tipo: 'Entrada', embudo: b.id, numero: f.numero, ...d, estado: 'Activa', fecha: '', total: 0, enviados: 0, entregados: 0, leidos: 0, respuestas: 0, clics: 0, bajas: 0, conversiones: 0, errores: 0 }); campBorrador = null; refrescaEntradas(); cerrarModal(); render(); aviso('Campaña de entrada ' + DB.campanas[0].estado.toLowerCase() + ' con el embudo ' + b.n); },
  fechasCamp: d => { const k = DB.campanas.find(x => x.id === d.id); formModal('Fechas de ' + esc(k.nombre), camposEntrada(k.inicio, k.fin), f => { const x = fechasEntrada(f); if (!x) return; Object.assign(k, x); refrescaEntradas(); render(); aviso('Fechas guardadas: la campaña queda ' + k.estado.toLowerCase()); }); },
  nuevaLista: () => abrirModal('Nueva lista de difusión', '<label class="campo"><span>Nombre de la lista</span><input id="lstNombre" placeholder="Ej. Clientes de octubre"></label>' + camposCsv(), btn('Cancelar', 'cerrarModal') + btn('Crear lista', 'crearLista', 'primario')),
  crearLista: () => { const n = $('#lstNombre').value.trim(); if (!n) return aviso('Falta el nombre de la lista'); if (!$('#lstCsv').files[0]) return aviso('Falta elegir el archivo CSV'); const l = { id: 'l' + Date.now(), nombre: n, creada: 'hoy', miembros: [] }; cargarCsv(l, () => { DB.listas.push(l); render(); }); },
  plantillaCsv: () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\uFEFFnombre,apellido,telefono,permiso_campanas\nMaría,López,8155501234,si\n'], { type: 'text/csv;charset=utf-8' })); a.download = 'plantilla-lista-difusion.csv'; a.click(); aviso('Plantilla descargada: nombre, apellido, telefono y permiso_campanas (opcional)'); },
  verLista: d => { E.buscaLista = ''; verLista(d.id); },
  masCsvLista: d => { const l = DB.listas.find(x => x.id === d.id); abrirModal('Agregar contactos a ' + esc(l.nombre), camposCsv(), btn('Regresar', 'verLista', '', `data-id="${l.id}"`) + btn('Cargar', 'cargarMasLista', 'primario', `data-id="${l.id}"`)); },
  cargarMasLista: d => cargarCsv(DB.listas.find(x => x.id === d.id), render),
  quitarDeLista: d => { const l = DB.listas.find(x => x.id === d.id); l.miembros = l.miembros.filter(m => m.tel !== d.tel); render(); verLista(l.id); },
  editarNumero: d => editarNumero(d.id),
  guardarNumero: d => { const n = N(d.id), f = new FormData($('#formNum')), nombre = (f.get('nombre') || '').trim(), us = f.getAll('u'), siempre = f.get('siempre') === 'si', horario = Object.fromEntries(BLOQUES.map(([k]) => [k, { abierto: f.get(k + '_ab') === 'on', abre: f.get(k + '_abre'), cierra: f.get(k + '_cierra') }])); if (!nombre) return aviso('Falta el nombre visible'); if (DB.numeros.some(x => x.id !== n.id && normal(x.nombre) === normal(nombre))) return aviso('Ya hay otro número con ese nombre'); if (!us.length) return aviso('Al menos un usuario debe poder atender este número'); if (!siempre) { if (!BLOQUES.some(([k]) => horario[k].abierto)) return aviso('Marca al menos un bloque abierto, o elige "Siempre abierto"'); const malo = BLOQUES.find(([k]) => horario[k].abierto && !(horario[k].abre && horario[k].cierra && horario[k].cierra > horario[k].abre)); if (malo) return aviso(malo[1] + ': la hora de cierre debe ser después de la de apertura'); } n.nombre = nombre; n.cierre = +f.get('cierre'); n.siempre = siempre; n.horario = horario; activos().forEach(u => { const tiene = u.numeros.includes(n.id), debe = us.includes(u.id); if (debe && !tiene) u.numeros.push(n.id); if (!debe && tiene) u.numeros = u.numeros.filter(x => x !== n.id); }); cerrarModal(); render(); aviso('Configuración guardada'); },
  desconectarNumero: d => { const n = N(d.id); if (!confirm(`¿Desconectar "${n.nombre}"? Sus conversaciones se conservan en solo lectura y sus campañas se pausan.`)) return; n.estado = 'Desconectado'; cerrarModal(); render(); aviso('Número desconectado'); },
  conectar: () => conectar(),
  conectarPaso: d => conectar(d.p),
  conectarFin: d => { if (d.p === 'QR' && !$('#aceptoQR').checked) return aviso('Debes aceptar el riesgo para continuar'); if (DB.numeros.length >= 3) { cerrarModal(); return aviso('Llegaste al máximo de números de tu plan'); } DB.numeros.push({ id: 'n' + Date.now(), nombre: d.p === 'QR' ? 'Número QR' : ($('#nomNum').value || 'Nuevo'), tel: '+52 81 5550 01' + (10 + DB.numeros.length), tipo: d.p, estado: 'Conectado', calidad: d.p === 'QR' ? '—' : 'Alta', limite: d.p === 'QR' ? 'No aplica' : '250 por día', oficial: false }); cerrarModal(); render(); aviso('Número conectado'); },
  nuevaPlantilla: () => { E.editPl = null; subidasPl = {}; modalPlantilla(); },
  agregarVarPl: d => { const c = $('#formPl [name="' + d.campo + '"]'); if (!c) return; const n = varsDe(c.value).length + 1, ini = c.selectionStart ?? c.value.length, fin = c.selectionEnd ?? c.value.length, tok = (ini > 0 && !/\s/.test(c.value[ini - 1]) ? ' ' : '') + '{{' + n + '}}'; c.value = c.value.slice(0, ini) + tok + c.value.slice(fin); c.focus(); c.setSelectionRange(ini + tok.length, ini + tok.length); c.dispatchEvent(new Event('input', { bubbles: true })); },
  agregarBotonPl: d => { leerPl(); borPl.botones.push({ tipo: d.t, texto: '', url: '', tel: '', ej: '' }); repintaPl(); },
  quitarBotonPl: d => { leerPl(); borPl.botones.splice(+d.i, 1); repintaPl(); },
  agregarTarjetaPl: () => { leerPl(); if (borPl.tarjetas.length >= 10) return aviso('El carrusel lleva hasta 10 tarjetas'); borPl.tarjetas.push({ texto: '', ej: [], b: borPl.tBotones.map(() => ({})) }); repintaPl(); },
  agregarBotonTarjetaPl: d => { leerPl(); if (borPl.tBotones.length >= 2) return aviso('Cada tarjeta lleva hasta 2 botones'); borPl.tBotones.push(d.t); borPl.tarjetas.forEach(t => t.b.push({})); repintaPl(); },
  quitarBotonTarjetaPl: d => { leerPl(); const k = +d.k; borPl.tBotones.splice(k, 1); borPl.tarjetas.forEach(t => t.b.splice(k, 1)); repintaPl(); },
  moverTarjetaPl: d => { leerPl(); const i = +d.i, j = i + +d.d, T = borPl.tarjetas; if (j < 0 || j >= T.length) return; [T[i], T[j]] = [T[j], T[i]]; const a = subidasPl['tM' + i], z = subidasPl['tM' + j]; if (z) subidasPl['tM' + i] = z; else delete subidasPl['tM' + i]; if (a) subidasPl['tM' + j] = a; else delete subidasPl['tM' + j]; repintaPl(); },
  encabezadoPl: d => { leerPl(); if (d.v === 'Texto') borPl.encTipo = borPl.encTexto.trim() ? 'Texto' : 'Ninguno'; else borPl.encTipo = d.v; delete subidasPl.muestraH; repintaPl(); },
  medioPl: d => { leerPl(); if (borPl.medio !== d.v) { borPl.medio = d.v; Object.keys(subidasPl).forEach(k => { if (/^tM\d+$|^muestraH$/.test(k)) delete subidasPl[k]; }); } repintaPl(); },
  usoPl: d => { leerPl(); borPl.uso = d.v; repintaPl(); },
  quitarTarjetaPl: d => { leerPl(); if (borPl.tarjetas.length <= 2) return aviso('El carrusel lleva al menos 2 tarjetas'); const i = +d.i; borPl.tarjetas.splice(i, 1); const nuevas = {}; Object.keys(subidasPl).forEach(k => { const m = /^tM(\d+)$/.exec(k); if (!m) nuevas[k] = subidasPl[k]; else if (+m[1] < i) nuevas[k] = subidasPl[k]; else if (+m[1] > i) nuevas['tM' + (+m[1] - 1)] = subidasPl[k]; }); subidasPl = nuevas; repintaPl(); },
  tipoPl: d => { if (E.editPl) return aviso('Al editar no se puede cambiar el formato'); leerPl(); const ant = borPl; subidasPl = {}; borPl = borNuevo(d.t, ant.nombre); Object.assign(borPl, { cat: ant.cat, idioma: ant.idioma, numeroPl: ant.numeroPl, uso: d.t === 'carrusel' ? 'Campaña' : ant.uso }); modalPlantilla(d.t, null, true); },
  guardarPl,
  nuevaRespuesta: () => formRespuesta(null),
  editarRespuesta: d => formRespuesta(DB.respuestas.find(x => x.id === d.id)),
  eliminarRespuesta: d => { const r = DB.respuestas.find(x => x.id === d.id); abrirModal('Eliminar respuesta rápida', '<p>Se elimina «' + esc(r.titulo) + '». Lo que ya se envió con ella no cambia.</p>', btn('Cancelar', 'cerrarModal') + btn('Eliminar', 'confirmarEliminarRap', 'primario rojo-btn', 'data-id="' + r.id + '"')); },
  confirmarEliminarRap: d => { DB.respuestas = DB.respuestas.filter(x => x.id !== d.id); cerrarModal(); render(); aviso('Respuesta rápida eliminada'); },
  pagRap: d => { E.pagRap = +d.p; render(); },
  editarPl: d => editarPl(d.id),
  guardarEmpresa: () => {
    const f = Object.fromEntries(new FormData($('#formEmp')));
    if (!(f.nombre || '').trim()) return aviso('Falta el nombre comercial');
    if (f.correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.correo)) return aviso('El correo no es válido');
    if (f.tel && !/^\+?[\d ]{8,20}$/.test(f.tel)) return aviso('El teléfono solo lleva números, espacios y el + del código de país');
    if (f.web && !/^https?:\/\/\S+$/.test(f.web)) return aviso('El sitio o red social debe empezar con https://');
    f.rfc = (f.rfc || '').trim().toUpperCase();
    if (f.rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(f.rfc)) return aviso('El RFC no es válido: 12 caracteres para persona moral o 13 para persona física, por ejemplo ADN150312AB1');
    if (f.fCp && !/^\d{5}$/.test(f.fCp)) return aviso('El código postal fiscal lleva 5 dígitos');
    if (f.rfc && f.regimen) { const tipo = (REGIMENES.find(x => x[0] === f.regimen) || [])[2], moral = f.rfc.length === 12; if ((tipo === 'M' && !moral) || (tipo === 'F' && moral)) return aviso(`El régimen ${f.regimen} no corresponde a un RFC de persona ${moral ? 'moral' : 'física'}`); }
    if (f.fCorreo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.fCorreo)) return aviso('El correo de facturación no es válido');
    if (f.limTipo === 'Limitado en total' && !(+f.limCant >= 1)) return aviso('El límite de envíos debe ser al menos 1');
    if (f.limCant) f.limCant = +f.limCant;
    Object.assign(DB.empresa, f, { nombre: f.nombre.trim() }); E.empTmp = null; render(); aviso('Datos de la empresa guardados');
  },
  quitarImg: d => { if ($('#formEmp')) E.empTmp = Object.fromEntries(new FormData($('#formEmp'))); DB.empresa[d.k] = ''; render(); },
  borrarPl: d => borrarPl(d.id),
  confirmarBorrarPl: d => { const x = DB.plantillas.find(y => y.id === d.id); DB.plantillas = DB.plantillas.filter(y => y.id !== d.id); cerrarModal(); render(); aviso('Plantilla ' + x.nombre + ' eliminada en Meta'); },
  nuevoAuto: () => formAuto(null),
  editarAuto: d => formAuto(DB.automaticos.find(a => a.id === d.id)),
  nuevoTipo: () => formModal('Nuevo tipo de contacto', [{ id: 'n', et: 'Nombre' }], f => { const n = (f.n || '').trim(); if (!n) return aviso('Falta el nombre'); if (DB.tiposContacto.some(t => normal(t) === normal(n))) return aviso('Ya existe un tipo con ese nombre'); DB.tiposContacto.push(n); render(); aviso('Tipo agregado'); }),
  renombrarTipo: d => { const viejo = DB.tiposContacto[+d.i]; formModal('Renombrar tipo de contacto', [{ id: 'n', et: 'Nombre', valor: viejo }, { tipo: 'nota', et: usanTipo(viejo) + ' contacto(s) con este tipo pasarán al nombre nuevo.' }], f => { const n = (f.n || '').trim(); if (!n) return aviso('Falta el nombre'); if (DB.tiposContacto.some((t, i) => i !== +d.i && normal(t) === normal(n))) return aviso('Ya existe un tipo con ese nombre'); DB.tiposContacto[+d.i] = n; DB.contactos.forEach(c => { if (c.tipo === viejo) c.tipo = n; }); DB.listas.forEach(l => l.miembros.forEach(m => { if (m.tipo === viejo) m.tipo = n; })); render(); aviso('Tipo renombrado'); }); },
  eliminarTipo: d => { const t = DB.tiposContacto[+d.i], n = usanTipo(t); if (!n) { if (!confirm(`¿Eliminar el tipo "${t}"? Ningún contacto lo usa.`)) return; DB.tiposContacto.splice(+d.i, 1); render(); return aviso('Tipo eliminado'); } formModal('Eliminar tipo "' + esc(t) + '"', [{ id: 'a', et: `Hay ${n} ${n === 1 ? 'contacto' : 'contactos'} con este tipo. ¿A qué tipo ${n === 1 ? 'lo paso' : 'los paso'}?`, tipo: 'select', ops: ['Dejarlos sin tipo', ...DB.tiposContacto.filter(x => x !== t)] }, { tipo: 'nota', et: 'Ningún contacto se borra: solo cambia su tipo.' }], f => { const nuevo = f.a === 'Dejarlos sin tipo' ? '' : f.a; DB.contactos.forEach(c => { if (c.tipo === t) c.tipo = nuevo; }); DB.listas.forEach(l => l.miembros.forEach(m => { if (m.tipo === t) m.tipo = nuevo || 'Sin tipo'; })); DB.tiposContacto.splice(DB.tiposContacto.indexOf(t), 1); render(); aviso(`Tipo eliminado: ${n} ${n === 1 ? 'contacto pasó' : 'contactos pasaron'} a ${nuevo || 'Sin tipo'}`); }, 'Eliminar tipo'); },
  nuevoGrupo: () => formModal('Nuevo grupo de tags', [{ id: 'n', et: 'Nombre' }], f => { DB.gruposTags.push({ id: 'g' + Date.now(), nombre: f.n || 'Grupo', tags: [] }); render(); }),
  nuevoTag: d => formModal('Nuevo tag', [{ id: 'n', et: 'Nombre' }, { id: 'c', et: 'Color', tipo: 'color', valor: '#0e9f6e' }, { id: 'es', et: 'Estado', tipo: 'estado', ops: ['Activo', 'Inactivo'], valor: 'Activo' }], f => { if (!(f.n || '').trim()) return aviso('Falta el nombre del tag'); DB.gruposTags.find(g => g.id === d.id).tags.push({ id: 't' + Date.now(), n: f.n.trim(), c: f.c, inactivo: f.es === 'Inactivo' }); render(); }),
  editarTag: d => { const t = TAG(d.id); formModal('Editar tag', [{ id: 'n', et: 'Nombre', valor: t.n }, { id: 'c', et: 'Color', tipo: 'color', valor: t.c }, { id: 'es', et: 'Estado', tipo: 'estado', ops: ['Activo', 'Inactivo'], valor: t.inactivo ? 'Inactivo' : 'Activo' }, { tipo: 'nota', et: 'Un tag inactivo ya no se puede poner; los contactos que lo tienen lo conservan y se sigue pudiendo filtrar por él.' }], f => { if (!(f.n || '').trim()) return aviso('Falta el nombre del tag'); Object.assign(t, { n: f.n.trim(), c: f.c, inactivo: f.es === 'Inactivo' }); render(); }, 'Guardar'); },
  nuevaEtapa: () => formModal('Nueva etapa', [{ id: 'n', et: 'Nombre' }, { id: 't', et: 'Resultado', tipo: 'select', ops: ['En proceso', 'Ganada', 'Perdida'] }, { tipo: 'nota', et: 'El resultado le dice a los reportes qué significa llegar a esta etapa: «Ganada» cuenta como venta o conversión, «Perdida» como oportunidad perdida y «En proceso» es un paso intermedio. Son tres valores fijos.' }, { id: 'c', et: 'Color (opcional)', tipo: 'paleta' }, { id: 'es', et: 'Estado', tipo: 'estado', ops: ['Activa', 'Inactiva'], valor: 'Activa' }, { tipo: 'nota', et: 'Una etapa inactiva no aparece en el embudo ni se ofrece para mover contactos.' }], f => { if (!(f.n || '').trim()) return aviso('Falta el nombre de la etapa'); f.t = { 'En proceso': 'abierta', Ganada: 'ganada', Perdida: 'perdida' }[f.t]; const es = TB(E.embudo).etapas, i = es.findIndex(e => e.tipo !== 'abierta'); es.splice(f.t === 'abierta' && i >= 0 ? i : es.length, 0, { id: 'e' + Date.now(), n: f.n.trim(), tipo: f.t, c: f.c || (PALETA.find(p => !es.some(e => e.c === p[0])) || PALETA[0])[0], inactivo: f.es === 'Inactiva' }); render(); aviso('Etapa agregada a ' + TB(E.embudo).n); }),
  selEmbudo: d => { E.embudo = d.id; E.ruta = 'embudo'; cerrarModal(); render(); },
  gestionarEtapas: () => { const b = TB(E.embudo); abrirModal('Etapas de ' + esc(b.n) + (b.inactivo ? ' · inactivo' : ''), b.etapas.map((e, i) => `<div class="d-fila etapa ${e.inactivo ? 'fila-inactiva' : ''}"><span><b>${i + 1}</b> <span class="mini" style="--c:${e.c}">${esc(e.n)}</span>${e.inactivo ? ' ' + chip('Inactiva', 'rojo') : ''}</span><span class="acc-etapa">${chip(e.tipo === 'abierta' ? 'En proceso' : e.tipo === 'ganada' ? 'Ganada' : 'Perdida', e.tipo === 'ganada' ? 'verde' : e.tipo === 'perdida' ? 'gris' : 'azul')}${swEstado('etapaActiva', `data-b="${b.id}" data-id="${e.id}"`, !e.inactivo)}${btn('Editar', 'editarEtapa', 'enlace', `data-id="${e.id}"`)}</span></div>`).join('') + '<p class="nota">A la derecha de cada etapa: su resultado, el interruptor para activarla o desactivarla y Editar. El resultado es lo que usan los reportes para saber qué etapas cuentan como venta.</p>' + (b.tipo === 'general' ? `<h5 style="margin-top:14px">Números que atiende</h5><p>${b.numero ? 'Solo ' + esc(N(b.numero).nombre) + ': sus palabras clave solo cuentan en los chats de ese número.' : 'Todos los números: sus palabras clave cuentan en cualquier chat.'}</p><h5 style="margin-top:14px">Filtro</h5><p>${esc(filtroTxt(b))}</p>${filtroDe(b) !== 'manual' ? `<p class="nota">Quien cumpla el filtro entra solo a la etapa ${esc(primeraActiva(b).n)}.</p>` : ''}` : ''), btn('Cerrar', 'cerrarModal') + btn('Editar embudo', 'editarEmbudo', '', `data-id="${b.id}"`) + btn('+ Etapa', 'nuevaEtapa', 'primario')); },
  abrirEtapas: d => { E.embudo = d.id; A.gestionarEtapas(); },
  editarEtapa: d => { const b = TB(E.embudo), e = b.etapas.find(x => x.id === d.id), aRes = { abierta: 'En proceso', ganada: 'Ganada', perdida: 'Perdida' }; formModal('Editar etapa', [{ id: 'n', et: 'Nombre', valor: e.n }, { id: 't', et: 'Resultado', tipo: 'select', ops: ['En proceso', 'Ganada', 'Perdida'], valor: aRes[e.tipo] }, { id: 'c', et: 'Color (Automático deja el actual)', tipo: 'paleta' }, { id: 'es', et: 'Estado', tipo: 'estado', ops: ['Activa', 'Inactiva'], valor: e.inactivo ? 'Inactiva' : 'Activa' }, { tipo: 'nota', et: 'Una etapa con tarjetas no se puede desactivar: primero se mueven sus tarjetas.' }], f => { if (!(f.n || '').trim()) return aviso('Falta el nombre de la etapa'); const nuevoTipo = { 'En proceso': 'abierta', Ganada: 'ganada', Perdida: 'perdida' }[f.t]; if (e.tipo === 'abierta' && nuevoTipo !== 'abierta' && !b.etapas.some(x => x !== e && !x.inactivo && x.tipo === 'abierta')) return aviso('Debe quedar al menos una etapa En proceso activa'); if (b.tipo === 'tickets' && e.tipo !== 'abierta' && nuevoTipo === 'abierta' && !b.etapas.some(x => x !== e && !x.inactivo && x.tipo !== 'abierta')) return aviso('El embudo de tickets debe tener al menos una etapa que cierre el ticket'); if ((f.es === 'Inactiva') !== !!e.inactivo && cambiaEtapa(b.id, e.id, f.es === 'Activa') !== true) return false; e.n = f.n.trim(); e.tipo = nuevoTipo; if (f.c) e.c = f.c; render(); A.gestionarEtapas(); aviso('Etapa guardada'); }); },
  editarClaves: () => A.editarEmbudo({ id: E.embudo }),
  editarEmbudo: d => { const b = TB(d.id || E.embudo), general = b.tipo === 'general'; formModal('Editar embudo', [{ id: 'n', et: 'Nombre', valor: b.n }, { id: 'd', et: 'Descripción', valor: b.desc || '' }, ...(general ? [{ id: 'nu', et: 'Este embudo atiende las conversaciones de', tipo: 'select', ops: opsNumero(), valor: numeroTxt(b.numero) }, ...camposFiltro(b)] : []), ...(b.tipo === 'tickets' ? [{ tipo: 'nota', et: '<b>Siempre activo.</b> Es el embudo de tickets: cada ticket vive en sus etapas, así que no se puede desactivar ni borrar. Sus etapas se gestionan desde Tickets.' }] : [{ id: 'es', et: 'Estado', tipo: 'estado', ops: ['Activo', 'Inactivo'], valor: b.inactivo ? 'Inactivo' : 'Activo' }, { tipo: 'nota', et: 'Un embudo inactivo ya no recibe contactos nuevos, ni a mano ni por palabras clave. Los que ya están se conservan y se siguen viendo en reportes.' }])], f => { if (!(f.n || '').trim()) return aviso('Falta el nombre del embudo'); if (general && !leerFiltro(f)) return false; if (b.tipo !== 'tickets' && (f.es === 'Inactivo') !== !!b.inactivo && cambiaEmbudo(b.id, f.es === 'Activo') !== true) return false; b.n = f.n.trim(); b.desc = f.d; if (general) { const filtro = leerFiltro(f); if (!filtro) return false; b.numero = numeroDeOp(f.nu); Object.assign(b, filtro); } render(); aviso('Embudo guardado'); }); },
  nuevoEmbudo: () => formModal('Nuevo embudo', [{ id: 'n', et: 'Nombre' }, { id: 'd', et: 'Descripción' }, { id: 'c', et: 'Copiar etapas de', tipo: 'select', ops: ['Ninguno (empezar con Nuevo, En proceso, Ganado, Perdido)', ...DB.embudos.map(b => b.n)] }, { id: 'nu', et: 'Este embudo atiende las conversaciones de', tipo: 'select', ops: ['Todos los números', ...DB.numeros.map(n => 'Solo el número ' + n.nombre)] }, { tipo: 'nota', et: 'No elige a qué embudo va un cliente: limita este embudo a un número. Si eliges un solo número, las palabras clave de abajo solo cuentan en los chats de ese número y el embudo solo muestra sus conversaciones. Con «Todos los números» cuentan en cualquiera.' }, ...camposFiltro(null), { id: 'es', et: 'Estado', tipo: 'estado', ops: ['Activo', 'Inactivo'], valor: 'Activo' }], f => { if (!(f.n || '').trim()) return aviso('Falta el nombre del embudo'); const filtro = leerFiltro(f); if (!filtro) return false; const id = 'b' + Date.now(), o = DB.embudos.find(b => b.n === f.c); const es = (o ? o.etapas.map(e => [e.n, e.tipo, e.c]) : [['Nuevo', 'abierta', '#2563eb'], ['En proceso', 'abierta', '#f59e0b'], ['Ganado', 'ganada', '#0e9f6e'], ['Perdido', 'perdida', '#94a3b8']]).map((e, i) => ({ id: id + 's' + i, n: e[0], tipo: e[1], c: e[2] })); DB.embudos.push({ id, n: f.n || 'Embudo nuevo', tipo: 'general', numero: (DB.numeros.find(n => 'Solo el número ' + n.nombre === f.nu) || {}).id || null, ...filtro, desc: f.d || 'Agrega contactos desde el chat con "Agregar a embudo".', etapas: es, inactivo: f.es === 'Inactivo' }); E.embudo = id; E.ruta = 'embudo'; render(); aviso('Embudo creado'); }, 'Crear embudo'),
  agregarEmbudo: () => { const c = C(CONV().contacto), ya = posDe(c).map(p => p.b), libres = DB.embudos.filter(b => b.tipo !== 'tickets' && !b.inactivo && !ya.includes(b.id)); abrirModal('Agregar a embudo', libres.length ? `<p class="nota">Entra en la primera etapa; después la cambias desde aquí mismo.</p><div class="opciones">${libres.map(b => `<a data-accion="agregarA" data-b="${b.id}"><strong>${esc(b.n)}</strong><small>${b.etapas.filter(e => !e.inactivo).map(e => esc(e.n)).join(' → ')}</small></a>`).join('')}</div>` : '<p>Este contacto ya está en todos los embudos.</p>'); },
  agregarA: d => { const c = C(CONV().contacto), b = TB(d.b); DB.posiciones.push({ c: c.id, b: b.id, e: primeraActiva(b).id, m: 0, dias: 0 }); cerrarModal(); render(); aviso(`${c.nombre} entró a ${b.n}`); },
  quitarEmbudo: d => { const c = C(CONV().contacto); DB.posiciones = DB.posiciones.filter(p => !(p.c === c.id && p.b === d.b)); render(); aviso('Quitado de ' + TB(d.b).n); },
  nuevaBaja: () => formModal('Baja manual', [{ id: 't', et: 'Teléfono' }, { id: 'm', et: 'Motivo', tipo: 'area' }], f => { DB.bajas.unshift({ tel: f.t, contacto: 'Sin nombre', fecha: new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }), origen: 'Manual', campana: '—' }); render(); }),
  quitarBaja: d => { if (confirm('¿Quitar esta baja? Queda registrado en la bitácora.')) { DB.bajas.splice(+d.i, 1); render(); } },
  nuevoUsuario: () => { if (activos().length >= DB.empresa.usuariosMax) return aviso('Llegaste al máximo de usuarios activos de tu plan'); formModal('Invitar usuario', [{ id: 'n', et: 'Nombre' }, { id: 'c', et: 'Correo', tipo: 'email' }, { id: 'r', et: 'Rol', tipo: 'select', ops: ['Agente', 'Supervisor', 'Administrador'] }, { id: 's', et: 'Sucursal', tipo: 'select', ops: ['Matriz', 'Saltillo'] }], f => { DB.usuarios.push({ id: 'u' + Date.now(), nombre: f.n || 'Usuario nuevo', ini: iniciales(f.n || 'UN'), rol: f.r, sucursal: f.s, disp: false, correo: f.c, numeros: ['n1'] }); render(); aviso('Invitación enviada por correo'); }, 'Enviar invitación'); },
  empAccion: d => { const e = DB.empresas[+d.i]; e.estado = d.e; if (d.e === 'Activa') { e.plan = e.plan === 'Sin paquete' || e.plan === 'Prueba gratis' ? 'Básico' : e.plan; e.fin = '—'; } render(); aviso(`${e.nombre}: ${d.e}`); },
  empExtender: d => { const e = DB.empresas[+d.i]; e.fin = '17 oct 2026'; render(); aviso('Prueba extendida 7 días'); }
};

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-accion]'); if (!el) return;
  const fn = A[el.dataset.accion]; if (fn) { ev.preventDefault(); fn(el.dataset, el); }
});
document.addEventListener('change', ev => {
  if (ev.target.id === 'csvCamp') { const a = ev.target.files[0]; if (!a) return; const lector = new FileReader(); lector.onload = () => { const d = leeCsv(String(lector.result)); if (!d.columnas.length || !d.filas.length) return aviso('El CSV no tiene encabezados o filas'); campDatos = { ...d, nombre: a.name }; campMapeo = {}; campFila = 0; const n = $('#csvNombre'); if (n) n.textContent = a.name + ' · ' + d.filas.length + ' filas · columnas: ' + d.columnas.join(', '); pintaCamp(); }; return lector.readAsText(a); }
  if (ev.target.id === 'medioCamp') { const a = ev.target.files[0]; if (!a) return; const p = plCamp(), [tipo, mb, txt] = ACEPTA_PL[p.encTipo]; if (!tipo.test(a.type)) return aviso('El encabezado es de ' + p.encTipo.toLowerCase() + ': sube un ' + txt); if (a.size > mb * 1024 * 1024) return aviso('El archivo pesa más de ' + mb + ' MB'); campArchivo = { nombre: a.name, url: URL.createObjectURL(a), medio: p.encTipo }; return pintaCamp(); }
  if (ev.target.closest && ev.target.closest('#mapeoCamp')) { const n = ev.target.name || ''; if (n.startsWith('map_')) { const key = n.slice(4); campMapeo[key] = ev.target.value === '__fijo' ? { fijo: true, valor: '' } : { col: ev.target.value }; return pintaCamp(); } }
  if (ev.target.dataset && ev.target.dataset.subir) return subirPl(ev.target);
  if (ev.target.dataset && ev.target.dataset.img) { const a = ev.target.files[0], k = ev.target.dataset.img; if (!a) return; if (a.size > 2 * 1024 * 1024) return aviso('La imagen pesa más de 2 MB'); const lector = new FileReader(); lector.onload = () => { if ($('#formEmp')) E.empTmp = Object.fromEntries(new FormData($('#formEmp'))); DB.empresa[k] = lector.result; render(); aviso((k === 'logo' ? 'Logo' : 'Ícono') + ' cargado; se guarda con "Guardar cambios"'); }; return lector.readAsDataURL(a); }
  const el = ev.target, k = el.dataset.cambio; if (!k) return;
  if (k === 'numero') E.numero = el.value;
  if (k === 'filtro') E.f[el.dataset.k] = el.value;
  if (k === 'filtroBool') E.f[el.dataset.k] = el.checked;
  if (k === 'filtroTag') E.f.tags = el.checked ? [...E.f.tags, el.value] : E.f.tags.filter(t => t !== el.value);
  if (k === 'etapa') moverTarjeta(el.dataset.b, el.dataset.id, el.value);
  if (k === 'embudo') E.embudo = el.value;
  if (k === 'tbPre') { E.tb.pre = el.value; if (el.value === 'per' && !E.tb.desde) { E.tb.desde = aLocal(new Date(hoy0() - 29 * DIA)).slice(0, 10); E.tb.hasta = aLocal(hoy0()).slice(0, 10); } }
  if (k === 'tbDesde') E.tb.desde = el.value;
  if (k === 'tbHasta') E.tb.hasta = el.value;
  if (k === 'filtro' && el.dataset.k === 'embudo') E.f.etapa = '';
  if (k === 'autoActivo') DB.automaticos.find(a => a.id === el.dataset.id).activo = el.checked;
  if (k === 'disp') U(E.usuario).disp = el.checked;
  if (k === 'tipoPl') return modalPlantilla(el.value, $('#formPl [name=nombre]').value);
  if (k === 'tkPre') { E.tk.pre = el.value; if (el.value === 'per' && !E.tk.desde) { E.tk.desde = aLocal(new Date(hoy0() - 6 * DIA)).slice(0, 10); E.tk.hasta = aLocal(hoy0()).slice(0, 10); } }
  if (k === 'tkDesde') E.tk.desde = el.value;
  if (k === 'tkHasta') E.tk.hasta = el.value;
  if (k === 'usuarioActivo') { const quiere = el.checked; el.checked = !quiere; return quiere ? A.activarUsuario({ id: el.dataset.id }) : A.desactivarUsuario({ id: el.dataset.id }); }
  if (k === 'tagActivo') { const t = TAG(el.dataset.id); t.inactivo = !el.checked; aviso('Tag ' + t.n + (t.inactivo ? ' desactivado: ya no se puede poner' : ' activado')); }
  if (k === 'embudoActivo') cambiaEmbudo(el.dataset.id, el.checked);
  if (k === 'etapaActiva') { cambiaEtapa(el.dataset.b, el.dataset.id, el.checked); render(); return A.gestionarEtapas(); }
  if (k === 'repNum') E.repNum = el.value;
  if (k === 'repEmb') E.repEmb = el.value;
  if (k === 'repPre') { E.rep.pre = el.value; if (el.value === 'per' && !E.rep.desde) { E.rep.desde = aLocal(new Date(hoy0() - 13 * DIA)).slice(0, 10); E.rep.hasta = aLocal(hoy0()).slice(0, 10); } }
  if (k === 'repDesde') E.rep.desde = el.value;
  if (k === 'repHasta') E.rep.hasta = el.value;
  if (k === 'numRap') { E.numRap = el.value; E.pagRap = 1; }
  if (k === 'numPl') E.numPl = el.value;
  if (k === 'envioCamp') return $('#progCamp').classList.toggle('oculto', !el.value.startsWith('Programar'));
  if (k === 'embEnt') return $('#filtroEnt').innerHTML = infoEmbCamp(TB(el.value), true);
  if (k === 'numEnt') { $('#formEnt [name=embudo]').innerHTML = opsEmbCamp(el.value); return $('#filtroEnt').innerHTML = infoEmbCamp(embudosCamp(el.value)[0], true); }
  if (k === 'embCamp') return $('#filtroCamp').innerHTML = infoEmbCamp(TB(el.value));
  if (k === 'numCamp') { const ap = plantillasDe(el.value).filter(p => p.estado === 'Aprobada'), sl = $('#formCamp [name=plantilla]'); sl.innerHTML = ap.map(p => `<option>${p.nombre}</option>`).join(''); $('#formCamp [name=embudo]').innerHTML = opsEmbCamp(el.value); $('#filtroCamp').innerHTML = infoEmbCamp(embudosCamp(el.value)[0]); campMapeo = { _tel: campMapeo._tel }; campArchivo = null; return pintaCamp(); }
  if (k === 'previaCamp') { campMapeo = { _tel: campMapeo._tel }; campArchivo = null; return pintaCamp(); }
  if (k === 'segCamp') { campSeg = [...document.querySelectorAll('#formCamp [name=segTag]:checked')].map(x => x.value); campFila = 0; return pintaCamp(); }
  if (k === 'audCamp' || k === 'listaCamp') { campMapeo = {}; campFila = 0; aplicarSi(); return pintaCamp(); }
  render();
});
document.addEventListener('input', ev => {
  if (ev.target.closest('#modal form') || ev.target.closest('#formEmp')) aplicarSi();
  if (ev.target.closest('.estado-sw')) { const b = ev.target.closest('.estado-sw').querySelector('b'); b.textContent = ev.target.checked ? b.dataset.on : b.dataset.off; }
  if (ev.target.closest('.bloque-h') && ev.target.type === 'checkbox') { const bl = ev.target.closest('.bloque-h'); bl.classList.toggle('cerrado', !ev.target.checked); bl.querySelector('.estado-h').textContent = ev.target.checked ? '' : 'Cerrado'; }
  if (ev.target.closest('#formGen') && ['r', 'prueba'].includes(ev.target.name)) pruebaRegex();
  if (ev.target.closest('#formPl') && ev.target.name !== 'tipo') actualizaPl(ev);
  if (ev.target.closest('#formEnv')) pintaEnv();
  if (ev.target.id === 'buscaLista') { E.buscaLista = ev.target.value; $('#filasLista').innerHTML = filasLista(DB.listas.find(l => l.id === E.listaAbierta)); }
  if (ev.target.id === 'busca') { E.busca = ev.target.value; $('#listaConvs').innerHTML = filasConv(); }
  if (ev.target.name && ev.target.name.startsWith('fijo_') && ev.target.closest('#mapeoCamp')) { const key = ev.target.name.slice(5); campMapeo[key] = { fijo: true, valor: ev.target.value }; const pos = ev.target.selectionStart; pintaCamp(); const i = $('#mapeoCamp [name="' + ev.target.name + '"]'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } return; }
  if (ev.target.id === 'buscaPl' || ev.target.id === 'buscaRap') { const id = ev.target.id; if (id === 'buscaPl') E.buscaPl = ev.target.value; else { E.buscaRap = ev.target.value; E.pagRap = 1; } render(); const b = $('#' + id); b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
  if (ev.target.id === 'buscaContacto') { E.buscaContacto = ev.target.value; render(); const b = $('#buscaContacto'); b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
  if (ev.target.id === 'texto' && ev.target.value === '/') { ev.target.value = ''; A.rapidas(); }
});
document.addEventListener('keydown', ev => {
  if (ev.target.id === 'texto' && ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); A.enviar(); }
  if (ev.key === 'Escape') cerrarModal();
});

function moverTarjeta(idEmbudo, id, idEtapa) {
  const b = TB(idEmbudo), e = b.etapas.find(x => x.id === idEtapa);
  if (b.tipo === 'tickets') {
    const k = DB.tickets.find(x => String(x.id) === String(id)); if (k.etapa === idEtapa) return;
    k.etapa = idEtapa;
    return aviso(`Ticket #${k.id} pasó a ${e.n}: queda ${estadoTk(k).toLowerCase()}`);
  }
  const c = C(id), p = DB.posiciones.find(x => x.c === id && x.b === idEmbudo);
  if (!p || p.e === idEtapa) return;
  p.e = idEtapa;
  const v = DB.conversaciones.find(x => x.contacto === c.id);
  if (v) v.msgs.push({ de: 's', t: `${U(E.usuario).nombre} movió la etapa a ${e.n} en ${b.n}`, h: ahora() });
  aviso(e.tipo === 'ganada' ? `${c.nombre} pasó a ${e.n}: cuenta como conversión` : `${c.nombre} pasó a ${e.n} en ${b.n}`);
}
let arrastrado = null;
document.addEventListener('dragstart', ev => { const t = ev.target.closest('.tarjeta'); if (t) { arrastrado = t.dataset.id; t.classList.add('arrastrando'); } });
document.addEventListener('dragover', ev => { const c = ev.target.closest('.columna'); if (c && arrastrado) { ev.preventDefault(); c.classList.add('sobre'); } });
document.addEventListener('dragleave', ev => { const c = ev.target.closest('.columna'); if (c) c.classList.remove('sobre'); });
document.addEventListener('drop', ev => { const c = ev.target.closest('.columna'); if (c && arrastrado) { ev.preventDefault(); moverTarjeta(E.ruta === 'tickets' ? ETK().id : E.embudo, arrastrado, c.dataset.etapa); arrastrado = null; render(); } });
document.addEventListener('dragend', () => { arrastrado = null; });

$('#selRol').addEventListener('change', ev => { E.rol = ev.target.value; E.usuario = ((DB.usuarios.find(u => u.id === USUARIO_POR_ROL[E.rol] && !u.inactivo) || DB.usuarios.find(u => !u.inactivo && u.rol === { A: 'Administrador', S: 'Supervisor', G: 'Agente' }[E.rol])) || U(USUARIO_POR_ROL[E.rol])).id || USUARIO_POR_ROL[E.rol]; if (E.ruta !== 'login') E.ruta = E.rol === 'P' ? 'empresas' : 'bandeja'; E.panel = 'lista'; render(); });
$('#selVista').addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; E.movil = b.dataset.vista === 'movil'; E.panel = 'lista'; [...$('#selVista').children].forEach(x => x.classList.toggle('activo', x === b)); render(); });

try { E.menuCol = !!localStorage.getItem('crmMenuCol'); } catch (e) {}
// Embudo: abre con el primer embudo (o el único que haya) y con un mes de fechas ya puesto.
{ const h = hoy0(), d = new Date(h.getFullYear(), h.getMonth() - 1, h.getDate()); E.tb = { pre: 'per', desde: aLocal(d).slice(0, 10), hasta: aLocal(h).slice(0, 10) }; E.embudo = DB.embudos[0].id; }
render();
