const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Legacy asset readers with active consumers (Phase 1):
  // getMaps/getImages/getVideos/getAudio -> renderer libraries;
  // getAudio -> token sound menu. Character art, the asset-library and Scene
  // Director screens consume getAssetsLibrary instead.
  getMaps: () => ipcRenderer.invoke('get-maps'),
  loadNote: () => ipcRenderer.invoke('load-note'),
  saveNote: (content) => ipcRenderer.send('save-note', content),
  saveScene: (name, stateJSON) => ipcRenderer.invoke('save-scene', name, stateJSON),
  loadScenes: () => ipcRenderer.invoke('load-scenes'),
  loadSceneData: (name) => ipcRenderer.invoke('load-scene-data', name),
  saveCharacter: (id, dataJSON) => ipcRenderer.send('save-character', id, dataJSON),
  deleteCharacter: (id) => ipcRenderer.send('delete-character', id),
  deleteFile: (filePath) => ipcRenderer.send('delete-file', filePath),
  getCharacters: () => ipcRenderer.invoke('get-characters'),
  getCompendiumEntries: () => ipcRenderer.invoke('get-compendium-entries'),
  saveCompendiumEntry: (entryJSON) => ipcRenderer.invoke('save-compendium-entry', entryJSON),
  deleteCompendiumEntry: (id) => ipcRenderer.invoke('delete-compendium-entry', id),
  importCharacterEquipmentCompendium: () => ipcRenderer.invoke('import-character-equipment-compendium'),
  getAssetsLibrary: () => ipcRenderer.invoke('get-assets-library'),
  importAsset: (payloadJSON) => ipcRenderer.invoke('import-asset', payloadJSON),
  saveAssetMetadata: (assetJSON) => ipcRenderer.invoke('save-asset-metadata', assetJSON),
  deleteAsset: (assetId) => ipcRenderer.invoke('delete-asset', assetId),
  renameAsset: (payloadJSON) => ipcRenderer.invoke('rename-asset', payloadJSON),
  scanAssetsFolders: () => ipcRenderer.invoke('scan-assets-folders'),
  validateAssetsLibrary: () => ipcRenderer.invoke('validate-assets-library'),
  getAudio: () => ipcRenderer.invoke('get-audio'),
  getImages: () => ipcRenderer.invoke('get-images'),
  getVideos: () => ipcRenderer.invoke('get-videos')
});
