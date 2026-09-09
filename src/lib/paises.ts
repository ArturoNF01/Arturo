/**
 * Normalización de nombres de país escritos libremente en el formulario
 * (español, inglés o portugués) al código numérico ISO 3166-1, que es el que
 * usa el atlas topológico del mapa. Cubre el continente americano y los
 * países de origen más frecuentes; lo no reconocido se cuenta aparte.
 */
const ALIAS: Record<string, string> = {
  // América del Norte
  mexico: '484', méxico: '484', mexique: '484',
  'estados unidos': '840', 'estados unidos de america': '840', eua: '840', eeuu: '840',
  'united states': '840', usa: '840', us: '840', 'u.s.a.': '840',
  canada: '124', canadá: '124',
  // Centroamérica y Caribe
  guatemala: '320', belice: '084', belize: '084', 'el salvador': '222', honduras: '340',
  nicaragua: '558', 'costa rica': '188', panama: '591', panamá: '591',
  cuba: '192', 'republica dominicana': '214', 'república dominicana': '214',
  'dominican republic': '214', haiti: '332', haití: '332',
  jamaica: '388', 'trinidad y tobago': '780', 'trinidad and tobago': '780',
  bahamas: '044', barbados: '052', 'puerto rico': '630',
  // América del Sur
  colombia: '170', venezuela: '862', ecuador: '218', peru: '604', perú: '604',
  bolivia: '068', brasil: '076', brazil: '076', chile: '152',
  argentina: '032', uruguay: '858', paraguay: '600', guyana: '328', surinam: '740',
  suriname: '740',
  // Europa y otros
  espana: '724', españa: '724', spain: '724', portugal: '620',
  francia: '250', france: '250', alemania: '276', germany: '276',
  'reino unido': '826', 'united kingdom': '826', italia: '380', italy: '380',
  belgica: '056', bélgica: '056', suiza: '756', switzerland: '756',
  'paises bajos': '528', 'países bajos': '528', netherlands: '528',
  japon: '392', japón: '392', japan: '392', china: '156',
  india: '356', australia: '036', marruecos: '504', morocco: '504',
};

const NOMBRES: Record<string, string> = {
  '484': 'México', '840': 'Estados Unidos', '124': 'Canadá', '320': 'Guatemala',
  '084': 'Belice', '222': 'El Salvador', '340': 'Honduras', '558': 'Nicaragua',
  '188': 'Costa Rica', '591': 'Panamá', '192': 'Cuba', '214': 'República Dominicana',
  '332': 'Haití', '388': 'Jamaica', '780': 'Trinidad y Tobago', '044': 'Bahamas',
  '052': 'Barbados', '630': 'Puerto Rico', '170': 'Colombia', '862': 'Venezuela',
  '218': 'Ecuador', '604': 'Perú', '068': 'Bolivia', '076': 'Brasil', '152': 'Chile',
  '032': 'Argentina', '858': 'Uruguay', '600': 'Paraguay', '328': 'Guyana',
  '740': 'Surinam', '724': 'España', '620': 'Portugal', '250': 'Francia',
  '276': 'Alemania', '826': 'Reino Unido', '380': 'Italia', '056': 'Bélgica',
  '756': 'Suiza', '528': 'Países Bajos', '392': 'Japón', '156': 'China',
  '356': 'India', '036': 'Australia', '504': 'Marruecos',
};

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Código ISO numérico del país escrito por la persona, o null. */
export function codigoPais(nombre: string | null | undefined): string | null {
  if (!nombre) return null;
  const limpio = normalizar(nombre);
  if (ALIAS[limpio]) return ALIAS[limpio];
  // Búsqueda tolerante: «Ciudad de México, México» o «Brasil (SP)».
  for (const [alias, codigo] of Object.entries(ALIAS)) {
    if (limpio.includes(alias)) return codigo;
  }
  return null;
}

export function nombrePais(codigo: string): string {
  return NOMBRES[codigo] ?? codigo;
}
