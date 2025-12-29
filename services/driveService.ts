
import { CloudFile } from "../types";

declare var google: any;

const DEFAULT_CLIENT_ID = '472540050424-g4doacvt1pfe817tk9jtodcdcmfn62ui.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
const BACKUP_FILENAME = 'katalist_backup.json';

let accessToken: string | null = null;
let tokenClient: any = null;

export const driveService = {
    getClientId: () => localStorage.getItem('kata_drive_client_id') || DEFAULT_CLIENT_ID,
    
    setClientId: (id: string) => {
        localStorage.setItem('kata_drive_client_id', id);
        tokenClient = null; 
    },

    init: (onSuccess: (token: string) => void, onError: (err: any) => void): void => {
        if (typeof google === 'undefined' || !google.accounts) {
            onError("SDK de Google no cargado. Reintenta en 5 segundos.");
            return;
        }

        try {
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: driveService.getClientId(),
                scope: SCOPES,
                callback: (response: any) => {
                    if (response.error) {
                        onError(response);
                        return;
                    }
                    accessToken = response.access_token;
                    localStorage.setItem('kata_cloud_connected', 'true');
                    onSuccess(response.access_token);
                },
            });
        } catch (e) {
            onError("Error de configuración: " + (e instanceof Error ? e.message : "ID inválido"));
        }
    },

    signIn: (): Promise<string> => {
        return new Promise((resolve, reject) => {
            if (typeof google === 'undefined') {
                reject("Librería de Google no disponible.");
                return;
            }

            const handleResponse = (response: any) => {
                if (response.access_token) {
                    accessToken = response.access_token;
                    localStorage.setItem('kata_cloud_connected', 'true');
                    resolve(response.access_token);
                } else {
                    // Mapeo de errores comunes de Google
                    const error = response.error || "unknown";
                    if (error === 'popup_closed_by_user') reject("Ventana cerrada");
                    else if (error === 'access_denied') reject("Acceso denegado por el usuario");
                    else reject(`Google Error: ${error}`);
                }
            };

            const handleError = (err: any) => {
                const msg = typeof err === 'object' ? (err.error || JSON.stringify(err)) : err;
                reject(msg);
            };

            // Re-inicializar siempre para asegurar que los callbacks de la promesa actual sean los correctos
            driveService.init(
                (token) => resolve(token),
                handleError
            );

            if (tokenClient) {
                try {
                    tokenClient.requestAccessToken({ prompt: 'consent' });
                } catch (e) {
                    reject("Error al lanzar popup.");
                }
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
