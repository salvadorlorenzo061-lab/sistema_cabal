import logoMembrete from '../img/4.jpeg';

export const agregarMembrete = (doc) => {
  doc.addImage(logoMembrete, 'JPEG', 14, 9, 18, 16, undefined, 'FAST');
};

export const escribirLineaMembrete = (doc, texto, y, opciones = {}) => {
  const { x = 36, maxWidth = 90, minFontSize = 6.5 } = opciones;
  let fontSize = opciones.fontSize || doc.getFontSize();

  doc.setFontSize(fontSize);
  while (fontSize > minFontSize && doc.getTextWidth(texto) > maxWidth) {
    fontSize -= 0.25;
    doc.setFontSize(fontSize);
  }

  doc.text(texto, x, y);
};