import { CloudFile } from "../types";

declare var google: any;

const CLIENT_ID = '472540050424-g4doacvt1pfe817tk9jtodcdcmfn62ui.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
const BACKUP_FILENAME = 'katalist_backup.json';

// Simple in-memory token storage
let accessToken: string | null = null;

export const driveService = {
    // 1. Initialize & Login
    signIn: (): Promise<string> => {
        return new Promise((resolve, reject) => {
            try {
                if (typeof google === 'undefined') {
                    reject("Google API no cargada. Revisa tu conexión.");
                    return;
                }

                const client = google.accounts.oauth2.initTokenClient({
                    client_id: CLIENT_ID,
                    scope: SCOPES,
                    callback: (response: any) => {
                        if (response.access_token) {
                            accessToken = response.access_token;
                            resolve(response.access_token);
                        } else {
                            reject("No se obtuvo token de acceso.");
                        }
                    },
                });
                client.requestAccessToken();
            } catch (e) {
                reject(e);
            }
        });
    },

    isAuthenticated: () => !!accessToken,

    // 2. Find Backup File in AppDataFolder
    findBackupFile: async (): Promise<CloudFile | null> => {
        if (!accessToken) throw new Error("No conectado a Drive.");

        const query = `name = '${BACKUP_FILENAME}' and 'appDataFolder' in parents and trashed = false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime)&spaces=appDataFolder`;

        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        if (!res.ok) throw new Error("Error buscando archivo.");
        
        const data = await res.json();
        if (data.files && data.files.length > 0) {
            return data.files[0];
        }
        return null;
    },

    // 3. Upload (Create or Update)
    uploadBackup: async (jsonContent: string): Promise<void> => {
        if (!accessToken) throw new Error("No conectado a Drive.");

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

        if (!res.ok) throw new Error("Error subiendo archivo.");
    },

    // 4. Download
    downloadBackup: async (fileId: string): Promise<string> => {
        if (!accessToken) throw new Error("No conectado a Drive.");

        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!res.ok) throw new Error("Error descargando archivo.");
        return await res.text();
    }
};