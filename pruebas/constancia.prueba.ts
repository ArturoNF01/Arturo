import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { diccionarios } from '@/i18n';
import { FAQS } from '@/i18n/faqs';

vi.mock('@/lib/bd/conexion', () => ({
  unaFila: async () => null,
  consultar: async () => [],
}));
vi.mock('@/lib/servidor/contenido', () => ({ leerEjes: async () => ({ filas: [] }) }));

const { variablesDeRegistro } = await import('@/lib/servidor/correo');

/**
 * La constancia exige registrarse y asistir a todas las sesiones. Es lo que más gente se
 * pierde —el enlace de Zoom y el de Meet están a la vista y cualquiera puede entrar sin
 * registrarse—, así que el requisito tiene que decirse igual en todos los sitios donde se
 * decide o se recuerda: la agenda, el registro, la confirmación, el correo y las preguntas
 * frecuentes. Estas pruebas no vigilan la redacción, vigilan que el requisito siga ahí.
 */
const REQUISITO = {
  es: { registro: /registr/i, sesiones: /todas las sesiones/i },
  en: { registro: /register/i, sesiones: /all the (Congress )?sessions/i },
  pt: { registro: /inscrev|inscrit/i, sesiones: /todas as sessões/i },
} as const;
const IDIOMAS = ['es', 'en', 'pt'] as const;

describe('el aviso de la constancia', () => {
  it('existe en los tres idiomas y dice que hay que registrarse y asistir a todas las sesiones', () => {
    for (const idioma of IDIOMAS) {
      const c = diccionarios[idioma].constancia;
      for (const clave of ['titulo', 'texto', 'recordatorio', 'ir'] as const) {
        expect(c[clave].trim().length, `${idioma}.${clave}`).toBeGreaterThan(3);
      }
      for (const texto of [c.texto, c.recordatorio]) {
        expect(texto, idioma).toMatch(REQUISITO[idioma].registro);
        expect(texto, idioma).toMatch(REQUISITO[idioma].sesiones);
      }
    }
  });

  it('antes de registrarse avisa que entrar a Zoom o a Meet sin registro no da constancia', () => {
    for (const idioma of IDIOMAS) {
      const { texto } = diccionarios[idioma].constancia;
      expect(texto, idioma).toMatch(/Zoom/);
      expect(texto, idioma).toMatch(/Meet/);
    }
  });

  it('la pregunta frecuente de la constancia (respaldo en código) lo dice en los tres idiomas', () => {
    for (const idioma of IDIOMAS) {
      const faq = FAQS[idioma].find((f) => f.id === 'constancia')!;
      expect(faq.respuesta, idioma).toMatch(REQUISITO[idioma].registro);
      expect(faq.respuesta, idioma).toMatch(REQUISITO[idioma].sesiones);
    }
  });
});

describe('el acuse por correo', () => {
  const variables = (idioma: string, programaPublicado: boolean) =>
    variablesDeRegistro({
      clave: 'confirmacion_registro',
      registro: { folio: 'REG-1', nombres: 'Ana', apellidos: 'Ruiz', correo: 'a@b.org', idioma, perfil: 'publico_general', modalidad: 'en_linea' },
      correoContacto: 'congreso@ciess.org',
      fechaLimite: '',
      urlAgenda: 'https://ejemplo.org/agenda',
      programaPublicado,
    });

  it('lleva el recordatorio de la constancia en el idioma del registro, con la agenda publicada o no', () => {
    for (const idioma of IDIOMAS) {
      for (const publicada of [true, false]) {
        const bloque = variables(idioma, publicada).constancia_bloque;
        expect(bloque, `${idioma} ${publicada}`).toContain(diccionarios[idioma].constancia.recordatorio);
        expect(bloque).toContain(diccionarios[idioma].constancia.titulo);
      }
    }
  });
});

describe('lo que se siembra y se migra', () => {
  const esquema = readFileSync('basedatos/esquema.sql', 'utf8');
  const migracion = readFileSync('basedatos/actualizar-convocatoria.sql', 'utf8');

  it('las plantillas de confirmación y de registro confirmado llevan el bloque, delante de la agenda', () => {
    const ocurrencias = esquema.match(/\{\{constancia_bloque\}\}\n\{\{agenda_bloque\}\}/g) ?? [];
    expect(ocurrencias).toHaveLength(6); // dos plantillas × tres idiomas
  });

  it('la migración añade el bloque una sola vez, con marca, para respetar lo que el panel quite', () => {
    expect(migracion).toContain("'migracion_constancia_bloque'");
    expect(migracion).toMatch(/if not exists \(select 1 from configuracion where clave = 'migracion_constancia_bloque'\)/);
  });

  it('ninguna migración borra, vacía ni elimina la tabla de registros', () => {
    // La garantía que más importa: desplegar nunca puede costar un registro. Los guiones que
    // sí borran (limpiar-registros.sh) son manuales y no están en estos archivos.
    for (const [nombre, sql] of [['esquema.sql', esquema], ['actualizar-convocatoria.sql', migracion]]) {
      const sinComentarios = sql.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n');
      expect(sinComentarios, nombre).not.toMatch(/delete\s+from\s+registros/i);
      expect(sinComentarios, nombre).not.toMatch(/truncate\s+(table\s+)?registros/i);
      expect(sinComentarios, nombre).not.toMatch(/drop\s+table\s+(if\s+exists\s+)?registros/i);
    }
  });
});
