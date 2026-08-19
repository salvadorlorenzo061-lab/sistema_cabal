import logoMembrete from '../img/4.jpeg';

export const agregarMembrete = (doc) => {
  doc.addImage(logoMembrete, 'JPEG', 14, 8, 20, 18, undefined, 'FAST');
};