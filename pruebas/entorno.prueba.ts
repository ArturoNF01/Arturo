import { describe, it, expect } from 'vitest';
import { leerEnv } from '../guiones/entorno';

describe('leer el .env desde un guion', () => {
  it('conserva la llave privada entera, con sus espacios', () => {
    // Es el caso que dejaba la hoja vacía: pasar esto por la línea de
    // órdenes lo parte en «-----BEGIN», «PRIVATE», «KEY-----».
    const llave = '-----BEGIN PRIVATE KEY-----\\nMIIEvQ==\\n-----END PRIVATE KEY-----\\n';
    const env = leerEnv(`GOOGLE_PRIVATE_KEY="${llave}"`);
    expect(env.GOOGLE_PRIVATE_KEY).toBe(llave);
  });

  it('quita las comillas de los dos tipos y sólo cuando envuelven', () => {
    const env = leerEnv(["A=\"uno\"", "B='dos'", 'C=tres', 'D="cuatro'].join('\n'));
    expect(env).toMatchObject({ A: 'uno', B: 'dos', C: 'tres', D: '"cuatro' });
  });

  it('respeta los «=» del valor: una contraseña no se corta', () => {
    const env = leerEnv('DATABASE_URL=postgres://u:cl=ve@localhost/bd');
    expect(env.DATABASE_URL).toBe('postgres://u:cl=ve@localhost/bd');
  });

  it('salta comentarios y líneas sueltas', () => {
    const env = leerEnv(['# nota', '', 'A=1', '=huérfano', 'B=2'].join('\n'));
    expect(Object.keys(env).sort()).toEqual(['A', 'B']);
  });
});
