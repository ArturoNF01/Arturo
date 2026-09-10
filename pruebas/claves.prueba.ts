import { describe, expect, it } from 'vitest';
import { cifrarClave, claveCoincide, generarToken, huellaToken } from '@/lib/bd/claves';

describe('contraseñas del panel', () => {
  it('acepta la contraseña correcta y rechaza cualquier otra', async () => {
    const hash = await cifrarClave('una contraseña larga de verdad');
    expect(await claveCoincide('una contraseña larga de verdad', hash)).toBe(true);
    expect(await claveCoincide('una contraseña larga de verdaD', hash)).toBe(false);
    expect(await claveCoincide('', hash)).toBe(false);
  });

  it('dos veces la misma contraseña da hashes distintos', async () => {
    const a = await cifrarClave('la misma contraseña');
    const b = await cifrarClave('la misma contraseña');
    // La sal es distinta cada vez: dos cuentas con igual contraseña no se
    // delatan mirando la tabla.
    expect(a).not.toBe(b);
    expect(await claveCoincide('la misma contraseña', a)).toBe(true);
    expect(await claveCoincide('la misma contraseña', b)).toBe(true);
  });

  it('el hash lleva dentro sus parámetros', async () => {
    const hash = await cifrarClave('contraseña de prueba');
    const [algoritmo, n, r, p] = hash.split('$');
    expect(algoritmo).toBe('scrypt');
    expect(Number(n)).toBeGreaterThanOrEqual(16_384);
    expect(Number(r)).toBe(8);
    expect(Number(p)).toBe(1);
  });

  it('una cuenta sin contraseña no entra con nada', async () => {
    expect(await claveCoincide('lo que sea', null)).toBe(false);
    expect(await claveCoincide('', null)).toBe(false);
  });

  it('un hash corrupto no rompe ni deja pasar', async () => {
    for (const roto of ['', 'scrypt$', 'bcrypt$1$2$3$4$5', 'scrypt$a$b$c$d$e']) {
      expect(await claveCoincide('cualquiera', roto)).toBe(false);
    }
  });
});

describe('testigos de sesión', () => {
  it('cada testigo es distinto y suficientemente largo', () => {
    const testigos = new Set(Array.from({ length: 50 }, () => generarToken()));
    expect(testigos.size).toBe(50);
    for (const t of testigos) expect(t.length).toBeGreaterThanOrEqual(40);
  });

  it('la huella es estable y no devuelve el testigo', () => {
    const token = generarToken();
    expect(huellaToken(token)).toBe(huellaToken(token));
    expect(huellaToken(token)).not.toContain(token);
    expect(huellaToken(token)).toHaveLength(64);
  });
});
