
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

    // Reconexión automática al iniciar
    useEffect(() => {
        const wasConnected = localStorage.getItem('kata_cloud_connected') === 'true';
        if (wasConnected) {
            // Intentar verificar conexión silenciosamente
            driveService.findBackupFile()
                .then(file => {
                    setIsCloudConnected(true);
                    if (file) setCloudLastSync(new Date(file.modifiedTime).toLocaleString());
                })
                .catch(() => {
                    // Si falla (token expirado), no forzamos login pero marcamos como desconectado visualmente
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
            
            // Buscar backup inmediatamente tras conectar
            const file = await driveService.findBackupFile();
            if (file) {
                setCloudLastSync(new Date(file.modifiedTime).toLocaleString());
                showToast("Copia de seguridad encontrada", 'info');
            }
        } catch (e: any) {
            console.error(e);
            setIsCloudConnected(false);
            const msg = typeof e === 'string' && e.includes('popup_closed') 
                ? "Ventana cerrada por el usuario" 
                : "Error de conexión. Verifica el dominio.";
            showToast(msg, 'error');
        } finally {
            setIsSyncing('idle');
        }
    }, [showToast]);

    const uploadToCloud = useCallback(async () => {
        if (isSyncing !== 'idle') return;
        setIsSyncing('uploading');
        try {
            const data = await exportData(true);
            // Validar tamaño aproximado (Drive AppData tiene límites razonables, pero JS puede sufrir con strings gigantes)
            if (data.length > 50 * 1024 * 1024) {
                showToast("Base de datos muy grande. Puede tardar...", "info");
            }
            
            await driveService.uploadBackup(data);
            setCloudLastSync(new Date().toLocaleString());
            showToast("Backup subido exitosamente", 'success');
        } catch (e: any) {
            console.error(e);
            if (e.message === "AUTH_EXPIRED") {
                showToast("Sesión expirada. Reconectando...", "info");
                await connectCloud();
            } else {
                showToast("Error al subir. Intenta de nuevo.", 'error');
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
                showToast("No se encontró ningún archivo en la nube", 'error');
                return;
            }
            
            const json = await driveService.downloadBackup(file.id);
            const success = await importData(json);
            
            if (success) {
                setCloudLastSync(new Date(file.modifiedTime).toLocaleString());
                showToast("Sincronización completada", 'success');
            } else {
                showToast("El archivo de la nube no es válido", 'error');
            }
        } catch (e: any) {
            console.error(e);
            showToast("Error al restaurar datos.", 'error');
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
