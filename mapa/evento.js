/* ==========================================================================
   Labs Summit 2026 · Datos del mapa del 29 de octubre
   --------------------------------------------------------------------------
   Este es el ÚNICO archivo que hay que tocar para cambiar textos, horarios
   o charlas. El mapa lo vuelve a leer cada 90 segundos, así que un cambio
   publicado le llega a todos sin recargar.

   - Horas en formato 24 h, hora de Colombia (ej. '14:30').
   - "zona" en la agenda debe ser uno de los id de la lista de zonas.
   - "confirmar: true" marca lo que aún está pendiente de confirmar con
     logística; se ve con ?dev=1 en la URL.
   ========================================================================== */
window.LS_EVENTO = {
  version: '2026-10-20.1',
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
    { id: 'auditorio', nombre: 'Auditorio principal', corto: 'Auditorio', tipo: 'charlas', lugar: 'Pabellón 1',
      foto: '/mapa/img/auditorio.jpg',
      texto: 'Escenario central con cuatro pantallas. Aquí son las conferencias principales del día.' },
    { id: 'expositores', nombre: 'Zona Expositores', corto: 'Expositores', tipo: 'marcas', lugar: 'Plaza de los samanes',
      foto: '/mapa/img/expositores.jpg',
      texto: 'Stands de patrocinadores y zona de networking bajo los samanes.' },
    { id: 'marcas', nombre: 'Pabellón de marcas', corto: 'Pabellón 2', tipo: 'marcas', lugar: 'Pabellón 2',
      foto: '/mapa/img/marcas.jpg',
      texto: 'Stands de marcas aliadas, lounge con DJ y el set del podcast.' },
    { id: 'podcast', nombre: 'Podcast Studio', corto: 'Podcast', tipo: 'experiencias', lugar: 'Dentro del Pabellón 2',
      foto: '/mapa/img/podcast.jpg',
      texto: 'Entrevistas en vivo con speakers. Puedes verlas de pie frente al set.' },
    { id: 'workshops', nombre: 'Zona de workshops', corto: 'Workshops', tipo: 'charlas', lugar: 'Cubierta norte',
      foto: '/mapa/img/workshops.jpg', confirmar: true,
      texto: 'Talleres prácticos en grupos pequeños. Llega 5 minutos antes: el cupo es por orden de llegada.' },
    { id: 'foto', nombre: 'Zona fotográfica', corto: 'Foto', tipo: 'experiencias', lugar: 'Bajo el samán, junto al restaurante',
      foto: '/mapa/img/foto.jpg',
      texto: 'El escenario de flores y letras LABS SUMMIT para tu foto del evento.' },
    { id: 'cafe', nombre: 'Café y restaurante', corto: 'Café', tipo: 'comida', lugar: 'Edificio del restaurante',
      foto: '/mapa/img/cafe.jpg',
      texto: 'Café, almuerzo y snacks en la terraza.' },
    { id: 'info', nombre: 'Punto de información', corto: 'Info', tipo: 'servicios', lugar: 'Extremo occidental de la plaza',
      texto: 'Ayuda, objetos perdidos, mapa impreso y agenda del día.' },
    { id: 'taquillas', nombre: 'Taquillas y entrada', corto: 'Entrada', tipo: 'servicios', lugar: 'Alameda de ingreso',
      foto: '/mapa/img/taquillas.jpg', confirmar: true,
      texto: 'Validación de boletas y entrega de manillas. Ten tu QR de compra a mano.' },
    { id: 'banos', nombre: 'Baños', corto: 'Baños', tipo: 'servicios', lugar: 'Junto al restaurante', confirmar: true,
      texto: 'Baños para asistentes.' },
    { id: 'camerinos', nombre: 'Camerinos', corto: 'Camerinos', tipo: 'servicios', lugar: 'Edificio del restaurante',
      privado: true,
      texto: 'Zona de speakers y staff. No es de acceso al público.' }
  ],

  // Zonas sin charlas: horario en que están abiertas.
  horarios: {
    expositores: ['08:00', '19:00'],
    marcas:      ['08:00', '19:00'],
    foto:        ['08:00', '19:00'],
    cafe:        ['07:30', '19:00'],
    info:        ['07:30', '19:30'],
    taquillas:   ['07:00', '14:00'],
    banos:       ['07:00', '19:30']
  },

  // Códigos de los QR impresos: labssummit.com/mapa?p=<código>
  // x, z = dónde está pegado el cartel en el modelo (metros aproximados).
  puntos: {
    entrada:   { zona: 'taquillas',   x: -74, z: 70, nombre: 'Entrada principal' },
    taquillas: { zona: 'taquillas',   x: -74, z: 63, nombre: 'Taquillas' },
    stands:    { zona: 'expositores', x: 10,  z: 6,  nombre: 'Zona Expositores' },
    auditorio: { zona: 'auditorio',   x: 0,   z: -20, nombre: 'Puerta del auditorio' },
    workshops: { zona: 'workshops',   x: -67, z: -25, nombre: 'Zona de workshops' },
    podcast:   { zona: 'podcast',     x: 68,  z: 20, nombre: 'Podcast Studio' },
    cafe:      { zona: 'cafe',        x: 26,  z: 31, nombre: 'Café y restaurante' },
    foto:      { zona: 'foto',        x: 28,  z: 1,  nombre: 'Zona fotográfica' },
    banos:     { zona: 'banos',       x: 15,  z: 24, nombre: 'Baños' }
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
    { zona: 'workshops', inicio: '15:15', fin: '16:15', titulo: 'Contenido que convierte' },

    { zona: 'podcast', inicio: '10:00', fin: '10:45', titulo: 'Entrevista en vivo con un speaker' },
    { zona: 'podcast', inicio: '11:30', fin: '12:15', titulo: 'Historias de fundadores' },
    { zona: 'podcast', inicio: '14:30', fin: '15:15', titulo: 'Ideas que venden' },
    { zona: 'podcast', inicio: '16:00', fin: '16:45', titulo: 'Preguntas del público' },

    { zona: 'marcas', inicio: '12:30', fin: '13:30', titulo: 'Lounge: DJ set y networking' },
    { zona: 'marcas', inicio: '17:45', fin: '19:00', titulo: 'Lounge: networking de cierre' }
  ]
};
