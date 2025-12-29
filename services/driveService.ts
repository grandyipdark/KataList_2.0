
import { CloudFile } from "../types";

declare var google: any;

// Credenciales vinculadas al proyecto KataList
const CLIENT_ID = '472540050424-g4doacvt1pfe817tk9jtodcdcmfn62ui.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
const BACKUP_FILENAME = 'katalist_backup.json';

let accessToken: string | null = null;
let tokenClient: any = null;

export const driveService = {
    // Inicializar el cliente de Google Identity Services
    init: (): Promise<void> => {
        return new Promise((resolve, reject) => {
            if (typeof google === 'undefined') {
                reject("Google API no detectada. Revisa tu conexión a internet.");
                return;
            }

            try {
                tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: CLIENT_ID,
                    scope: SCOPES,
                    callback: (response: any) => {
                        if (response.error) {
                            reject(response.error);
                            return;
                        }
                        accessToken = response.access_token;
                        // Guardamos una bandera de "conectado" pero no el token (por seguridad y expiración)
                        localStorage.setItem('kata_cloud_connected', 'true');
                        resolve();
                    },
                });
                resolve();
            } catch (e) {
                reject(e);
            }
        });
    },

    signIn: (): Promise<string> => {
        return new Promise((resolve, reject) => {
            if (!tokenClient) {
                driveService.init().then(() => {
                    tokenClient.requestAccessToken({ prompt: 'consent' });
                }).catch(reject);
            } else {
                // Si ya tenemos tokenClient, pedimos acceso
                tokenClient.callback = (response: any) => {
                    if (response.access_token) {
                        accessToken = response.access_token;
                        localStorage.setItem('kata_cloud_connected', 'true');
                        resolve(response.access_token);
                    } else {
                        reject("Permiso denegado por el usuario.");
                    }
                };
                tokenClient.requestAccessToken();
            }
        });
    },

    logout: () => {
        accessToken = null;
        localStorage.removeItem('kata_cloud_connected');
    },

    isAuthenticated: () => !!accessToken,

    findBackupFile: async (): Promise<CloudFile | null> => {
        if (!accessToken) {
            // Intento de re-autenticación silenciosa si la bandera existe
            if (localStorage.getItem('kata_cloud_connected')) {
                await driveService.signIn();
            } else {
                throw new Error("AUTH_REQUIRED");
            }
        }

        const query = `name = '${BACKUP_FILENAME}' and 'appDataFolder' in parents and trashed = false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime)&spaces=appDataFolder`;

        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        if (res.status === 401) {
            accessToken = null;
            throw new Error("AUTH_EXPIRED");
        }
        
        if (!res.ok) throw new Error("Error al buscar en Drive.");
        
        const data = await res.json();
        return (data.files && data.files.length > 0) ? data.files[0] : null;
    },

    uploadBackup: async (jsonContent: string): Promise<void> => {
        if (!accessToken) await driveService.signIn();

        const existingFile = await driveService.findBackupFile();
        const fileMetadata = {
            name: BACKUP_FILENAME,
            parents: existingFile ? [] : ['appDataFolder']
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
        form.append('file', new Blob([jsonContent], { type: 'application/json' }));

        let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
        let method = 'POST';

        if (existingFile) {
            url = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`;
            method = 'PATCH';
        }

        const res = await fetch(url, {
            method: method,
            headers: { Authorization: `Bearer ${accessToken}` },
            body: form
        });

        if (!res.ok) throw new Error("Fallo al subir el archivo.");
    },

    downloadBackup: async (fileId: string): Promise<string> => {
        if (!accessToken) await driveService.signIn();

        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!res.ok) throw new Error("Fallo al descargar el archivo.");
        return await res.text();
    }
};
