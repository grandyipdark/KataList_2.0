
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
        accessToken = null;
    },

    init: (onSuccess: (token: string) => void, onError: (err: any) => void): void => {
        if (typeof google === 'undefined' || !google.accounts) {
            onError("SDK de Google no cargado.");
            return;
        }

        try {
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: driveService.getClientId(),
                scope: SCOPES,
                callback: (response: any) => {
                    if (response.error) {
                        onError(response.error);
                        return;
                    }
                    accessToken = response.access_token;
                    localStorage.setItem('kata_cloud_connected', 'true');
                    onSuccess(response.access_token);
                },
            });
        } catch (e) {
            onError("ID de Cliente inválido");
        }
    },

    signIn: (): Promise<string> => {
        return new Promise((resolve, reject) => {
            if (typeof google === 'undefined') return reject("Librería Google no lista");

            // Si ya tenemos token, intentamos usarlo
            if (accessToken) return resolve(accessToken);

            driveService.init(
                (token) => resolve(token),
                (err) => reject(err)
            );

            if (tokenClient) {
                try {
                    tokenClient.requestAccessToken({ prompt: 'consent' });
                } catch (e) {
                    reject("Fallo al abrir ventana.");
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
        if (!accessToken) throw new Error("AUTH_REQUIRED");

        const query = `name = '${BACKUP_FILENAME}' and 'appDataFolder' in parents and trashed = false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime)&spaces=appDataFolder`;

        try {
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            
            if (res.status === 403) {
                throw new Error("API_DRIVE_DISABLED");
            }
            
            if (res.status === 401) {
                accessToken = null;
                throw new Error("AUTH_EXPIRED");
            }
            
            if (!res.ok) throw new Error("FETCH_ERROR");
            
            const data = await res.json();
            return (data.files && data.files.length > 0) ? data.files[0] : null;
        } catch (e: any) {
            throw e;
        }
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

        if (!res.ok) throw new Error("UPLOAD_FAILED");
    },

    downloadBackup: async (fileId: string): Promise<string> => {
        if (!accessToken) await driveService.signIn();

        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!res.ok) throw new Error("DOWNLOAD_FAILED");
        return await res.text();
    }
};
