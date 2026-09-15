import 'server-only';
import { google } from 'googleapis';
import { Readable } from 'node:stream';

const ALCANCES = [
  'https://www.googleapis.com/auth/spreadsheets',
  // «drive.file» sólo alcanza a los archivos que la propia aplicación creó.
  // Aquí hay que escribir dentro de carpetas que ya existen y que alguien
  // compartió con la cuenta de servicio, y para eso no basta: Drive responde
  // que la carpeta no existe. El permiso real lo sigue poniendo Drive, no
  // este alcance: la cuenta llega hasta donde la hayan invitado.
  'https://www.googleapis.com/auth/drive',
];

export function googleConfigurado(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
}

function autenticar() {
  const correo = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const clave = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!correo || !clave) {
    throw new Error('Faltan GOOGLE_SERVICE_ACCOUNT_EMAIL o GOOGLE_PRIVATE_KEY.');
  }
  return new google.auth.JWT({ email: correo, key: clave, scopes: ALCANCES });
}

/**
 * Las tres carpetas de Drive donde caen los archivos del registro.
 *
 * Van separadas porque se consultan por separado: quien arma el programa
 * abre las semblanzas, quien recibe a los invitados abre los boletos. Los
 * identificadores están aquí y no en el .env porque son de este congreso,
 * como las fechas o la sede, y cambiarlos sin cambiar el código sólo
 * serviría para que los archivos acabaran en un sitio que nadie mira.
 */
export const CARPETAS_DRIVE = {
  fotografia: '1iSSqGuRwYD7Ns5om5mJlZDR-0Zo5VXJ_',
  semblanza:  '11xxzTrzVb_Lfub-jrdIsrlYmezQoBBNn',
  boleto:     '1Sxv7ayAiKTLz_5coOVYzvqg0-USeLugD',
} as const;

export type CarpetaDrive = keyof typeof CARPETAS_DRIVE;

/** Sube un archivo a la carpeta que le toca y devuelve su enlace. */
export async function subirArchivoADrive(
  archivo: { nombre: string; tipo: string; contenido: Buffer; carpeta?: CarpetaDrive },
): Promise<{ id: string; url: string }> {
  const drive = google.drive({ version: 'v3', auth: autenticar() });
  const carpeta = archivo.carpeta
    ? CARPETAS_DRIVE[archivo.carpeta]
    : process.env.GOOGLE_DRIVE_FOLDER_ID;

  const creado = await drive.files.create({
    requestBody: {
      name: archivo.nombre,
      ...(carpeta ? { parents: [carpeta] } : {}),
    },
    media: { mimeType: archivo.tipo, body: Readable.from(archivo.contenido) },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  });

  const id = creado.data.id!;
  return { id, url: creado.data.webViewLink ?? `https://drive.google.com/file/d/${id}/view` };
}

export async function eliminarArchivoDeDrive(id: string): Promise<void> {
  const drive = google.drive({ version: 'v3', auth: autenticar() });
  await drive.files.delete({ fileId: id, supportsAllDrives: true });
}

export function clienteSheets() {
  return google.sheets({ version: 'v4', auth: autenticar() });
}
