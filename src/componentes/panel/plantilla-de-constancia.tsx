'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/componentes/proveedores';
import { IDIOMAS, diccionarios, interpolar, type Idioma } from '@/i18n';

interface PlantillaGuardada { clave: string; idioma: Idioma; asunto: string; cuerpo_html: string; activa: boolean }

/**
 * El correo de la constancia a la vista en la propia pantalla del envío: su asunto y cómo se ve, en cada idioma, con el botón
 * y un enlace de muestra. Así quien va a enviar ve lo que va a llegar sin tener que ir a buscarlo a otra sección. Si falta la
 * plantilla en algún idioma lo dice con todas sus letras: sin ella el envío no se puede crear.
 *
 * La vista previa la arma el servidor con el mismo código del envío (la misma de «Plantillas de correo»), no se imita aquí.
 */
export function PlantillaDeConstancia() {
  const { t, idioma: idiomaDelPanel } = useApp();
  const k = t.panel.constancias;
  const [plantillas, setPlantillas] = useState<PlantillaGuardada[] | null>(null);
  const [fallo, setFallo] = useState(false);
  const [idioma, setIdioma] = useState<Idioma>(idiomaDelPanel);
  // La vista previa lleva el idioma para el que se armó: al cambiar de idioma no se enseña la del anterior mientras llega la nueva.
  const [armado, setArmado] = useState<{ idioma: Idioma; asunto: string; html: string } | null>(null);

  useEffect(() => {
    let vigente = true;
    void fetch('/api/plantillas', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((filas: PlantillaGuardada[]) => { if (vigente) setPlantillas(filas.filter((f) => f.clave === 'constancia')); })
      .catch(() => { if (vigente) setFallo(true); });
    return () => { vigente = false; };
  }, []);

  const actual = plantillas?.find((p) => p.idioma === idioma);
  useEffect(() => {
    if (!actual) return;
    let vigente = true;
    void fetch('/api/plantillas/vista-previa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clave: 'constancia', idioma, asunto: actual.asunto, cuerpo_html: actual.cuerpo_html }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((datos: { asunto: string; html: string } | null) => { if (vigente && datos) setArmado({ idioma, ...datos }); })
      .catch(() => undefined);
    return () => { vigente = false; };
  }, [actual, idioma]);

  const vista = armado?.idioma === idioma ? armado : null;
  const faltan = plantillas ? IDIOMAS.filter((i) => !plantillas.some((p) => p.idioma === i && p.activa)) : [];

  return (
    <section className="tarjeta mt-4 p-4" aria-labelledby="constancias-plantilla">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="constancias-plantilla" className="text-base font-bold">{k.plantillaTitulo}</h2>
        <div className="flex gap-2">
          {IDIOMAS.map((codigo) => (
            <button
              key={codigo}
              type="button"
              onClick={() => setIdioma(codigo)}
              aria-pressed={idioma === codigo}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium uppercase transition ${idioma === codigo ? 'bg-ciess-500 text-white' : 'boton-secundario'}`}
            >
              {diccionarios[codigo].meta.bandera} {codigo}
            </button>
          ))}
        </div>
      </div>

      {fallo && <p className="mt-3 text-sm text-red-500" role="alert">{k.plantillaNoCargo}</p>}
      {plantillas && faltan.length > 0 && (
        <p className="mt-3 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-600" role="alert">
          {interpolar(k.plantillaFalta, { idiomas: faltan.join(', ') })}
        </p>
      )}

      {actual ? (
        <>
          <p className="mt-3 rounded-lg border p-2.5 text-sm font-medium" style={{ borderColor: 'var(--borde)' }}>
            {vista?.asunto ?? actual.asunto}
          </p>
          {/* Un iframe sin permisos: el HTML del correo no ejecuta nada ni toca el panel, y conserva sus propios estilos. */}
          <iframe
            title={k.plantillaTitulo}
            sandbox=""
            srcDoc={vista?.html ?? ''}
            className="mt-3 h-[36rem] w-full rounded-lg border bg-white"
            style={{ borderColor: 'var(--borde)' }}
          />
          <p className="ayuda">{k.plantillaNota}</p>
        </>
      ) : (
        plantillas && <p className="ayuda mt-3">{interpolar(k.plantillaSinEsta, { idioma })}</p>
      )}
      <a href="/panel/plantillas" className="mt-2 inline-block text-sm underline">{k.editarTexto}</a>
    </section>
  );
}
