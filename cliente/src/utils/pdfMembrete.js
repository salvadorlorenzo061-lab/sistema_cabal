import logoMembrete from '../img/1.png';

export const agregarMembrete = (doc) => {
  doc.addImage(logoMembrete, 'PNG', 14, 8, 20, 18, undefined, 'FAST');
};