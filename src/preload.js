const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getMaps: () => ipcRenderer.invoke('get-maps'),
  getTokens: () => ipcRenderer.invoke('get-tokens'),
  loadNote: () => ipcRenderer.invoke('load-note'),
  saveNote: (content) => ipcRenderer.send('save-note', content),
  saveScene: (name, stateJSON) => ipcRenderer.invoke('save-scene', name, stateJSON),
  loadScenes: () => ipcRenderer.invoke('load-scenes'),
  loadSceneData: (name) => ipcRenderer.invoke('load-scene-data', name),
  saveCharacter: (id, dataJSON) => ipcRenderer.send('save-character', id, dataJSON),
  deleteCharacter: (id) => ipcRenderer.send('delete-character', id),
  deleteFile: (filePath) => ipcRenderer.send('delete-file', filePath),
  getCharacters: () => ipcRenderer.invoke('get-characters'),
  getAudio: () => ipcRenderer.invoke('get-audio'),
  getImages: () => ipcRenderer.invoke('get-images'),
  getVideos: () => ipcRenderer.invoke('get-videos'),
  getPortraits: (tipo) => ipcRenderer.invoke('get-portraits', tipo),
  
  // Funções Novas da Visão de Jogador
  openPlayerView: () => ipcRenderer.send('open-player-view'),
  syncBoard: (state) => ipcRenderer.send('sync-board', state),
  onUpdateBoard: (callback) => ipcRenderer.on('update-board', (event, state) => callback(state)),
  syncPing: (payloadOrX, y) => {
    const payload = typeof payloadOrX === 'object' ? payloadOrX : { x: payloadOrX, y };
    ipcRenderer.send('sync-ping', payload);
  },
  onPing: (callback) => ipcRenderer.on('player-ping', (event, payload) => callback(payload)),
  showHandoutToPlayers: (payload) => ipcRenderer.send('show-handout-to-players', payload),
  onShowHandout: (callback) => ipcRenderer.on('player-handout', (event, payload) => callback(payload)),
  hideHandoutFromPlayers: () => ipcRenderer.send('hide-handout-from-players'),
  onHideHandout: (callback) => ipcRenderer.on('player-hide-handout', () => callback())
});
