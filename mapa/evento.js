/* ==========================================================================
   Labs Summit 2026 · Datos del mapa del 29 de octubre
   --------------------------------------------------------------------------
   Este es el ÚNICO archivo que hay que tocar para cambiar textos, horarios
   o charlas. El mapa lo vuelve a leer cada 90 segundos, así que un cambio
   publicado le llega a todos sin recargar.

   La distribución sigue el «Mapa recorrido evento» oficial (Taquilla e
   ingreso → Zona Cowork → Labs Session, Stands, Gastrolabs y Caja de Arena).

   - Horas en formato 24 h, hora de Colombia (ej. '14:30').
   - "zona" en la agenda debe ser uno de los id de la lista de zonas.
   - El orden de la lista de zonas es también su importancia en el mapa
     (si dos nombres se tapan, se muestra el que va primero).
   - "confirmar: true" marca lo que aún está pendiente de confirmar con
     logística; se ve con ?dev=1 en la URL.
   ========================================================================== */
window.LS_EVENTO = {
  version: '2026-10-21.1',
  fecha: '2026-10-29',
  abre: '08:00',
  cierra: '19:00',
  sede: 'Coliseo de Ferias Manuel Victoria Rojas · Tuluá',

  // Mientras sea true, la agenda muestra el aviso «Horarios de ejemplo».
  agendaDeEjemplo: true,

  tipos: {
    charlas:      { nombre: 'Charlas',      color: '#A855F7' },
    marcas:       { nombre: 'Marcas',       color: '#E879F9' },
    experiencias: { nombre: 'Experiencias', color: '#22D3EE' },
    comida:       { nombre: 'Comida',       color: '#F59E0B' },
    servicios:    { nombre: 'Servicios',    color: '#C9AEFF' }
  },

  zonas: [
    { id: 'auditorio', nombre: 'Caja de Arena', corto: 'Caja de Arena', tipo: 'charlas', lugar: 'Escenario principal',
      foto: '/mapa/img/auditorio.jpg',
      texto: 'El escenario principal: aquí son las conferencias del día. Ingreso VIP y General por el costado norte; Diamante y Black tienen su propio ingreso.' },
    { id: 'gastrolabs', nombre: 'Zona Gastrolabs', corto: 'Gastrolabs', tipo: 'comida', lugar: 'Plaza central',
      foto: '/mapa/img/cafe.jpg',
      texto: 'La plaza de comida: puestos gastronómicos, mesas y un lugar para descansar entre charlas.' },
    { id: 'expositores', nombre: 'Zona de stands', corto: 'Stands', tipo: 'marcas', lugar: 'Pabellón norte',
      foto: '/mapa/img/expositores.jpg',
      texto: 'Stands de patrocinadores y marcas aliadas. Al fondo del pabellón está la entrega de kits.' },
    { id: 'workshops', nombre: 'Labs Session', corto: 'Labs Session', tipo: 'charlas', lugar: 'Junto a la Zona Cowork',
      foto: '/mapa/img/workshops.jpg', confirmar: true,
      texto: 'Sesiones prácticas en grupos pequeños. Llega 5 minutos antes: el cupo es por orden de llegada.' },
    { id: 'cowork', nombre: 'Zona Cowork', corto: 'Cowork', tipo: 'experiencias', lugar: 'Centro del recorrido',
      texto: 'Mesas para trabajar, conectarte y hacer networking entre charlas.' },
    { id: 'taquillas', nombre: 'Taquilla e ingreso', corto: 'Ingreso', tipo: 'servicios', lugar: 'Entrada peatonal, costado occidental',
      foto: '/mapa/img/taquillas.jpg',
      texto: 'Validación de boletas y entrega de manillas. Ten tu QR de compra a mano.' },
    { id: 'kits', nombre: 'Entrega de kits', corto: 'Kits', tipo: 'servicios', lugar: 'Al fondo de la Zona de stands', confirmar: true,
      texto: 'Reclama aquí tu kit de asistente con tu QR de compra.' },
    { id: 'speakers', nombre: 'P1 · Zona speakers', corto: 'Speakers', tipo: 'experiencias', lugar: 'Frente a la Zona de stands', confirmar: true,
      texto: 'Espacio de los speakers del evento.' },
    { id: 'bebidas', nombre: 'P2 · Zona de bebidas', corto: 'Bebidas', tipo: 'comida', lugar: 'Frente a la Zona de stands',
      texto: 'Bebidas frías y calientes durante todo el día.' },
    { id: 'banos', nombre: 'Baños 1', corto: 'Baños 1', tipo: 'servicios', lugar: 'Costado norte', menor: true,
      texto: 'Baños para asistentes, junto al muro norte.' },
    { id: 'banos2', nombre: 'Baños 2', corto: 'Baños 2', tipo: 'servicios', lugar: 'Junto a la Caja de Arena', menor: true,
      texto: 'Baños para asistentes, al lado del ingreso a la Caja de Arena.' },
    { id: 'parqueo', nombre: 'Zona de parqueo', corto: 'Parqueo', tipo: 'servicios', lugar: 'Ingreso vehicular, esquina sur-occidental',
      texto: 'Parqueadero del evento. Los carros entran por el ingreso vehicular; desde ahí caminas a la taquilla.' }
  ],

  // Zonas sin charlas: horario en que están abiertas.
  horarios: {
    gastrolabs:  ['08:00', '19:00'],
    expositores: ['08:00', '19:00'],
    cowork:      ['08:00', '19:00'],
    taquillas:   ['07:00', '14:00'],
    kits:        ['07:00', '14:00'],
    speakers:    ['08:00', '19:00'],
    bebidas:     ['08:00', '19:00'],
    banos:       ['07:00', '19:30'],
    banos2:      ['07:00', '19:30'],
    parqueo:     ['06:30', '20:00']
  },

  // Códigos de los QR impresos: labssummit.com/mapa?p=<código>
  // x, z = dónde está pegado el cartel en el modelo (metros aproximados).
  puntos: {
    entrada:    { zona: 'taquillas',   x: -62, z: -7,    nombre: 'Entrada peatonal' },
    taquillas:  { zona: 'taquillas',   x: -50, z: -7,    nombre: 'Taquilla' },
    cowork:     { zona: 'cowork',      x: -9.4, z: -1,   nombre: 'Zona Cowork' },
    labs:       { zona: 'workshops',   x: -28, z: -15,   nombre: 'Labs Session' },
    stands:     { zona: 'expositores', x: 5.3, z: -28.5, nombre: 'Zona de stands' },
    kits:       { zona: 'kits',        x: 5.3, z: -48.5, nombre: 'Entrega de kits' },
    gastrolabs: { zona: 'gastrolabs',  x: 23,  z: -7,    nombre: 'Zona Gastrolabs' },
    vip:        { zona: 'auditorio',   x: 23,  z: 6.5,   nombre: 'Ingreso VIP y General' },
    diamante:   { zona: 'auditorio',   x: 40,  z: 6.5,   nombre: 'Ingreso Diamante y Black' },
    banos:      { zona: 'banos',       x: -27.6, z: -42, nombre: 'Baños 1' },
    banos2:     { zona: 'banos2',      x: 62,  z: 9.5,   nombre: 'Baños 2' },
    parqueo:    { zona: 'parqueo',     x: -46, z: 40,    nombre: 'Ingreso vehicular' }
  },

  // Agenda del 29. Mientras agendaDeEjemplo sea true son horarios de ejemplo.
  agenda: [
    { zona: 'auditorio', inicio: '09:30', fin: '10:00', titulo: 'Apertura oficial Labs Summit 2026' },
    { zona: 'auditorio', inicio: '10:00', fin: '10:40', titulo: 'Ecommerce en Colombia: lo que viene' },
    { zona: 'auditorio', inicio: '10:50', fin: '11:30', titulo: 'IA aplicada a ventas' },
    { zona: 'auditorio', inicio: '11:40', fin: '12:20', titulo: 'Meta Ads que sí venden' },
    { zona: 'auditorio', inicio: '12:20', fin: '13:30', titulo: 'Pausa de almuerzo', pausa: true },
    { zona: 'auditorio', inicio: '13:30', fin: '14:10', titulo: 'Marca personal para vender más' },
    { zona: 'auditorio', inicio: '14:20', fin: '15:00', titulo: 'Conversión: más ventas con el mismo tráfico' },
    { zona: 'auditorio', inicio: '15:10', fin: '15:50', titulo: 'Dropshipping en LATAM' },
    { zona: 'auditorio', inicio: '16:00', fin: '16:40', titulo: 'Retención y suscripciones' },
    { zona: 'auditorio', inicio: '16:50', fin: '17:40', titulo: 'Panel de fundadores' },
    { zona: 'auditorio', inicio: '17:40', fin: '18:00', titulo: 'Cierre del día' },

    { zona: 'workshops', inicio: '10:30', fin: '11:30', titulo: 'Automatiza tu negocio con IA' },
    { zona: 'workshops', inicio: '11:45', fin: '12:45', titulo: 'Tu primera tienda online en una hora' },
    { zona: 'workshops', inicio: '14:00', fin: '15:00', titulo: 'Embudos de venta por WhatsApp' },
    { zona: 'workshops', inicio: '15:15', fin: '16:15', titulo: 'Contenido que convierte' }
  ]
};
