const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// Configuração do Banco de Dados
const dbPath = path.join(__dirname, '../cosmere_vtt.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Cria a tabela de notas se não existir
  db.run("CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, content TEXT)");
  
  // Garante que existe pelo menos uma linha para atualizarmos
  db.get("SELECT count(*) as count FROM notes", (err, row) => {
    if (row.count === 0) {
      db.run("INSERT INTO notes (id, content) VALUES (1, '')");
    }
  });
});

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false, // Esconde a janela enquanto constrói
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Maximiza a janela e exibe de uma vez
  mainWindow.maximize();
  mainWindow.show();

  mainWindow.loadFile('src/index.html');
  // mainWindow.webContents.openDevTools(); 
}

// Handlers do Banco de Dados para a UI
ipcMain.handle('load-note', async () => {
  return new Promise((resolve, reject) => {
    db.get("SELECT content FROM notes WHERE id = 1", (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.content : "");
    });
  });
});

ipcMain.on('save-note', (event, content) => {
  db.run("UPDATE notes SET content = ? WHERE id = 1", [content]);
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Handler para ler mapas (Agora com suporte a sub-pastas)
ipcMain.handle('get-maps', async () => {
  const mapsDir = path.join(__dirname, '../assets/cenarios');
  if (!fs.existsSync(mapsDir)) return [];

  const discover = (dir, list = []) => {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        discover(fullPath, list);
      } else if (/\.(png|jpg|jpeg|webp)$/i.test(file)) {
        const category = path.relative(mapsDir, dir) || "Raiz";
        list.push({
          name: file.replace(/\.[^/.]+$/, ""),
          path: fullPath,
          category: category
        });
      }
    });
    return list;
  };
  return discover(mapsDir);
});

// Handler para ler tokens recursivamente (Migrado do assets.py)
ipcMain.handle('get-tokens', async () => {
  const tokensDir = path.join(__dirname, '../assets/persons');
  if (!fs.existsSync(tokensDir)) return [];

  const discover = (dir, list = []) => {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        discover(fullPath, list);
      } else if (/\.(png|jpg|jpeg|webp)$/i.test(file)) {
        const category = path.relative(tokensDir, dir) || "Raiz";
        list.push({
          name: file.replace(/\.[^/.]+$/, ""),
          path: fullPath,
          category: category
        });
      }
    });
    return list;
  };
  return discover(tokensDir);
});

// --- SISTEMA DE CENAS E FICHAS (SQLITE PRO) ---
db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS scenes (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, state TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS characters (id TEXT PRIMARY KEY, data TEXT)");
});

// Salvar Cena Nomeada
ipcMain.handle('save-scene', async (event, name, stateJSON) => {
  return new Promise((resolve, reject) => {
    db.run("INSERT OR REPLACE INTO scenes (name, state) VALUES (?, ?)", [name, stateJSON], function(err) {
      if (err) reject(err); else resolve(true);
    });
  });
});

// Listar todas as Cenas
ipcMain.handle('load-scenes', async () => {
  return new Promise((resolve, reject) => {
    db.all("SELECT name FROM scenes ORDER BY name ASC", (err, rows) => {
      if (err) reject(err); else resolve(rows.map(r => r.name));
    });
  });
});

// Carregar Dados de uma Cena
ipcMain.handle('load-scene-data', async (event, name) => {
  return new Promise((resolve, reject) => {
    db.get("SELECT state FROM scenes WHERE name = ?", [name], (err, row) => {
      if (err) reject(err); else resolve(row ? row.state : "{}");
    });
  });
});

// Salvar/Carregar Fichas
ipcMain.on('save-character', (event, id, dataJSON) => {
  db.run("INSERT OR REPLACE INTO characters (id, data) VALUES (?, ?)", [id, dataJSON]);
});

// ADICIONAR ESTE BLOCO AQUI:
ipcMain.on('delete-character', (event, id) => {
  db.run("DELETE FROM characters WHERE id = ?", [id]);
});

function isInsideAllowedAssetFolder(filePath) {
  const allowedRoots = [
    path.resolve(__dirname, '../assets/persons'),
    path.resolve(__dirname, '../assets/portraits'),
    path.resolve(__dirname, '../assets/imagens'),
    path.resolve(__dirname, '../assets/audio'),
    path.resolve(__dirname, '../assets/videos')
  ];

  const target = path.resolve(filePath);
  return allowedRoots.some(root => target.startsWith(root + path.sep));
}

ipcMain.on('delete-file', (event, filePath) => {
  try {
    if (!isInsideAllowedAssetFolder(filePath)) {
      console.warn('Tentativa bloqueada de deletar arquivo fora de assets:', filePath);
      return;
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error("Erro ao deletar arquivo:", err);
  }
});
// ==========================

ipcMain.handle('get-characters', async () => {
  return new Promise((resolve, reject) => {
    db.all("SELECT id, data FROM characters", (err, rows) => {
      if (err) reject(err); 
      else {
        const chars = {};
        rows.forEach(r => chars[r.id] = JSON.parse(r.data));
        resolve(chars);
      }
    });
  });
});

// Handler para ler imagens (Handouts)
ipcMain.handle('get-images', async () => {
  const imgDir = path.join(__dirname, '../assets/imagens');
  if (!fs.existsSync(imgDir)) return [];
  const files = fs.readdirSync(imgDir);
  return files.filter(file => /\.(png|jpg|jpeg|webp|gif)$/i.test(file)).map(file => ({
    name: file,
    path: path.join(imgDir, file)
  }));
});

// Handler para ler vídeos
ipcMain.handle('get-videos', async () => {
  const videoDir = path.join(__dirname, '../assets/videos');
  if (!fs.existsSync(videoDir)) return [];
  const files = fs.readdirSync(videoDir);
  return files.filter(file => /\.(mp4|webm|ogg)$/i.test(file)).map(file => ({
    name: file,
    path: path.join(videoDir, file)
  }));
});

// Handler para ler retratos (Portraits) e Tokens
ipcMain.handle('get-portraits', async (event, tipo) => {
  // Se o tipo for 'token', lê a pasta persons. Se não, lê portraits.
  const pasta = tipo === 'token' ? 'persons' : 'portraits';
  const portDir = path.join(__dirname, '../assets/' + pasta);
  if (!fs.existsSync(portDir)) return [];
  const files = fs.readdirSync(portDir);
  return files.filter(file => /\.(png|jpg|jpeg|webp)$/i.test(file)).map(file => ({
    name: file,
    path: path.join(portDir, file)
  }));
});

// Handler para ler arquivos de áudio recursivamente (suporta subpastas)
ipcMain.handle('get-audio', async () => {
  const audioDir = path.join(__dirname, '../assets/audio');
  if (!fs.existsSync(audioDir)) return [];

  const discover = (dir, list = []) => {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        discover(fullPath, list);
      } else if (/\.(mp3|wav|ogg|m4a)$/i.test(file)) {
        const category = path.relative(audioDir, dir) || "Raiz";
        list.push({
          name: file,
          path: fullPath,
          category: category
        });
      }
    });
    return list;
  };
  return discover(audioDir);
});

// --- SISTEMA DE VISÃO DO JOGADOR (DUAL MONITOR) ---
let playerWindow = null;

ipcMain.on('open-player-view', () => {
  if (playerWindow) {
    playerWindow.focus();
    return;
  }
  
  playerWindow = new BrowserWindow({
    width: 1280, height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });
  
  playerWindow.setMenuBarVisibility(false);
  playerWindow.loadURL(`file://${path.join(__dirname, 'index.html')}?player=true`);
  
  playerWindow.on('closed', () => { playerWindow = null; });
});

ipcMain.on('sync-board', (event, state) => {
  if (playerWindow) playerWindow.webContents.send('update-board', state);
});

ipcMain.on('sync-ping', (event, payload) => {
  if (playerWindow) {
    playerWindow.webContents.send('player-ping', payload);
  }
});

ipcMain.on('show-handout-to-players', (event, payload) => {
  if (playerWindow) {
    playerWindow.webContents.send('player-handout', payload);
  }
});

ipcMain.on('hide-handout-from-players', () => {
  if (playerWindow) {
    playerWindow.webContents.send('player-hide-handout');
  }
});
