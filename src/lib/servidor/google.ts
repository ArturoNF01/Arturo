import 'server-only';
import { google } from 'googleapis';
import { Readable } from 'node:stream';

const ALCANCES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
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

/** Sube un archivo a la carpeta de Drive del congreso y devuelve su enlace. */
export async function subirArchivoADrive(
  archivo: { nombre: string; tipo: string; contenido: Buffer },
): Promise<{ id: string; url: string }> {
  const drive = google.drive({ version: 'v3', auth: autenticar() });
  const carpeta = process.env.GOOGLE_DRIVE_FOLDER_ID;

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
