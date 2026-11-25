"""Lee gráficas de R/ggplot exportadas a PDF vectorial y recupera sus datos (biblioteca).

La usan los guiones de extracción de cada figura (fuera del repositorio, con los datos).

Paneles: se deducen de la rejilla (líneas #ebebeb). Calibración: las líneas
mayores de la rejilla coinciden con las marcas de los ejes; las etiquetas
numéricas se emparejan con ellas (por orden, lo que también sirve para
etiquetas giradas). Cada panel tiene su propia escala si tiene sus propias
etiquetas; si no, toma las de su fila (eje Y) o su columna (eje X).
"""
import collections
import re

import pymupdf

REJILLA = "#ebebeb"


def hexa(c):
    return "#%02x%02x%02x" % tuple(round(v * 255) for v in c[:3]) if c else None


def numero(s):
    s = s.replace("−", "-").replace("%", "").replace(" ", "")
    if re.fullmatch(r"-?\d{1,3}(,\d{3})+", s):  # 206,209
        s = s.replace(",", "")
    s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


class Panel:
    def __init__(self, x0, x1, y0, y1, H, V):
        self.x0, self.x1, self.y0, self.y1 = x0, x1, y0, y1
        self.H, self.V = H, V  # líneas mayores: y de las horizontales, x de las verticales
        self.ax = self.ay = None

    def contiene(self, x, y, m=2):
        return self.x0 - m <= x <= self.x1 + m and self.y0 - m <= y <= self.y1 + m

    def dato(self, x, y):
        (a, b), (c, d) = self.ax, self.ay
        return a + b * x, c + d * y

    def __repr__(self):
        return f"Panel(x {self.x0:.0f}-{self.x1:.0f}, y {self.y0:.0f}-{self.y1:.0f}, {len(self.V)}V {len(self.H)}H)"


def ajuste(pares):
    """Recta mínimos cuadrados valor = a + b·coord."""
    n = len(pares)
    sx = sum(p for p, _ in pares); sy = sum(v for _, v in pares)
    sxx = sum(p * p for p, _ in pares); sxy = sum(p * v for p, v in pares)
    b = (n * sxy - sx * sy) / (n * sxx - sx * sx)
    return (sy - b * sx) / n, b


class Figura:
    def __init__(self, ruta, pagina=0):
        self.doc = pymupdf.open(ruta)
        self.p = self.doc[pagina]
        self.dibujos = self.p.get_drawings()
        self.palabras = self.p.get_text("words")
        self.paneles = self._paneles()

    # ---------------------------------------------------------------- rejilla
    def _rejilla(self):
        hs, vs = [], []
        for dr in self.dibujos:
            if dr.get("type") != "s" or hexa(dr.get("color")) != REJILLA:
                continue
            for it in dr["items"]:
                if it[0] != "l":
                    continue
                a, b = it[1], it[2]
                if abs(a.y - b.y) < 0.05:
                    hs.append((round(a.y, 2), round(min(a.x, b.x), 1), round(max(a.x, b.x), 1), round(dr["width"], 2)))
                elif abs(a.x - b.x) < 0.05:
                    vs.append((round(a.x, 2), round(min(a.y, b.y), 1), round(max(a.y, b.y), 1), round(dr["width"], 2)))
        return hs, vs

    def _paneles(self):
        hs, vs = self._rejilla()
        gruesoH = max((h[3] for h in hs), default=0)
        gruesoV = max((v[3] for v in vs), default=0)
        rx = sorted(set((h[1], h[2]) for h in hs))
        ry = sorted(set((v[1], v[2]) for v in vs))
        paneles = []
        for x0, x1 in rx:
            for y0, y1 in ry:
                H = sorted(set(h[0] for h in hs if (h[1], h[2]) == (x0, x1) and y0 - 1 <= h[0] <= y1 + 1 and h[3] == gruesoH))
                V = sorted(set(v[0] for v in vs if (v[1], v[2]) == (y0, y1) and x0 - 1 <= v[0] <= x1 + 1 and v[3] == gruesoV))
                if H and V:
                    paneles.append(Panel(x0, x1, y0, y1, H, V))
        # paneles sin rejilla vertical (p. ej., barras): solo horizontales
        for x0, x1 in rx:
            H = sorted(set(h[0] for h in hs if (h[1], h[2]) == (x0, x1) and h[3] == gruesoH))
            if H and not any(pn.x0 == x0 and pn.x1 == x1 and pn.y0 - 1 <= H[0] <= pn.y1 + 1 for pn in paneles):
                paneles.append(Panel(x0, x1, H[0], H[-1], H, []))
        paneles.sort(key=lambda pn: (round(pn.y0), pn.x0))
        return paneles

    # ---------------------------------------------------------- calibración
    def etiquetas_y(self, panel, x_max=None):
        """Números a la izquierda del panel, alineados con sus líneas horizontales."""
        x_max = panel.x0 if x_max is None else x_max
        out = []
        for w in self.palabras:
            v = numero(w[4])
            yc = (w[1] + w[3]) / 2
            if v is not None and w[2] <= x_max + 1 and panel.y0 - 8 <= yc <= panel.y1 + 8 and w[2] > x_max - 60:
                out.append((yc, v, w))
        return out

    def etiquetas_x(self, panel, y_min=None, alto=45):
        y_min = panel.y1 if y_min is None else y_min
        out = []
        for w in self.palabras:
            v = numero(w[4])
            xc = (w[0] + w[2]) / 2
            if v is not None and y_min - 1 <= w[1] <= y_min + alto and panel.x0 - 12 <= xc <= panel.x1 + 12:
                out.append((xc, v, w))
        return out

    def calibrar(self, panel, ys=None, xs=None, valores_y=None, valores_x=None):
        """Empareja líneas mayores y etiquetas por orden. Se pueden dar los valores a mano."""
        if panel.H:
            if valores_y is None:
                ys = ys if ys is not None else self.etiquetas_y(panel)
                valores_y = [v for _, v, _ in sorted(ys)]  # de arriba a abajo
            H = panel.H
            if len(valores_y) != len(H):
                raise ValueError(f"{panel}: {len(H)} líneas H y {len(valores_y)} etiquetas Y {valores_y}")
            panel.ay = ajuste(list(zip(H, valores_y)))
        if panel.V:
            if valores_x is None:
                xs = xs if xs is not None else self.etiquetas_x(panel)
                valores_x = [v for _, v, _ in sorted(xs)]
            V = panel.V
            if len(valores_x) != len(V):
                raise ValueError(f"{panel}: {len(V)} líneas V y {len(valores_x)} etiquetas X {valores_x}")
            panel.ax = ajuste(list(zip(V, valores_x)))
        return panel

    # --------------------------------------------------------------- series
    def trazos(self, panel, color=None, tipo="s"):
        """Polilíneas dentro del panel: [{color, ancho, guiones, puntos[(x,y) datos]}]."""
        out = []
        for dr in self.dibujos:
            c = hexa(dr.get("color") if tipo == "s" else dr.get("fill"))
            if dr.get("type") != tipo or c in (REJILLA, "#ffffff", None):
                continue
            if color and c != color:
                continue
            pts = []
            for it in dr["items"]:
                if it[0] == "l":
                    for q in (it[1], it[2]):
                        if not pts or (abs(pts[-1].x - q.x) > 1e-6 or abs(pts[-1].y - q.y) > 1e-6):
                            pts.append(q)
            pts = [q for q in pts if panel.contiene(q.x, q.y)]
            if len(pts) >= 2:
                out.append({"color": c, "ancho": round(dr.get("width") or 0, 2), "guiones": dr.get("dashes"),
                            "pdf": [(q.x, q.y) for q in pts],
                            "puntos": [panel.dato(q.x, q.y) for q in pts] if panel.ax and panel.ay else None})
        return out

    def marcadores(self, panel, color=None):
        """Círculos (puntos de las series): centro en datos."""
        out = []
        for dr in self.dibujos:
            if not any(it[0] == "c" for it in dr["items"]):
                continue
            c = hexa(dr.get("fill"))
            if color and c != color:
                continue
            r = dr["rect"]
            x, y = (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2
            if panel.contiene(x, y) and r.width < 12:
                out.append({"color": c, "pdf": (x, y), "dato": panel.dato(x, y) if panel.ax and panel.ay else None})
        return out

    def rectangulos(self, panel=None, color=None):
        out = []
        for dr in self.dibujos:
            if dr.get("type") != "f":
                continue
            c = hexa(dr.get("fill"))
            if c in ("#ffffff", None) or (color and c != color):
                continue
            for it in dr["items"]:
                if it[0] == "re":
                    r = it[1]
                    if panel is None or panel.contiene((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, m=6):
                        out.append({"color": c, "pdf": (r.x0, r.y0, r.x1, r.y1)})
        return out

    def textos(self, caja=None):
        ws = self.palabras
        if caja:
            x0, y0, x1, y1 = caja
            ws = [w for w in ws if x0 <= (w[0] + w[2]) / 2 <= x1 and y0 <= (w[1] + w[3]) / 2 <= y1]
        return ws


def por_x(puntos, xs, tol=0.02):
    """Valor de una polilínea en cada x pedido (interpolación lineal)."""
    pts = sorted(puntos)
    out = {}
    for x in xs:
        for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
            if xa - tol <= x <= xb + tol and xb > xa:
                t = min(1, max(0, (x - xa) / (xb - xa)))
                out[x] = ya + t * (yb - ya)
                break
    return out
