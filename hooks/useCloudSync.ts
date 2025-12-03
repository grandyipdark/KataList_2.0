import { useState, useCallback } from 'react';
import { driveService } from '../services/driveService';

export const useCloudSync = (
    showToast: (msg: string, type: 'success' | 'error' | 'info') => void,
    exportData: (includeImages: boolean) => Promise<string>,
    importData: (json: string) => Promise<boolean>
) => {
    const [isCloudConnected, setIsCloudConnected] = useState(false);
    const [cloudLastSync, setCloudLastSync] = useState<string | null>(null);

    const connectCloud = useCallback(async () => {
        try {
            await driveService.signIn();
            setIsCloudConnected(true);
            showToast("Conectado a Google Drive", 'success');
            // Try to check if backup exists immediately
            try {
                const file = await driveService.findBackupFile();
                if (file) {
                    setCloudLastSync(new Date(file.modifiedTime).toLocaleString());
                    showToast("Copia encontrada en la nube", 'info');
                }
            } catch (e) {
                // Silent fail on check
            }
        } catch (e) {
            console.error(e);
            showToast("Error al conectar con Google", 'error');
        }
    }, [showToast]);

    const uploadToCloud = useCallback(async () => {
        if (!isCloudConnected) return showToast("No conectado a Drive", 'error');
        showToast("Subiendo backup...", 'info');
        try {
            const data = await exportData(true);
            await driveService.uploadBackup(data);
            setCloudLastSync(new Date().toLocaleString());
            showToast("Backup subido exitosamente", 'success');
        } catch (e) {
            console.error(e);
            showToast("Error al subir backup", 'error');
        }
    }, [isCloudConnected, exportData, showToast]);

    const downloadFromCloud = useCallback(async () => {
        if (!isCloudConnected) return showToast("No conectado a Drive", 'error');
        showToast("Buscando backup...", 'info');
        try {
            const file = await driveService.findBackupFile();
            if (!file) return showToast("No hay backup en la nube", 'error');
            
            showToast("Descargando...", 'info');
            const json = await driveService.downloadBackup(file.id);
            
            const success = await importData(json);
            if (success) {
                setCloudLastSync(new Date(file.modifiedTime).toLocaleString());
                showToast("Restauración completada", 'success');
            } else {
                showToast("Archivo corrupto", 'error');
            }
        } catch (e) {
            console.error(e);
            showToast("Error al restaurar", 'error');
        }
    }, [isCloudConnected, importData, showToast]);

    return {
        isCloudConnected,
        cloudLastSync,
        connectCloud,
        uploadToCloud,
        downloadFromCloud
    };
};