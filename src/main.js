const { app, BrowserWindow, ipcMain, dialog } = require('electron');
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
  runCharacterEquipmentCompendiumMigration().catch(error => {
    console.error('Erro ao importar equipamentos das fichas para o compendio:', error);
  });
  bootstrapAssetsLibraryIfEmpty().catch(error => {
    console.error('Erro ao inicializar biblioteca de assets:', error);
  });
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
  db.run(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS assets_library (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      file_name TEXT NOT NULL,
      category TEXT,
      tags TEXT,
      favorite INTEGER DEFAULT 0,
      path TEXT NOT NULL,
      relative_path TEXT,
      mime_type TEXT,
      size_bytes INTEGER DEFAULT 0,
      missing INTEGER DEFAULT 0,
      data TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS compendium_entries (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT,
      tags TEXT,
      data TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    )
  `);
});

function runDb(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function allDb(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function getDb(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

function safeFileName(name) {
  return String(name || 'asset')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
}

function detectAssetType(filePath, preferredType = null) {
  if (preferredType) return preferredType;
  const ext = path.extname(filePath).toLowerCase();
  if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) return 'audio';
  if (['.mp4', '.webm'].includes(ext)) return 'video';
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) return 'image';
  return 'image';
}

function getAssetTargetDir(type) {
  const root = path.join(__dirname, '../assets');
  const map = {
    map: path.join(root, 'cenarios'),
    token: path.join(root, 'persons'),
    portrait: path.join(root, 'portraits'),
    image: path.join(root, 'imagens'),
    video: path.join(root, 'videos'),
    audio: path.join(root, 'audio'),
    handout: path.join(root, 'imagens')
  };
  return map[type] || map.image;
}

function getAssetScanFolders() {
  const root = path.join(__dirname, '../assets');
  return [
    { type: 'map', dir: path.join(root, 'cenarios') },
    { type: 'token', dir: path.join(root, 'persons') },
    { type: 'portrait', dir: path.join(root, 'portraits') },
    { type: 'image', dir: path.join(root, 'imagens') },
    { type: 'video', dir: path.join(root, 'videos') },
    { type: 'audio', dir: path.join(root, 'audio') }
  ];
}

function getAssetMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'application/ogg',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4'
  };
  return mime[ext] || 'application/octet-stream';
}

function getRelativeAssetPath(filePath) {
  return path.relative(path.join(__dirname, '..'), filePath).replace(/\\/g, '/');
}

function normalizeAsset(asset) {
  const now = new Date().toISOString();
  const stats = fs.existsSync(asset.path) ? fs.statSync(asset.path) : null;
  const fileName = asset.fileName || asset.file_name || path.basename(asset.path || '');
  return {
    id: asset.id || `asset_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    name: asset.name || fileName.replace(/\.[^/.]+$/, ''),
    fileName,
    type: asset.type || detectAssetType(asset.path),
    category: asset.category || '',
    tags: Array.isArray(asset.tags) ? asset.tags : parseJsonArray(asset.tags),
    favorite: !!asset.favorite,
    path: asset.path,
    relativePath: asset.relativePath || asset.relative_path || getRelativeAssetPath(asset.path),
    mimeType: asset.mimeType || asset.mime_type || getAssetMimeType(asset.path),
    sizeBytes: Number(asset.sizeBytes ?? asset.size_bytes ?? stats?.size ?? 0),
    createdAt: asset.createdAt || asset.created_at || now,
    updatedAt: asset.updatedAt || asset.updated_at || now,
    missing: asset.missing !== undefined ? !!asset.missing : !stats
  };
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function normalizeLookupKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function makeAssetIdFromRelativePath(type, relativePath) {
  const slug = String(relativePath || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'asset';
  return `asset_${type}_${slug}`;
}

function makeCompendiumIdFromCharacterEquipment(name, type) {
  const slug = normalizeLookupKey(name)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'item';
  return `cmp_import_equipment_${type}_${slug}`;
}

function extractDiceNotation(value) {
  const match = String(value || '').match(/\b(\d+)\s*d\s*(\d+)\b/i);
  return match ? `${match[1]}d${match[2]}` : '';
}

function inferCompendiumTypeFromEquipment(equipment) {
  const type = normalizeLookupKey(equipment.type || equipment.tipo || equipment.kind || '');
  const label = normalizeLookupKey(`${equipment.label || ''} ${equipment.category || ''} ${equipment.nome || equipment.name || ''}`);
  const description = String(equipment.desc || equipment.description || equipment.summary || '');

  if (['weapon', 'arma'].includes(type) || extractDiceNotation(description)) return 'weapon';
  if (['armor', 'armadura'].includes(type) || /\b(armadura|escudo|placa|cota)\b/.test(label)) return 'armor';
  return 'item';
}

function normalizeCharacterEquipmentForCompendium(equipment, characterName) {
  const name = String(equipment.nome || equipment.name || equipment.label || '').trim();
  if (!name) return null;

  const type = inferCompendiumTypeFromEquipment(equipment);
  const rawDescription = String(equipment.desc || equipment.description || equipment.summary || '').trim();
  const damage = extractDiceNotation(equipment.damage || equipment.dano || equipment.dice || equipment.dado || rawDescription);
  const mechanics = { ...(equipment.mechanics || {}) };
  if (damage && !mechanics.damage) mechanics.damage = damage;
  if (equipment.weight !== undefined && mechanics.weight === undefined) mechanics.weight = String(equipment.weight);
  if (equipment.peso !== undefined && mechanics.weight === undefined) mechanics.weight = String(equipment.peso);

  const category = type === 'weapon' ? 'Armas' : type === 'armor' ? 'Armaduras' : 'Itens gerais';
  const description = rawDescription || mechanics.effect || '';
  const now = new Date().toISOString();

  return {
    id: makeCompendiumIdFromCharacterEquipment(name, type),
    name,
    type,
    category,
    image: equipment.image || equipment.imagem || '',
    summary: damage || description,
    description,
    tags: ['importado de ficha'],
    rarity: equipment.rarity || 'comum',
    source: characterName ? `Ficha: ${characterName}` : 'Ficha importada',
    mechanics,
    actorTemplate: null,
    createdAt: now,
    updatedAt: now
  };
}

async function importCharacterEquipmentIntoCompendium() {
  const characters = await allDb("SELECT id, data FROM characters");
  const existingRows = await allDb("SELECT type, name FROM compendium_entries");
  const knownEntries = new Set(existingRows.map(row => `${row.type}|${normalizeLookupKey(row.name)}`));
  const imported = [];
  let scanned = 0;
  let skipped = 0;

  for (const row of characters) {
    let character;
    try {
      character = JSON.parse(row.data || '{}');
    } catch (error) {
      skipped++;
      continue;
    }

    const equipments = Array.isArray(character.equipamentos) ? character.equipamentos : [];
    for (const equipment of equipments) {
      scanned++;
      const entry = normalizeCharacterEquipmentForCompendium(equipment, character.nome || row.id);
      if (!entry) {
        skipped++;
        continue;
      }

      const key = `${entry.type}|${normalizeLookupKey(entry.name)}`;
      if (knownEntries.has(key)) {
        skipped++;
        continue;
      }

      await runDb(`
        INSERT INTO compendium_entries
        (id, type, name, category, tags, data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        entry.id,
        entry.type,
        entry.name,
        entry.category || '',
        JSON.stringify(entry.tags || []),
        JSON.stringify(entry),
        entry.createdAt,
        entry.updatedAt
      ]);

      knownEntries.add(key);
      imported.push(entry);
    }
  }

  return { imported, importedCount: imported.length, scannedCount: scanned, skippedCount: skipped };
}

async function runCharacterEquipmentCompendiumMigration() {
  const migrationId = 'character_equipment_compendium_seed_v1';
  const existing = await getDb("SELECT id FROM app_migrations WHERE id = ?", [migrationId]);
  if (existing) return { imported: [], importedCount: 0, scannedCount: 0, skippedCount: 0, alreadyApplied: true };

  const result = await importCharacterEquipmentIntoCompendium();
  await runDb("INSERT INTO app_migrations (id, applied_at) VALUES (?, ?)", [migrationId, new Date().toISOString()]);
  return { ...result, alreadyApplied: false };
}

async function saveAsset(asset) {
  const normalized = normalizeAsset(asset);
  await runDb(`
    INSERT OR REPLACE INTO assets_library
    (id, type, name, file_name, category, tags, favorite, path, relative_path, mime_type, size_bytes, missing, data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    normalized.id,
    normalized.type,
    normalized.name,
    normalized.fileName,
    normalized.category || '',
    JSON.stringify(normalized.tags || []),
    normalized.favorite ? 1 : 0,
    normalized.path,
    normalized.relativePath || '',
    normalized.mimeType || '',
    normalized.sizeBytes || 0,
    normalized.missing ? 1 : 0,
    JSON.stringify(normalized),
    normalized.createdAt,
    normalized.updatedAt
  ]);
  return normalized;
}

async function getAllAssets() {
  const rows = await allDb("SELECT * FROM assets_library ORDER BY type ASC, name ASC");
  return rows.map(row => {
    try {
      return normalizeAsset(JSON.parse(row.data));
    } catch (error) {
      return normalizeAsset(row);
    }
  });
}

async function getAssetById(assetId) {
  const row = await getDb("SELECT data FROM assets_library WHERE id = ?", [assetId]);
  if (!row) return null;
  return normalizeAsset(JSON.parse(row.data));
}

function makeScannedAsset(file, folder) {
  const relativePath = getRelativeAssetPath(file.path);
  const category = path.relative(folder.dir, path.dirname(file.path)) || '';
  return {
    id: makeAssetIdFromRelativePath(folder.type, relativePath),
    type: folder.type,
    name: path.basename(file.path, path.extname(file.path)),
    fileName: path.basename(file.path),
    category: category === '.' ? '' : category,
    tags: [],
    favorite: false,
    path: file.path,
    relativePath,
    mimeType: getAssetMimeType(file.path),
    sizeBytes: file.stat.size,
    missing: false
  };
}

async function scanAssetsFolders(options = {}) {
  const { force = false, onlyIfEmpty = false } = options;
  const existing = await getAllAssets();
  if (onlyIfEmpty && existing.length > 0) return existing;

  const byPath = new Map();
  const byRelativePath = new Map();
  existing.forEach(asset => {
    if (asset.path) byPath.set(path.resolve(asset.path), asset);
    if (asset.relativePath) byRelativePath.set(asset.relativePath, asset);
  });

  const seenIds = new Set();
  for (const folder of getAssetScanFolders()) {
    const files = discoverAssetFiles(folder.dir, folder.type);
    for (const file of files) {
      const scanned = makeScannedAsset(file, folder);
      const existingAsset = byPath.get(path.resolve(file.path)) || byRelativePath.get(scanned.relativePath);

      if (existingAsset) {
        seenIds.add(existingAsset.id);
        if (!force) continue;

        await saveAsset({
          ...existingAsset,
          fileName: scanned.fileName,
          path: scanned.path,
          relativePath: scanned.relativePath,
          mimeType: scanned.mimeType,
          sizeBytes: scanned.sizeBytes,
          missing: false,
          updatedAt: new Date().toISOString()
        });
        continue;
      }

      const saved = await saveAsset(scanned);
      seenIds.add(saved.id);
      byPath.set(path.resolve(saved.path), saved);
      byRelativePath.set(saved.relativePath, saved);
    }
  }

  if (force) {
    for (const asset of existing) {
      if (seenIds.has(asset.id) || asset.missing) continue;
      await saveAsset({
        ...asset,
        missing: asset.path ? !fs.existsSync(asset.path) : true,
        updatedAt: new Date().toISOString()
      });
    }
  }

  return getAllAssets();
}

async function bootstrapAssetsLibraryIfEmpty() {
  const row = await getDb("SELECT COUNT(*) AS count FROM assets_library");
  if (Number(row?.count || 0) > 0) return;
  await scanAssetsFolders({ onlyIfEmpty: true });
}

function discoverAssetFiles(dir, type, list = []) {
  if (!fs.existsSync(dir)) return list;
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      discoverAssetFiles(fullPath, type, list);
      return;
    }
    if (!/\.(png|jpg|jpeg|webp|gif|mp4|webm|ogg|mp3|wav|m4a)$/i.test(file)) return;
    list.push({ path: fullPath, type, stat });
  });
  return list;
}

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

ipcMain.handle('get-compendium-entries', async () => {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM compendium_entries ORDER BY type ASC, name ASC", (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(rows.map(row => {
        try {
          return JSON.parse(row.data);
        } catch (error) {
          return null;
        }
      }).filter(Boolean));
    });
  });
});

ipcMain.handle('save-compendium-entry', async (event, entryJSON) => {
  const entry = JSON.parse(entryJSON);
  const now = new Date().toISOString();

  return new Promise((resolve, reject) => {
    db.run(`
      INSERT OR REPLACE INTO compendium_entries
      (id, type, name, category, tags, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      entry.id,
      entry.type,
      entry.name,
      entry.category || '',
      JSON.stringify(entry.tags || []),
      JSON.stringify(entry),
      entry.createdAt || now,
      entry.updatedAt || now
    ], err => {
      if (err) reject(err);
      else resolve(true);
    });
  });
});

ipcMain.handle('delete-compendium-entry', async (event, id) => {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM compendium_entries WHERE id = ?", [id], err => {
      if (err) reject(err);
      else resolve(true);
    });
  });
});

ipcMain.handle('import-character-equipment-compendium', async () => {
  return importCharacterEquipmentIntoCompendium();
});

ipcMain.handle('get-assets-library', async () => {
  await bootstrapAssetsLibraryIfEmpty();
  return getAllAssets();
});

ipcMain.handle('import-asset', async (event, payloadJSON) => {
  const payload = JSON.parse(payloadJSON || '{}');
  const result = await dialog.showOpenDialog({
    title: 'Importar asset',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] },
      { name: 'Videos', extensions: ['mp4', 'webm', 'ogg'] },
      { name: 'Audios', extensions: ['mp3', 'wav', 'ogg', 'm4a'] },
      { name: 'Todos', extensions: ['*'] }
    ]
  });

  if (result.canceled) return [];

  const imported = [];
  for (const sourcePath of result.filePaths) {
    const type = detectAssetType(sourcePath, payload.type || null);
    const targetDir = getAssetTargetDir(type);
    fs.mkdirSync(targetDir, { recursive: true });

    const originalName = path.basename(sourcePath);
    let fileName = safeFileName(originalName);
    let targetPath = path.join(targetDir, fileName);
    const ext = path.extname(fileName);
    const base = fileName.slice(0, fileName.length - ext.length);
    let suffix = 1;
    while (fs.existsSync(targetPath)) {
      fileName = `${base}_${suffix}${ext}`;
      targetPath = path.join(targetDir, fileName);
      suffix++;
    }

    fs.copyFileSync(sourcePath, targetPath);
    const asset = await saveAsset({
      type,
      name: payload.name || path.basename(fileName, path.extname(fileName)),
      fileName,
      category: payload.category || '',
      tags: payload.tags || [],
      favorite: false,
      path: targetPath,
      relativePath: getRelativeAssetPath(targetPath),
      mimeType: getAssetMimeType(targetPath)
    });
    imported.push(asset);
  }

  return imported;
});

ipcMain.handle('save-asset-metadata', async (event, assetJSON) => {
  const asset = JSON.parse(assetJSON);
  const existing = asset.id ? await getAssetById(asset.id) : null;
  return saveAsset({
    ...(existing || {}),
    ...asset,
    updatedAt: new Date().toISOString()
  });
});

ipcMain.handle('delete-asset', async (event, assetId) => {
  const asset = await getAssetById(assetId);
  if (asset?.path && fs.existsSync(asset.path) && isInsideAllowedAssetFolder(asset.path)) {
    fs.unlinkSync(asset.path);
  }
  await runDb("DELETE FROM assets_library WHERE id = ?", [assetId]);
  return true;
});

ipcMain.handle('rename-asset', async (event, payloadJSON) => {
  const payload = JSON.parse(payloadJSON || '{}');
  const asset = await getAssetById(payload.assetId);
  if (!asset) return null;

  const oldPath = asset.path;
  const ext = path.extname(oldPath);
  const newFileName = safeFileName(payload.newName) + ext;
  const newPath = path.join(path.dirname(oldPath), newFileName);

  if (fs.existsSync(oldPath) && oldPath !== newPath) {
    fs.renameSync(oldPath, newPath);
  }

  return saveAsset({
    ...asset,
    name: payload.newName,
    fileName: newFileName,
    path: newPath,
    relativePath: getRelativeAssetPath(newPath),
    updatedAt: new Date().toISOString()
  });
});

ipcMain.handle('scan-assets-folders', async () => {
  return scanAssetsFolders({ force: true });
});

ipcMain.handle('validate-assets-library', async () => {
  const assets = await getAllAssets();
  const updated = [];
  for (const asset of assets) {
    updated.push(await saveAsset({
      ...asset,
      missing: !fs.existsSync(asset.path),
      updatedAt: new Date().toISOString()
    }));
  }
  return updated;
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
let lastPlayerSyncAt = null;
let lastPlayerSceneName = '';
let currentPlayerHandout = null;

ipcMain.handle('open-player-view', async () => {
  try {
    if (playerWindow && !playerWindow.isDestroyed()) {
      playerWindow.focus();
      return { ok: true, reused: true };
    }
    
    playerWindow = new BrowserWindow({
      width: 1280, height: 720,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    
    playerWindow.setMenuBarVisibility(false);
    await playerWindow.loadURL(`file://${path.join(__dirname, 'index.html')}?player=true`);
    
    playerWindow.on('closed', () => { playerWindow = null; });
    return { ok: true, reused: false };
  } catch (error) {
    console.error('Erro ao abrir Player View:', error);
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('get-player-view-status', async () => ({
  open: !!(playerWindow && !playerWindow.isDestroyed()),
  destroyed: playerWindow ? playerWindow.isDestroyed() : true,
  lastSyncAt: lastPlayerSyncAt,
  sceneName: lastPlayerSceneName,
  handout: currentPlayerHandout
}));

ipcMain.on('sync-board', (event, state) => {
  lastPlayerSyncAt = new Date().toISOString();
  if (state && !state.type) lastPlayerSceneName = state.sceneName || state.sceneDirector?.sceneName || lastPlayerSceneName;
  if (playerWindow && !playerWindow.isDestroyed()) playerWindow.webContents.send('update-board', state);
});

ipcMain.on('sync-ping', (event, payload) => {
  if (playerWindow && !playerWindow.isDestroyed()) {
    playerWindow.webContents.send('player-ping', payload);
  }
});

ipcMain.on('show-handout-to-players', (event, payload) => {
  currentPlayerHandout = payload || null;
  if (playerWindow && !playerWindow.isDestroyed()) {
    playerWindow.webContents.send('player-handout', payload);
  }
});

ipcMain.on('hide-handout-from-players', () => {
  currentPlayerHandout = null;
  if (playerWindow && !playerWindow.isDestroyed()) {
    playerWindow.webContents.send('player-hide-handout');
  }
});
