import { redirect } from 'next/navigation';

/** La presentación vive en la raíz; esta ruta sólo redirige por comodidad. */
export default function Inicio() {
  redirect('/');
}
