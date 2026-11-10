import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * El aforo presencial queda en 100. Lo delicado no es el número sino que siga siendo del panel:
 * `actualizar-convocatoria.sql` corre en cada despliegue, y una orden que reescriba el cupo sin
 * una marca lo devolvería a su valor cada vez que el comité lo cambie desde el panel.
 */
const esquema = readFileSync('basedatos/esquema.sql', 'utf8');
const migracion = readFileSync('basedatos/actualizar-convocatoria.sql', 'utf8');
const sinComentarios = (sql: string) =>
  sql.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n');

describe('aforo presencial: 100 personas', () => {
  it('la base nueva nace con 100', () => {
    expect(esquema).toMatch(/\('cupos_presenciales', '100'::jsonb,/);
  });

  it('la migración lo pone en 100 una sola vez, con marca', () => {
    const sql = sinComentarios(migracion);
    expect(sql).toMatch(/if not exists \(select 1 from configuracion where clave = 'migracion_cupo_presencial_100'\)/);
    expect(sql).toMatch(/update configuracion set valor = '100'::jsonb where clave = 'cupos_presenciales';/);
    expect(sql).toMatch(/insert into configuracion \(clave, valor, descripcion\)\s+values \('migracion_cupo_presencial_100'/);
  });

  it('ninguna orden suelta reescribe el cupo en cada despliegue', () => {
    // Todas las escrituras de `cupos_presenciales` deben estar dentro del bloque con marca.
    const fuera = sinComentarios(migracion).replace(/do \$cupo\$[\s\S]*?\$cupo\$;/, '');
    expect(fuera).not.toMatch(/cupos_presenciales/);
  });
});
