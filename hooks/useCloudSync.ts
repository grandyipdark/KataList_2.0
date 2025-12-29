
import { useState, useCallback, useEffect } from 'react';
import { driveService } from '../services/driveService';

export const useCloudSync = (
    showToast: (msg: string, type: 'success' | 'error' | 'info') => void,
    exportData: (includeImages: boolean) => Promise<string>,
    importData: (json: string) => Promise<boolean>
) => {
    const [isCloudConnected, setIsCloudConnected] = useState(false);
    const [cloudLastSync, setCloudLastSync] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState<'idle' | 'connecting' | 'uploading' | 'downloading'>('idle');

    useEffect(() => {
        const wasConnected = localStorage.getItem('kata_cloud_connected') === 'true';
        if (wasConnected) {
            driveService.findBackupFile()
                .then(file => {
                    setIsCloudConnected(true);
                    if (file) setCloudLastSync(new Date(file.modifiedTime).toLocaleString());
                })
                .catch(() => {
                    setIsCloudConnected(false);
                });
        }
    }, []);

    const connectCloud = useCallback(async () => {
        setIsSyncing('connecting');
        try {
            await driveService.signIn();
            setIsCloudConnected(true);
            showToast("Conectado a Google Drive", 'success');
            
            const file = await driveService.findBackupFile();
            if (file) {
                setCloudLastSync(new Date(file.modifiedTime).toLocaleString());
                showToast("Copia de seguridad encontrada", 'info');
            }
        } catch (e: any) {
            console.error("Cloud Connection Error:", e);
            setIsCloudConnected(false);
            // Mostrar el mensaje de error real que viene del servicio
            const errorMsg = typeof e === 'string' ? e : (e.error || "Error de conexión");
            showToast(errorMsg, 'error');
        } finally {
            setIsSyncing('idle');
        }
    }, [showToast]);

    const uploadToCloud = useCallback(async () => {
        if (isSyncing !== 'idle') return;
        setIsSyncing('uploading');
        try {
            const data = await exportData(true);
            if (data.length > 50 * 1024 * 1024) {
                showToast("Base de datos pesada. Sincronizando...", "info");
            }
            
            await driveService.uploadBackup(data);
            setCloudLastSync(new Date().toLocaleString());
            showToast("Copia de seguridad subida", 'success');
        } catch (e: any) {
            console.error(e);
            if (e.message === "AUTH_EXPIRED") {
                showToast("Sesión caducada. Reconectando...", "info");
                await connectCloud();
            } else {
                showToast("Fallo al subir datos", 'error');
            }
        } finally {
            setIsSyncing('idle');
        }
    }, [isSyncing, exportData, showToast, connectCloud]);

    const downloadFromCloud = useCallback(async () => {
        if (isSyncing !== 'idle') return;
        setIsSyncing('downloading');
        try {
            const file = await driveService.findBackupFile();
            if (!file) {
                showToast("No hay archivos en la nube", 'error');
                return;
            }
            
            const json = await driveService.downloadBackup(file.id);
            const success = await importData(json);
            
            if (success) {
                setCloudLastSync(new Date(file.modifiedTime).toLocaleString());
                showToast("Restauración completada", 'success');
            } else {
                showToast("Archivo corrupto o inválido", 'error');
            }
        } catch (e: any) {
            console.error(e);
            showToast("Error al descargar datos.", 'error');
        } finally {
            setIsSyncing('idle');
        }
    }, [isSyncing, importData, showToast]);

    return {
        isCloudConnected,
        cloudLastSync,
        isSyncing,
        connectCloud,
        uploadToCloud,
        downloadFromCloud
    };
};
