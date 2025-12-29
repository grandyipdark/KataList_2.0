
import { CloudFile } from "../types";

declare var google: any;

// ID por defecto
const DEFAULT_CLIENT_ID = '472540050424-g4doacvt1pfe817tk9jtodcdcmfn62ui.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
const BACKUP_FILENAME = 'katalist_backup.json';

let accessToken: string | null = null;
let tokenClient: any = null;

export const driveService = {
    getClientId: () => localStorage.getItem('kata_drive_client_id') || DEFAULT_CLIENT_ID,
    
    setClientId: (id: string) => {
        localStorage.setItem('kata_drive_client_id', id);
        tokenClient = null; // Forzar reinicialización total
    },

    init: (onSuccess?: (token: string) => void, onError?: (err: any) => void): void => {
        if (typeof google === 'undefined' || !google.accounts) {
            console.error("Google SDK no cargado.");
            return;
        }

        try {
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: driveService.getClientId(),
                scope: SCOPES,
                callback: (response: any) => {
                    if (response.error) {
                        if (onError) onError(response);
                        return;
                    }
                    accessToken = response.access_token;
                    localStorage.setItem('kata_cloud_connected', 'true');
                    if (onSuccess) onSuccess(response.access_token);
                },
            });
        } catch (e) {
            console.error("Error inicializando cliente de Google", e);
        }
    },

    signIn: (): Promise<string> => {
        return new Promise((resolve, reject) => {
            // Aseguramos que el SDK esté disponible
            if (typeof google === 'undefined') {
                reject("Librería de Google no disponible. Reintenta en unos segundos.");
                return;
            }

            // Definimos el comportamiento de éxito/error antes de lanzar el popup
            const handleSuccess = (token: string) => resolve(token);
            const handleError = (err: any) => reject(err);

            // Si no existe el cliente o el Client ID cambió, reiniciamos
            if (!tokenClient) {
                driveService.init(handleSuccess, handleError);
            } else {
                // Actualizar callbacks para la sesión actual
                tokenClient.callback = (response: any) => {
                    if (response.access_token) {
                        accessToken = response.access_token;
                        localStorage.setItem('kata_cloud_connected', 'true');
                        resolve(response.access_token);
                    } else {
                        reject(response.error || "Permiso denegado.");
                    }
                };
            }

            // Lanzar el popup de Google
            try {
                tokenClient.requestAccessToken({ prompt: 'consent' });
            } catch (e) {
                reject("Fallo al abrir ventana de Google. Revisa bloqueadores de popups.");
            }
        });
    },

    logout: () => {
        if (accessToken && typeof google !== 'undefined') {
            google.accounts.oauth2.revoke(accessToken);
        }
        accessToken = null;
        tokenClient = null;
        localStorage.removeItem('kata_cloud_connected');
    },

    findBackupFile: async (): Promise<CloudFile | null> => {
        if (!accessToken) {
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
        
        if (!res.ok) throw new Error("Error en Google Drive");
        
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

        if (!res.ok) throw new Error("Error al subir archivo");
    },

    downloadBackup: async (fileId: string): Promise<string> => {
        if (!accessToken) await driveService.signIn();

        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!res.ok) throw new Error("Error al descargar backup");
        return await res.text();
    }
};
