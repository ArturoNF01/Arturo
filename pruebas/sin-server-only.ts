/**
 * Reemplazo de `server-only` durante las pruebas.
 *
 * Ese paquete existe para que un módulo de servidor no acabe en el navegador
 * por descuido, y lo consigue lanzando un error al importarse fuera del
 * servidor. Las pruebas corren en Node, donde esa protección sobra y sólo
 * estorba, así que se sustituye por un módulo vacío.
 */
export {};
