/**
 * Un texto del diccionario con partes en negritas, marcadas con dos asteriscos:
 * «es requisito **registrarse** y…».
 *
 * Los textos de la interfaz son cadenas planas y los usa también el correo, donde
 * no hay componentes; esto permite resaltar una palabra en pantalla sin partir
 * la frase en tres claves por idioma. Sólo se marca donde se pinta con
 * `partirNegritas`: un texto que va tal cual a un correo no debe llevar asteriscos.
 */
export interface Tramo {
  texto: string;
  negrita: boolean;
}

export function partirNegritas(texto: string): Tramo[] {
  // Con un grupo de captura, `split` deja lo marcado en los lugares impares.
  return texto
    .split(/\*\*(.+?)\*\*/)
    .map((parte, i) => ({ texto: parte, negrita: i % 2 === 1 }))
    .filter((tramo) => tramo.texto !== '');
}
