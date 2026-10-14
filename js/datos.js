// Datos fijos del prototipo. Todo es inventado: no hay clientes ni telefonos reales.
const DB = {
  empresa: { nombre: 'Aromas del Norte', razon: 'Aromas del Norte S.A. de C.V.', tel: '+52 81 5550 0100', correo: 'hola@aromasdelnorte.test', domicilio: 'Av. Constitución 120, Centro, Monterrey, N.L., 64000', web: 'https://instagram.com/aromasdelnorte', zona: 'America/Monterrey', logo: '', icono: '', giro: '', vende: '', noVende: '', fRazon: 'AROMAS DEL NORTE', rfc: 'ADN150312AB1', fCp: '64000', regimen: '601', usoCfdi: 'G03', fCorreo: 'facturas@aromasdelnorte.test', limTipo: 'Limitado en total', limPeriodo: 'Diario', limCant: 100, limUsadas: 37, plan: 'Prueba gratis', diasPrueba: 5, usuariosMax: 5, numerosMax: 2 },

  usuarios: [
    { id: 'u1', nombre: 'Adely Torres', ini: 'AT', rol: 'Administrador', sucursal: 'Matriz', disp: true, correo: 'adely@aromasdelnorte.test', numeros: ['n1', 'n2'] },
    { id: 'u2', nombre: 'Elena Garza', ini: 'EG', rol: 'Supervisor', sucursal: 'Matriz', disp: true, correo: 'elena@aromasdelnorte.test', numeros: ['n1', 'n2'] },
    { id: 'u3', nombre: 'Marco Ruiz', ini: 'MR', rol: 'Agente', sucursal: 'Saltillo', disp: true, correo: 'marco@aromasdelnorte.test', numeros: ['n1'] },
    { id: 'u4', nombre: 'Sofía Luna', ini: 'SL', rol: 'Agente', sucursal: 'Saltillo', disp: false, correo: 'sofia@aromasdelnorte.test', numeros: ['n2'] },
    { id: 'u5', nombre: 'Iván Robles', ini: 'IR', rol: 'Agente', sucursal: 'Matriz', disp: false, correo: 'ivan@aromasdelnorte.test', numeros: ['n1'], inactivo: true, inactivoDesde: '30 sep 2026' }
  ],

  // Cuentas de WhatsApp Business de la empresa. Las plantillas pertenecen a la cuenta y las comparten sus números.
  cuentas: [{ id: 'w1', nombre: 'Aromas del Norte · Ventas' }, { id: 'w2', nombre: 'Aromas del Norte · Atención' }],

  numeros: [
    { id: 'n1', cuenta: 'w1', nombre: 'Pedidos', tel: '+52 81 5550 0101', tipo: 'Cloud API', estado: 'Conectado', calidad: 'Alta', limite: '2,000 por día', oficial: true, cierre: 24, siempre: false, horario: { lv: { abierto: true, abre: '09:00', cierra: '18:00' }, sab: { abierto: true, abre: '10:00', cierra: '14:00' }, dom: { abierto: false, abre: '10:00', cierra: '14:00' } } },
    { id: 'n2', cuenta: 'w2', nombre: 'Atención a clientes', tel: '+52 81 5550 0102', tipo: 'Coexistencia', estado: 'Conectado', calidad: 'Media', limite: '2,000 por día', oficial: false, cierre: 48, siempre: false, horario: { lv: { abierto: true, abre: '09:00', cierra: '17:00' }, sab: { abierto: false, abre: '10:00', cierra: '14:00' }, dom: { abierto: false, abre: '10:00', cierra: '14:00' } } }
  ],

  gruposTags: [
    { id: 'g1', nombre: 'Mis pedidos', tags: [{ id: 't1', n: 'No se refleja el pago', c: '#e11d48' }, { id: 't2', n: 'Problema con envío', c: '#f59e0b' }, { id: 't3', n: 'Sin pedidos en 3 meses', c: '#64748b' }] },
    { id: 'g2', nombre: 'Garantías', tags: [{ id: 't4', n: 'Solicitar reporte', c: '#7c3aed' }, { id: 't5', n: 'Reporte iniciado', c: '#2563eb' }] },
    { id: 'g4', nombre: 'Tipo de cliente', tags: [{ id: 't8', n: 'Cliente nuevo', c: '#2563eb' }, { id: 't9', n: 'Cliente potencial', c: '#7c3aed' }, { id: 't10', n: 'Cliente frecuente', c: '#0e9f6e' }] },
    { id: 'g3', nombre: 'Generales', tags: [{ id: 't6', n: 'Pide catálogo', c: '#0e9f6e' }, { id: 't7', n: 'Cierre', c: '#0f172a' }] }
  ],

  // Cada embudo tiene sus propias etapas. Tipos: general (contactos), tickets (tickets) y campana (contactos de una campaña).
  embudos: [
    { id: 'b1', n: 'Ventas', tipo: 'general', filtro: 'claves', aplicar: 'siempre', claves: ['precio', 'comprar', 'cotización'], desc: 'Seguimiento de ventas. Un contacto entra cuando alguien lo agrega o cuando escribe una de las palabras clave.', etapas: [
      { id: 'e1', n: 'Nuevo', tipo: 'abierta', c: '#2563eb' },
      { id: 'e2', n: 'En conversación', tipo: 'abierta', c: '#f59e0b' },
      { id: 'e3', n: 'Interesado', tipo: 'abierta', c: '#7c3aed' },
      { id: 'e4', n: 'Cliente', tipo: 'ganada', c: '#0e9f6e' },
      { id: 'e5', n: 'Perdido', tipo: 'perdida', c: '#94a3b8' }] },
    { id: 'b2', n: 'Tickets', tipo: 'tickets', desc: 'Cómo va avanzando la solución de cada problema. La etapa decide si el ticket está abierto, en proceso o cerrado.', etapas: [
      { id: 'q1', n: 'Nuevo', tipo: 'abierta', c: '#e11d48' },
      { id: 'q2', n: 'En revisión', tipo: 'abierta', c: '#f59e0b' },
      { id: 'q3', n: 'Esperando al cliente', tipo: 'abierta', c: '#7c3aed' },
      { id: 'q4', n: 'Resuelto', tipo: 'ganada', c: '#0e9f6e' },
      { id: 'q5', n: 'No resuelto', tipo: 'perdida', c: '#94a3b8' }] },
    { id: 'b3', n: 'Campaña · Catálogo de otoño', tipo: 'campana', campana: 'k1', claves: ['otoño', 'catálogo'], desc: 'Se creó sola al lanzar la campaña. Entran los contactos que responden.', etapas: [
      { id: 'x1', n: 'Respondió', tipo: 'abierta', c: '#2563eb' },
      { id: 'x2', n: 'Interesado', tipo: 'abierta', c: '#7c3aed' },
      { id: 'x3', n: 'En seguimiento', tipo: 'abierta', c: '#f59e0b' },
      { id: 'x4', n: 'Compró', tipo: 'ganada', c: '#0e9f6e' },
      { id: 'x5', n: 'Sin interés', tipo: 'perdida', c: '#94a3b8' }] },
    { id: 'b4', n: 'Campaña · Inscripciones Saltillo', tipo: 'campana', campana: 'k2', claves: ['yo quiero', 'saltillo'], desc: 'Se creó sola al activar la campaña. Entran los contactos que escriben la palabra clave.', etapas: [
      { id: 'y1', n: 'Prospecto nuevo', tipo: 'abierta', c: '#2563eb' },
      { id: 'y2', n: 'Seguimiento', tipo: 'abierta', c: '#f59e0b' },
      { id: 'y3', n: 'Inscrito', tipo: 'ganada', c: '#0e9f6e' },
      { id: 'y4', n: 'Rechazado', tipo: 'perdida', c: '#94a3b8' }] }
  ],
  // Tarjetas: en qué embudo y etapa está cada contacto. Un contacto sin tarjetas no está en ningún embudo.
  posiciones: [
    { c: 'c1', b: 'b1', e: 'e3', m: 4200, dias: 7, origen: 'manual' },
    { c: 'c3', b: 'b1', e: 'e2', m: 1800, dias: 23, origen: 'clave', clave: 'precio' },
    { c: 'c4', b: 'b1', e: 'e4', m: 12500, dias: 60, origen: 'manual' },
    { c: 'c7', b: 'b1', e: 'e2', m: 950, dias: 5, origen: 'clave', clave: 'comprar' },
    { c: 'c1', b: 'b3', e: 'x2', m: 4200, dias: 3, origen: 'campana' },
    { c: 'c3', b: 'b3', e: 'x1', m: 0, dias: 3, origen: 'campana' },
    { c: 'c5', b: 'b3', e: 'x5', m: 0, dias: 3, origen: 'campana' },
    { c: 'c6', b: 'b4', e: 'y1', m: 0, dias: 2, origen: 'campana' },
    { c: 'c7', b: 'b4', e: 'y2', m: 0, dias: 12, origen: 'campana' },
    { c: 'c1', b: 'b4', e: 'y3', m: 900, dias: 20, origen: 'campana' }
  ],

  contactos: [
    { id: 'c1', nombre: 'Mariana Solís', tel: '+52 81 5550 1001', tipo: 'Cliente', especial: true, correo: 'mariana@correo.test', consent: 'otorgado', permiso: { fecha: '28 sep 2026', origen: 'importado del CSV con permiso_campanas = si' }, tags: ['t6', 't10'], alta: '28 sep 2026', notas: [{ t: 'Pide catálogo de temporada cada mes.', por: 'u2', f: '1 oct' }] },
    { id: 'c2', nombre: 'Jorge Peña', tel: '+52 81 5550 1002', tipo: 'Usuario nuevo', especial: false, correo: '', consent: 'sin', tags: ['t8'], alta: '4 oct 2026', notas: [] },
    { id: 'c3', nombre: 'Lucía Fernández', tel: '+52 84 5550 1003', tipo: 'Cliente', especial: false, correo: 'lucia@correo.test', consent: 'otorgado', tags: ['t2'], alta: '12 sep 2026', notas: [] },
    { id: 'c4', nombre: 'Tienda La Esquina', tel: '+52 81 5550 1004', tipo: 'Cliente especial', especial: true, correo: 'compras@laesquina.test', consent: 'otorgado', tags: [], alta: '3 ago 2026', notas: [] },
    { id: 'c5', nombre: 'Raúl Medina', tel: '+52 87 5550 1005', tipo: 'Usuario público', especial: false, correo: '', consent: 'baja', tags: [], alta: '20 sep 2026', notas: [] },
    { id: 'c6', nombre: 'Paola Ibarra', tel: '+52 81 5550 1006', tipo: 'Usuario nuevo', especial: false, correo: '', consent: 'sin', tags: ['t1'], alta: '4 oct 2026', notas: [] },
    { id: 'c7', nombre: 'Daniel Ochoa', tel: '+52 81 5550 1007', tipo: 'Cliente', especial: false, correo: 'daniel@correo.test', consent: 'otorgado', tags: ['t4'], alta: '30 sep 2026', notas: [] }
  ],

  conversaciones: [
    { id: 'v1', numero: 'n1', contacto: 'c1', resp: 'u3', estado: 'abierta', noLeidos: 2, espera: '25 min', ventana: 1415, tags: ['t6'], campana: 'k1', hora: '11:02', msgs: [
      { de: 'camp', tipo: 'plantilla', t: 'Hola Mariana, ya llegó el catálogo de otoño con 20% en tu primer pedido. ¿Te lo envío?', botones: ['Sí, envíalo', 'Darme de baja'], h: '10:15', est: 'leido' },
      { de: 'c', t: 'Sí, envíalo', h: '10:31' },
      { de: 'a', por: 'u3', t: '¡Claro, Mariana! Aquí lo tienes 👇', h: '10:33', est: 'leido' },
      { de: 'a', por: 'u3', tipo: 'doc', t: 'Catalogo-otono-2026.pdf', h: '10:33', est: 'leido' },
      { de: 's', t: 'Marco Ruiz movió la etapa a Interesado', h: '10:34' },
      { de: 'c', t: 'Me interesa la línea de velas. ¿Cuál es el mínimo de compra?', h: '11:01' },
      { de: 'c', tipo: 'audio', t: 'Nota de voz · 0:14', h: '11:02' }
    ] },
    { id: 'v2', numero: 'n1', contacto: 'c2', resp: null, estado: 'abierta', noLeidos: 1, espera: '5 h', ventana: 1140, gratis: 4020, tags: [], campana: null, hora: '06:10', msgs: [
      { de: 'c', t: 'Hola, quiero información para comprar', h: '06:10' },
      { de: 'auto', t: 'Gracias por escribir a Aromas del Norte. Nuestro horario es de 9:00 a 18:00; en cuanto abramos te atendemos.', h: '06:10', est: 'entregado' }
    ] },
    { id: 'v3', numero: 'n2', contacto: 'c3', resp: 'u4', estado: 'abierta', noLeidos: 0, espera: '', ventana: 0, tags: ['t2'], campana: null, hora: 'ayer', msgs: [
      { de: 'c', t: 'Mi pedido no ha llegado y ya pasaron 6 días', h: 'ayer 09:12' },
      { de: 'a', por: 'u4', t: 'Lamento la demora, Lucía. Ya levanté el reporte con paquetería y te aviso hoy mismo.', h: 'ayer 09:20', est: 'leido' },
      { de: 's', t: 'Elena Garza levantó un ticket: Problema con envío', h: 'ayer 09:25' }
    ] },
    { id: 'v4', numero: 'n1', contacto: 'c4', resp: 'u2', estado: 'abierta', noLeidos: 0, espera: '', ventana: 610, tags: [], campana: null, hora: '09:48', msgs: [
      { de: 'c', t: 'Buen día, necesito repetir el pedido del mes pasado', h: '09:40' },
      { de: 'a', por: 'u2', t: 'Con gusto. Te confirmo existencias y te mando el total.', h: '09:48', est: 'entregado' }
    ] },
    { id: 'v5', numero: 'n1', contacto: 'c6', resp: null, estado: 'abierta', noLeidos: 3, espera: '1 d', ventana: 45, tags: ['t1'], campana: 'k2', hora: '3 oct', msgs: [
      { de: 'c', t: 'YO QUIERO', h: '3 oct 17:20' },
      { de: 's', t: 'Conversación asociada a la campaña Inscripciones Saltillo', h: '3 oct 17:20' },
      { de: 'c', t: 'Ya hice el pago pero no se refleja', h: '3 oct 17:31' },
      { de: 'c', tipo: 'imagen', t: 'Foto · comprobante.jpg', h: '3 oct 17:31' }
    ] },
    { id: 'v6', numero: 'n2', contacto: 'c5', resp: 'u4', estado: 'cerrada', noLeidos: 0, espera: '', ventana: 0, tags: [], campana: 'k1', hora: '2 oct', msgs: [
      { de: 'camp', tipo: 'plantilla', t: 'Hola Raúl, ya llegó el catálogo de otoño con 20% en tu primer pedido. ¿Te lo envío?', botones: ['Sí, envíalo', 'Darme de baja'], h: '2 oct 10:15', est: 'leido' },
      { de: 'c', t: 'Darme de baja', h: '2 oct 10:40' },
      { de: 's', t: 'El contacto se dio de baja de marketing (botón)', h: '2 oct 10:40' },
      { de: 'auto', t: 'Listo, no recibirás más promociones. Si necesitas algo, aquí estamos.', h: '2 oct 10:40', est: 'leido' }
    ] },
    { id: 'v7', numero: 'n2', contacto: 'c7', resp: 'u3', estado: 'inactividad', noLeidos: 0, espera: '', ventana: 0, tags: ['t4'], campana: null, hora: '1 oct', msgs: [
      { de: 'c', t: '¿Cómo solicito una garantía?', h: '30 sep 16:02' },
      { de: 'a', por: 'u3', t: 'Te comparto el formato. ¿Me confirmas tu número de pedido?', h: '30 sep 16:10', est: 'leido' },
      { de: 's', t: 'Cerrada por inactividad (24 h sin mensajes)', h: '1 oct 16:10' }
    ] },
    { id: 'v8', numero: 'n1', grupo: 'Líderes zona norte', contacto: null, resp: 'u2', estado: 'abierta', noLeidos: 0, espera: '', ventana: 800, tags: [], campana: null, hora: '08:30', msgs: [
      { de: 'c', autor: 'Mariana Solís', t: '¿A qué hora es la junta del viernes?', h: '08:22' },
      { de: 'a', por: 'u2', t: 'A las 10:00 por videollamada, les mando la liga el jueves.', h: '08:30', est: 'leido' }
    ] }
  ],

  tiposContacto: ['Usuario nuevo', 'Cliente', 'Usuario público', 'Cliente especial'],
  motivos: ['Problema con envío', 'No se refleja el pago', 'Garantía', 'Aclaración', 'Otro'],
  tickets: [
    { id: 95, conv: 'v1', contacto: 'c1', motivo: 'No se refleja el pago', estado: 'Cerrado', etapa: 'q4', dias: 6, primera: 8, cierreH: 3, por: 'u2', asignado: 'u3', creado: '29 sep 11:00', desc: 'Pago por transferencia no aplicado.', comentarios: [] },
    { id: 93, conv: 'v4', contacto: 'c4', motivo: 'Problema con envío', estado: 'Cerrado', etapa: 'q4', dias: 9, primera: 20, cierreH: 30, por: 'u2', asignado: 'u2', creado: '26 sep 10:30', desc: 'Faltó una caja en el pedido.', comentarios: [] },
    { id: 90, conv: 'v6', contacto: 'c5', motivo: 'Aclaración', estado: 'Cerrado', etapa: 'q5', dias: 12, primera: 45, cierreH: 52, por: 'u1', asignado: 'u4', creado: '23 sep 17:40', desc: 'Pidió aclaración de precios; no respondió.', comentarios: [] },
    { id: 88, conv: 'v2', contacto: 'c2', motivo: 'Garantía', estado: 'Cerrado', etapa: 'q4', dias: 25, primera: 12, cierreH: 8, por: 'u2', asignado: 'u3', creado: '10 sep 09:15', desc: 'Difusor defectuoso, se cambió.', comentarios: [] },
    { id: 101, conv: 'v3', contacto: 'c3', motivo: 'Problema con envío', estado: 'En proceso', etapa: 'q2', dias: 1, primera: 15, por: 'u2', asignado: 'u4', creado: 'ayer 09:25', desc: 'Pedido con 6 días de retraso. Revisar guía con paquetería.', comentarios: [{ por: 'u4', t: 'Paquetería confirma entrega para mañana.', f: 'ayer 12:10' }] },
    { id: 102, conv: 'v5', contacto: 'c6', motivo: 'No se refleja el pago', estado: 'Abierto', etapa: 'q1', dias: 2, por: 'u2', asignado: 'u3', creado: '3 oct 18:00', desc: 'Envió comprobante. Validar con cobranza.', comentarios: [] },
    { id: 98, conv: 'v7', contacto: 'c7', motivo: 'Garantía', estado: 'Cerrado', etapa: 'q4', dias: 5, primera: 10, cierreH: 24, por: 'u1', asignado: 'u3', creado: '30 sep 16:15', desc: 'Solicita garantía de difusor.', comentarios: [{ por: 'u3', t: 'Se envió formato; cliente no respondió.', f: '1 oct 16:00' }] }
  ],

  plantillas: [
    { id: 'p1', uso: 'Iniciar conversación', cuenta: 'w1', nombre: 'catalogo_otono', cat: 'Marketing', idioma: 'Español (MX)', formato: 'Mensaje estándar', estado: 'Aprobada', cuerpo: 'Hola {{1}}, ya llegó el catálogo de otoño con 20% en tu primer pedido. ¿Te lo envío?', ejemplos: { b: { 1: 'María' } }, botones: ['Sí, envíalo', 'Darme de baja'], envios: 1240, clics: 312, ventas: 41 },
    { id: 'p2', uso: 'Seguimiento', cuenta: 'w1', nombre: 'confirmacion_pedido', cat: 'Utilidad', idioma: 'Español (MX)', formato: 'Mensaje estándar', estado: 'Aprobada', cuerpo: 'Hola {{1}}, tu pedido {{2}} fue confirmado y sale mañana.', ejemplos: { b: { 1: 'María', 2: '48210' }, u: 'MX48210' }, urlVar: true, botones: ['↗ Rastrear pedido'], envios: 2185, clics: 640, ventas: 0 },
    { id: 'p5', uso: 'Campaña', cuenta: 'w1', nombre: 'promo_con_foto', cat: 'Marketing', idioma: 'Español (MX)', formato: 'Mensaje estándar', estado: 'Aprobada', encTipo: 'Foto', cuerpo: 'Hola {{1}}, esta semana tienes {{2}} en {{3}}.', ejemplos: { b: { 1: 'María', 2: '20% de descuento', 3: 'velas aromáticas' } }, pie: 'Promoción válida hasta agotar existencias', botones: ['Me interesa', 'Darme de baja'], envios: 86, clics: 0, ventas: 6 },
    { id: 'p6', uso: 'Campaña', cuenta: 'w1', nombre: 'novedades_carrusel', cat: 'Marketing', idioma: 'Español (MX)', formato: 'Carrusel', estado: 'Aprobada', encTipo: 'Foto', cuerpo: 'Hola {{1}}, mira lo nuevo de {{2}}. Responde BAJA para no recibir más mensajes.', ejemplos: { b: { 1: 'María', 2: 'octubre' }, c: [{ 1: '$189' }, { 1: '$349' }] }, tarjetas: [{ texto: 'Velas desde {{1}}', botones: ['Ver producto'] }, { texto: 'Difusores desde {{1}}', botones: ['Ver producto'] }], botones: [], envios: 40, clics: 12, ventas: 3 },
    { id: 'p7', uso: 'Campaña', cuenta: 'w2', nombre: 'oferta_relampago', cat: 'Marketing', idioma: 'Español (MX)', formato: 'Oferta por tiempo limitado', estado: 'Aprobada', encTipo: 'Foto', oferta: '20% de descuento', vence: true, codigo: 'OTONO20', cuerpo: 'Hola {{1}}, solo por tiempo limitado. Responde BAJA para no recibir más mensajes.', ejemplos: { b: { 1: 'María' }, u: 'otono' }, urlVar: true, botones: ['⧉ Copiar código', '↗ Comprar'], envios: 15, clics: 4, ventas: 2 },
    { id: 'p8', uso: 'Iniciar conversación', cuenta: 'w1', nombre: 'codigo_acceso', cat: 'Autenticación', idioma: 'Español (MX)', formato: 'Autenticación', tipo: 'auth', otp: 'Copiar código', min: 10, estado: 'Aprobada', cuerpo: '{{1}} es tu código de verificación. Por tu seguridad, no lo compartas.', ejemplos: { b: { 1: '483920' } }, pie: 'Este código vence en 10 minutos.', botones: ['⧉ Copiar código'], envios: 320, clics: 0, ventas: 0 },
    { id: 'p3', uso: 'Campaña', cuenta: 'w1', nombre: 'reactivacion_3_meses', cat: 'Marketing', idioma: 'Español (MX)', formato: 'Carrusel', encTipo: 'Foto', tarjetas: [{ texto: 'Velas de temporada', botones: ['Ver producto'] }, { texto: 'Difusores nuevos', botones: ['Ver producto'] }, { texto: 'Kits de regalo', botones: ['Ver producto'] }], estado: 'En revisión', cuerpo: 'Hola {{1}}, te extrañamos. Mira lo nuevo de este mes. Responde BAJA para no recibir más mensajes.', botones: [], envios: 0, clics: 0 },
    { id: 'p4', uso: 'Campaña', cuenta: 'w2', nombre: 'promo_relampago', cat: 'Marketing', idioma: 'Español (MX)', formato: 'Mensaje estándar', estado: 'Rechazada', cuerpo: '¡¡SOLO HOY!! Compra ya.', botones: ['Darme de baja'], envios: 0, clics: 0, motivo: 'Meta: el texto no cumple la política de contenido promocional.' }
  ],

  campanas: [
    { id: 'k1', nombre: 'Catálogo de otoño', tipo: 'Envío', claves: 'otoño, catálogo', plantilla: 'catalogo_otono', numero: 'n1', estado: 'Enviada', fecha: '2 oct 10:15', total: 1280, enviados: 1240, entregados: 1198, leidos: 904, respuestas: 187, clics: 312, bajas: 9, conversiones: 41, errores: 40 },
    { id: 'k2', nombre: 'Inscripciones Saltillo', tipo: 'Entrada', claves: 'YO QUIERO, Saltillo', numero: 'n1', estado: 'Activa', inicio: '2026-10-01T00:00', fin: '2026-10-31T23:59', fecha: '1 oct – 31 oct', total: 64, enviados: 0, entregados: 0, leidos: 0, respuestas: 64, clics: 0, bajas: 0, conversiones: 12, errores: 0 },
    { id: 'k3', nombre: 'Reactivación 3 meses', tipo: 'Envío', plantilla: 'confirmacion_pedido', numero: 'n1', estado: 'Programada', fecha: '8 oct 09:00', total: 520, enviados: 0, entregados: 0, leidos: 0, respuestas: 0, clics: 0, bajas: 0, conversiones: 0, errores: 0 }
  ],

  listas: [
    { id: 'l1', nombre: 'Clientes activos', creada: '15 sep 2026', miembros: [
      { nombre: 'Mariana', apellido: 'Solís', tel: '+52 81 5550 1001', tipo: 'Cliente' },
      { nombre: 'Lucía', apellido: 'Fernández', tel: '+52 84 5550 1003', tipo: 'Cliente' },
      { nombre: 'Daniel', apellido: 'Ochoa', tel: '+52 81 5550 1007', tipo: 'Cliente' },
      { nombre: 'Raúl', apellido: 'Medina', tel: '+52 87 5550 1005', tipo: 'Usuario público' },
      { nombre: 'Norma', apellido: 'Díaz', tel: '+52 81 5550 2040', tipo: 'Importado' },
      { nombre: 'Héctor', apellido: 'Salas', tel: '+52 81 5550 3010', tipo: 'Importado' }] },
    { id: 'l2', nombre: 'Clientes de Saltillo', creada: '22 sep 2026', miembros: [
      { nombre: 'Lucía', apellido: 'Fernández', tel: '+52 84 5550 1003', tipo: 'Cliente' },
      { nombre: 'Paola', apellido: 'Ibarra', tel: '+52 81 5550 1006', tipo: 'Usuario nuevo' },
      { nombre: 'Iván', apellido: 'Cantú', tel: '+52 84 5550 3022', tipo: 'Importado' }] }
  ],

  // numero: null = todos los números.
  respuestas: [
    { id: 'r1', titulo: 'Saludo', texto: '¡Hola! Gracias por escribir a Aromas del Norte. ¿En qué te puedo ayudar?', archivo: '' },
    { id: 'r2', titulo: 'Catálogo', texto: 'Te comparto nuestro catálogo vigente 👇', archivo: 'Catalogo-otono-2026.pdf' },
    { id: 'r3', numero: 'n1', titulo: 'Datos de pago', texto: 'Puedes pagar por transferencia. En cuanto envíes tu comprobante confirmamos tu pedido.', archivo: '' },
    { id: 'r5', titulo: 'Horario', texto: 'Nuestro horario es de lunes a viernes de 9:00 a 18:00 y sábados de 10:00 a 14:00.', archivo: '' },
    { id: 'r6', titulo: 'Envíos', texto: 'Hacemos envíos a todo México. El costo depende del código postal; compárteme el tuyo y te lo cotizo.', archivo: '' },
    { id: 'r7', titulo: 'Tiempo de entrega', texto: 'Tu pedido llega de 3 a 5 días hábiles después de confirmar el pago.', archivo: '' },
    { id: 'r8', titulo: 'Rastreo', texto: 'Con tu número de guía puedes rastrear tu pedido en la página de la paquetería.', archivo: '' },
    { id: 'r9', titulo: 'Cambios y devoluciones', texto: 'Tienes 15 días para cambios. El producto debe estar sin usar y con su empaque original.', archivo: '' },
    { id: 'r10', titulo: 'Facturación', texto: 'Para tu factura envíame tu RFC, razón social, régimen fiscal, código postal y uso del CFDI.', archivo: '' },
    { id: 'r11', titulo: 'Mayoreo', texto: 'Para precios de mayoreo el pedido mínimo es de 12 piezas. ¿Qué productos te interesan?', archivo: '' },
    { id: 'r12', titulo: 'Pago en tienda', texto: 'También puedes pagar en efectivo en tiendas de conveniencia con la referencia que te envío.', archivo: '' },
    { id: 'r13', titulo: 'Seguimiento', texto: 'Hola, ¿pudiste revisar la información que te envié? Quedo pendiente por si tienes dudas.', archivo: '' },
    { id: 'r4', titulo: 'Despedida', texto: 'Fue un gusto atenderte. ¡Excelente día!', archivo: '' }
  ],

  // cuando: 'Por defecto' | 'Fuera de horario' | 'Palabras clave'. numero: null = todos los números.
  automaticos: [
    { id: 'a4', nombre: 'Número de pedido', numero: 'n1', cuando: 'Expresión regular', claves: '', regex: 'pedido\\s*#?\\d{4,6}', mensaje: 'Gracias, ya busco tu pedido. En unos minutos te confirmo su estado.', inicio: '', fin: '', activo: true },
    { id: 'a1', nombre: 'Fuera de horario', numero: 'n1', cuando: 'Fuera de horario', claves: '', coincidencia: '', mensaje: 'Gracias por escribir. Nuestro horario es de 9:00 a 18:00; en cuanto abramos te atendemos.', inicio: '', fin: '', activo: true },
    { id: 'a2', nombre: 'Bienvenida de octubre', numero: 'n2', cuando: 'Por defecto', claves: '', coincidencia: '', mensaje: '¡Hola! Para atenderte mejor compártenos tu nombre y ciudad.', inicio: '2026-10-01T00:00', fin: '2026-10-31T23:59', activo: true },
    { id: 'a3', nombre: 'Respuesta a "precio"', numero: null, cuando: 'Palabras clave', claves: 'precio, costo', mensaje: 'Nuestra lista de precios está en el catálogo. ¿Te lo envío?', inicio: '', fin: '', activo: false }
  ],

  bajas: [
    { tel: '+52 87 5550 1005', contacto: 'Raúl Medina', fecha: '2 oct 2026', origen: 'Botón', campana: 'Catálogo de otoño' },
    { tel: '+52 81 5550 2011', contacto: 'Sin nombre', fecha: '2 oct 2026', origen: 'Palabra BAJA', campana: 'Catálogo de otoño' },
    { tel: '+52 81 5550 2040', contacto: 'Norma Díaz', fecha: '28 sep 2026', origen: 'Manual', campana: '—' },
    { tel: '+52 84 5550 2093', contacto: 'Sin nombre', fecha: '2 oct 2026', origen: 'Rechazo de Meta', campana: 'Catálogo de otoño' }
  ],

  empresas: [
    { nombre: 'Aromas del Norte', estado: 'En prueba', plan: 'Prueba gratis', fin: '10 oct 2026', usuarios: 4, numeros: 2, alta: '3 oct 2026' },
    { nombre: 'Ferretería El Tornillo', estado: 'Activa', plan: 'Completo', fin: '—', usuarios: 12, numeros: 3, alta: '14 sep 2026' },
    { nombre: 'Boutique Carmín', estado: 'En pausa', plan: 'Sin paquete', fin: '30 sep 2026', usuarios: 3, numeros: 1, alta: '23 sep 2026' },
    { nombre: 'Clínica Dental Sonríe', estado: 'Activa', plan: 'Básico', fin: '—', usuarios: 5, numeros: 1, alta: '2 sep 2026' },
    { nombre: 'Autopartes Rivas', estado: 'Suspendida', plan: 'Básico', fin: '—', usuarios: 6, numeros: 2, alta: '11 ago 2026' }
  ],

  paquetes: [
    { nombre: 'Prueba gratis', conexion: 'Coexistencia y Cloud API', usuarios: 5, numeros: 2, campanas: 'Sí', precio: '7 días' },
    { nombre: 'Básico', conexion: 'Coexistencia', usuarios: 5, numeros: 1, campanas: 'No', precio: 'Por definir' },
    { nombre: 'Completo', conexion: 'Cloud API y coexistencia', usuarios: 20, numeros: 5, campanas: 'Sí', precio: 'Por definir' }
  ],

  reporte: {
    dias: [['Lun', 182, 160], ['Mar', 210, 195], ['Mié', 164, 150], ['Jue', 238, 221], ['Vie', 276, 240], ['Sáb', 120, 96], ['Dom', 64, 40]],
    agentes: [['Elena Garza', 48, 44, '3 min', '1 h 10 min'], ['Marco Ruiz', 62, 51, '6 min', '2 h 05 min'], ['Sofía Luna', 37, 30, '11 min', '3 h 40 min']],
    embudo: [['Nuevo', 420], ['En conversación', 268], ['Interesado', 141], ['Cliente', 73]]
  }
};
