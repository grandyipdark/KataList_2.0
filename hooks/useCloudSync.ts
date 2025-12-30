
import { useState, useCallback, useEffect } from 'react';
import { driveService } from '../services/driveService';
import { Tasting } from '../types';

export const useCloudSync = (
    showToast: (msg: string, type: 'success' | 'error' | 'info') => void,
    exportData: (includeImages: boolean) => Promise<string>,
    importData: (json: string) => Promise<boolean>,
    localTastings: Tasting[]
) => {
    const [isCloudConnected, setIsCloudConnected] = useState(false);
    const [cloudLastSync, setCloudLastSync] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState<'idle' | 'connecting' | 'uploading' | 'downloading' | 'syncing'>('idle');

    const connectCloud = useCallback(async () => {
        setIsSyncing('connecting');
        try {
            await driveService.signIn();
            const file = await driveService.findBackupFile();
            setIsCloudConnected(true);
            showToast("Conectado a Google Drive", 'success');
            if (file) {
                setCloudLastSync(new Date(file.modifiedTime).toLocaleString());
            }
        } catch (e: any) {
            setIsCloudConnected(false);
            if (e.message === "API_DRIVE_DISABLED") {
                showToast("Falta activar 'Google Drive API' en la consola", 'error');
            } else {
                showToast("Error de conexión", 'error');
            }
        } finally {
            setIsSyncing('idle');
        }
    }, [showToast]);

    useEffect(() => {
        const wasConnected = localStorage.getItem('kata_cloud_connected') === 'true';
        if (wasConnected) {
            driveService.findBackupFile()
                .then(file => {
                    setIsCloudConnected(true);
                    if (file) setCloudLastSync(new Date(file.modifiedTime).toLocaleString());
                })
                .catch(() => {});
        }
    }, []);

    const uploadToCloud = useCallback(async (force: boolean = false) => {
        if (isSyncing !== 'idle') return;
        setIsSyncing('uploading');
        try {
            // 1. Verificar si existe un archivo y comparar conteo
            const file = await driveService.findBackupFile();
            if (file && !force) {
                const remoteJson = await driveService.downloadBackup(file.id);
                const remoteData = JSON.parse(remoteJson);
                const remoteCount = remoteData.tastings?.length || 0;
                const localCount = localTastings.length;

                if (remoteCount > localCount) {
                    setIsSyncing('idle');
                    return { conflict: true, remoteCount, localCount };
                }
            }

            // 2. Proceder con la subida
            const data = await exportData(true);
            await driveService.uploadBackup(data);
            setCloudLastSync(new Date().toLocaleString());
            showToast("Respaldo actualizado", 'success');
            return { success: true };
        } catch (e: any) {
            showToast("Error al subir datos", 'error');
            return { error: true };
        } finally {
            setIsSyncing('idle');
        }
    }, [isSyncing, exportData, showToast, localTastings]);

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
                showToast("Datos fusionados con éxito", 'success');
            }
        } catch (e) {
            showToast("Error al descargar", 'error');
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
