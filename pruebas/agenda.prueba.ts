import { describe, expect, it } from 'vitest';
import { urlAgendaSegunIdioma } from '@/lib/agenda';

const GENERAL = 'https://ejemplo.org/Agenda.pdf';
const PT = 'https://ejemplo.org/Programa_PT.pdf';
const EN = 'https://ejemplo.org/Programa_EN.pdf';

describe('la agenda según el idioma', () => {
  it('en portugués da la versión en portugués', () => {
    expect(urlAgendaSegunIdioma({ general: GENERAL, pt: PT }, 'pt')).toBe(PT);
  });

  it('en inglés da la versión en inglés, y cada idioma la suya', () => {
    const urls = { general: GENERAL, pt: PT, en: EN };
    expect(urlAgendaSegunIdioma(urls, 'en')).toBe(EN);
    expect(urlAgendaSegunIdioma(urls, 'pt')).toBe(PT);
    expect(urlAgendaSegunIdioma(urls, 'es')).toBe(GENERAL);
  });

  it('sin versión en inglés, el inglés cae a la general', () => {
    expect(urlAgendaSegunIdioma({ general: GENERAL, pt: PT }, 'en')).toBe(GENERAL);
    expect(urlAgendaSegunIdioma({ general: GENERAL, pt: PT, en: '' }, 'en')).toBe(GENERAL);
  });

  it('si la versión en portugués está vacía o no existe, cae a la general', () => {
    expect(urlAgendaSegunIdioma({ general: GENERAL, pt: '' }, 'pt')).toBe(GENERAL);
    expect(urlAgendaSegunIdioma({ general: GENERAL }, 'pt')).toBe(GENERAL);
    expect(urlAgendaSegunIdioma({ general: GENERAL, pt: null }, 'pt')).toBe(GENERAL);
  });

  it('un idioma desconocido no rompe nada', () => {
    expect(urlAgendaSegunIdioma({ general: GENERAL, pt: PT }, 'fr')).toBe(GENERAL);
  });
});
