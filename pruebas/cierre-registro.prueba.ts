import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * El registro al congreso se cierra al terminar el evento. Lo delicado no es cerrarlo sino que siga siendo del panel:
 * `actualizar-convocatoria.sql` corre en cada despliegue, y una orden suelta lo volvería a cerrar cada vez que el comité
 * lo abra desde Cupos y configuración.
 */
const migracion = readFileSync('basedatos/actualizar-convocatoria.sql', 'utf8');
const sinComentarios = (sql: string) =>
  sql.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n');

describe('cierre del registro', () => {
  it('la migración lo cierra una sola vez, con marca', () => {
    const sql = sinComentarios(migracion);
    expect(sql).toMatch(/if not exists \(select 1 from configuracion where clave = 'migracion_registro_cerrado_fin_congreso'\)/);
    expect(sql).toMatch(/update configuracion set valor = 'false'::jsonb where clave = 'registro_abierto';/);
    expect(sql).toMatch(/insert into configuracion \(clave, valor, descripcion\)\s+values \('migracion_registro_cerrado_fin_congreso'/);
  });

  it('ninguna orden suelta toca el interruptor en cada despliegue', () => {
    const fuera = sinComentarios(migracion).replace(/do \$cierre\$[\s\S]*?\$cierre\$;/, '');
    expect(fuera).not.toMatch(/registro_abierto/);
  });
});
