"""Estado de cada cambio aprobado (datos/cambios-aprobados.json) frente a un manuscrito.

Para cada cambio de ese DOCX dice si el manuscrito todavía trae el texto
original (PENDIENTE: hay que aplicarlo al maquetar), si ya trae el nuevo
(YA INCORPORADO) o si no trae ninguno de los dos (EL TEXTO CAMBIÓ: revisar a mano).
Con --anotar guarda ese estado en el JSON («estado_docx_nuevo» y «aplicar»).

Uso: python guiones/estado_cambios.py insumos/capitulo-1.docx [--anotar]
"""
import argparse
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from auditar_texto import leer_docx, norm  # noqa: E402

RUTA = pathlib.Path(__file__).resolve().parent.parent / "datos" / "cambios-aprobados.json"


def estado(c, unidades):
    if "añadido" in c:
        return "YA INCORPORADO" if any(norm(c["añadido"]) in u for u in unidades) else "PENDIENTE"
    o, n = norm(c["original"]), norm(c["nuevo"])
    if c.get("exacto"):
        ho, hn = sum(u == o for u in unidades), sum(u == n for u in unidades)
    else:
        hn = sum(u.count(n) for u in unidades)
        ho = sum(u.count(o) for u in unidades) - (hn if o in n else 0)
    if ho and not hn:
        return "PENDIENTE"
    if hn and not ho:
        return "YA INCORPORADO"
    if ho and hn:
        return "MIXTO"
    return "EL TEXTO CAMBIÓ"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("docx")
    ap.add_argument("--anotar", action="store_true")
    a = ap.parse_args()
    p, notas, celdas = leer_docx(a.docx)
    unidades = p + notas + celdas
    D = json.loads(RUTA.read_text(encoding="utf-8"))
    nombre = pathlib.Path(a.docx).name
    for c in D["cambios"]:
        if c["docx"] != nombre:
            continue
        e = estado(c, unidades)
        txt = c.get("añadido") or f"{c['original']} → {c['nuevo']}"
        print(f"{e:16} {txt[:110]}")
        if a.anotar:
            c["estado_docx_nuevo"] = e.lower()
            c["aplicar"] = e in ("PENDIENTE", "MIXTO")
    if a.anotar:
        RUTA.write_text(json.dumps(D, ensure_ascii=False, indent=1), encoding="utf-8")
        print("->", RUTA)


if __name__ == "__main__":
    main()
