import { WebContainer } from '@webcontainer/api';

let webContainerInstance = null;


export const getWebcontainer = async () => {
    if (webContainerInstance === null) {
        webContainerInstance = await WebContainer.boot();
    }
    return webContainerInstance;
}