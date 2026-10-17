const { app, BrowserWindow, ipcMain, screen, shell, Menu, dialog, net } = require('electron');
const path = require('path');
const fs   = require('fs');

app.setPath('userData', path.join(app.getPath('appData'), 'ChronoApp'));

// ── Config MAJ ────────────────────────────────────────────────
const GITHUB_API    = 'https://api.github.com/repos/nathbu92/chronoapp/releases/latest';
const CURRENT_VERSION = app.getVersion();

let mainWindow   = null;
let splashWindow = null;
let updateWin    = null;
let downloadedInstallerPath = null;
let db = null;

// ── Utilitaires réseau ────────────────────────────────────────
function isOnline() { return net.isOnline(); }

function fetchJSON(url) {
  return new Promise(resolve => {
    try {
      const req = net.request({ method:'GET', url, redirect:'follow' });
      req.setHeader('User-Agent', `chrono/${CURRENT_VERSION}`);
      req.setHeader('Accept', 'application/vnd.github+json');
      let body = '';
      const t = setTimeout(() => { try{req.abort();}catch(_){} resolve(null); }, 6000);
      req.on('response', res => {
        res.on('data',  c => { body += c.toString(); });
        res.on('end',   () => { clearTimeout(t); try{resolve(JSON.parse(body));}catch(_){resolve(null);} });
        res.on('error', () => { clearTimeout(t); resolve(null); });
      });
      req.on('error', () => { clearTimeout(t); resolve(null); });
      req.end();
    } catch(_) { resolve(null); }
  });
}

function isNewerVersion(current, latest) {
  const parse = v => v.replace(/^v/,'').split('.').map(n=>parseInt(n,10)||0);
  const [cMaj,cMin,cPat] = parse(current);
  const [lMaj,lMin,lPat] = parse(latest);
  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPat > cPat;
}

// ── Fenêtre de mise à jour ────────────────────────────────────
function openUpdateWindow(latestVersion, releaseUrl, releaseBody, exeUrl) {
  if (updateWin && !updateWin.isDestroyed()) { updateWin.focus(); return; }

  const exeEncoded  = encodeURIComponent(exeUrl || '');
  const bodyEncoded = encodeURIComponent((releaseBody||'').slice(0,800));
  const fileUrl = `file://${path.join(__dirname, 'update.html')}` +
    `?current=${encodeURIComponent(CURRENT_VERSION)}` +
    `&latest=${encodeURIComponent(latestVersion)}` +
    `&exeUrl=${exeEncoded}` +
    `&body=${bodyEncoded}`;

  updateWin = new BrowserWindow({
    width: 480, height: 520,
    frame: false, transparent: true,
    resizable: false, center: true,
    alwaysOnTop: true, skipTaskbar: false,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload-update.js'),
    },
  });
  updateWin.loadURL(fileUrl);
  updateWin.on('closed', () => { updateWin = null; downloadedInstallerPath = null; });
}

// ── Téléchargement de l'installeur ────────────────────────────
function downloadInstaller(exeUrl, version) {
  return new Promise((resolve, reject) => {
    try {
      const dest = path.join(app.getPath('downloads'), `Chrono-Setup-${version}.exe`);
      try { fs.unlinkSync(dest); } catch(_) {}
      const file = fs.createWriteStream(dest);
      let total = 0, received = 0;

      const req = net.request({ method:'GET', url:exeUrl, redirect:'follow' });
      req.setHeader('User-Agent', `chrono/${CURRENT_VERSION}`);

      const timeout = setTimeout(() => {
        try{req.abort();}catch(_){}
        file.destroy();
        try{fs.unlinkSync(dest);}catch(_){}
        reject(new Error('Timeout'));
      }, 5 * 60 * 1000);

      req.on('response', res => {
        // Gestion redirect GitHub → CDN
        if (res.statusCode === 301 || res.statusCode === 302) {
          clearTimeout(timeout); file.destroy();
          const loc = res.headers['location'];
          if (loc) downloadInstaller(loc, version).then(resolve).catch(reject);
          else reject(new Error('Redirect sans Location'));
          return;
        }

        total = parseInt(res.headers['content-length']||'0', 10);

        res.on('data', chunk => {
          received += chunk.length;
          file.write(chunk);
          if (updateWin && !updateWin.isDestroyed()) {
            updateWin.webContents.send('update:progress', {
              percent: total > 0 ? (received/total)*100 : 0,
              transferred: received, total,
            });
          }
        });

        res.on('end', () => {
          clearTimeout(timeout);
          file.end(() => {
            downloadedInstallerPath = dest;
            if (updateWin && !updateWin.isDestroyed()) {
              updateWin.webContents.send('update:progress', {
                percent:100, transferred:received, total, status:'done',
              });
            }
            resolve(dest);
          });
        });

        res.on('error', err => {
          clearTimeout(timeout); file.destroy();
          try{fs.unlinkSync(dest);}catch(_){}
          if (updateWin && !updateWin.isDestroyed())
            updateWin.webContents.send('update:progress', { status:'error' });
          reject(err);
        });
      });

      req.on('error', err => {
        clearTimeout(timeout); file.destroy();
        try{fs.unlinkSync(dest);}catch(_){}
        if (updateWin && !updateWin.isDestroyed())
          updateWin.webContents.send('update:progress', { status:'error' });
        reject(err);
      });

      req.end();
    } catch(err) { reject(err); }
  });
}

// ── Vérification de mise à jour ───────────────────────────────
async function checkForUpdate() {
  try {
    if (!isOnline()) return;
    const release = await fetchJSON(GITHUB_API);
    if (!release || !release.tag_name) return;

    const latestVersion = release.tag_name.replace(/^v/,'');
    const releaseUrl    = release.html_url || '';
    const releaseBody   = release.body || '';
    const assets        = release.assets || [];

    // Cherche le .exe Setup (pas le portable)
    const exeAsset = assets.find(a =>
      a.name && a.name.toLowerCase().includes('setup') &&
      a.name.toLowerCase().endsWith('.exe') && a.browser_download_url
    ) || assets.find(a =>
      a.name && a.name.toLowerCase().endsWith('.exe') && a.browser_download_url
    );
    const exeUrl = exeAsset ? exeAsset.browser_download_url : '';

    if (!isNewerVersion(CURRENT_VERSION, latestVersion)) return;

    // Attendre que la fenêtre principale soit prête
    await new Promise(r => setTimeout(r, 1000));
    openUpdateWindow(latestVersion, releaseUrl, releaseBody, exeUrl);
  } catch(_) {}
}

// ── IPC MAJ ───────────────────────────────────────────────────
ipcMain.handle('update:startDownload', async (_e, exeUrl, version) => {
  try { await downloadInstaller(exeUrl, version); }
  catch(e) {
    if (updateWin && !updateWin.isDestroyed())
      updateWin.webContents.send('update:progress', { status:'error' });
  }
});

ipcMain.handle('update:launchInstaller', () => {
  if (!downloadedInstallerPath || !fs.existsSync(downloadedInstallerPath)) return;
  shell.openPath(downloadedInstallerPath);
  setTimeout(() => app.quit(), 1500);
});

ipcMain.handle('update:cancelInstall', () => {
  if (downloadedInstallerPath) try{fs.unlinkSync(downloadedInstallerPath);}catch(_){}
  if (updateWin && !updateWin.isDestroyed()) updateWin.close();
});

ipcMain.handle('update:openRelease', (_e, url) => shell.openExternal(url));

// IPC vérification manuelle depuis l'app
ipcMain.handle('check-for-updates', async () => {
  try {
    if (!isOnline()) return { upToDate: true, reason: 'offline' };
    const release = await fetchJSON(GITHUB_API);
    if (!release || !release.tag_name) return { upToDate: true };
    const latestVersion = release.tag_name.replace(/^v/,'');
    if (!isNewerVersion(CURRENT_VERSION, latestVersion)) return { upToDate: true, version: latestVersion };
    const assets  = release.assets || [];
    const exeAsset = assets.find(a =>
      a.name && a.name.toLowerCase().includes('setup') && a.name.toLowerCase().endsWith('.exe')
    ) || assets.find(a => a.name && a.name.toLowerCase().endsWith('.exe'));
    const exeUrl = exeAsset ? exeAsset.browser_download_url : '';
    openUpdateWindow(latestVersion, release.html_url||'', release.body||'', exeUrl);
    return { upToDate: false, version: latestVersion };
  } catch(e) { return { error: e.message }; }
});

// ── SQLite ────────────────────────────────────────────────────
function initDB() {
  const dbDir = app.getPath('userData');
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive:true });
  try {
    const Database = require('better-sqlite3');
    db = new Database(path.join(dbDir, 'chrono.db'));
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS timer_presets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL, secs INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY, value TEXT NOT NULL
      );
    `);
  } catch(e) { console.error('[DB]', e.message); db = null; }
}

// ── Splash ────────────────────────────────────────────────────
function createSplash() {
  splashWindow = new BrowserWindow({
    width:500, height:320, frame:false, transparent:true,
    alwaysOnTop:true, resizable:false, center:true, skipTaskbar:true,
    webPreferences:{ nodeIntegration:false, contextIsolation:true },
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
}

// ── Fenêtre principale ────────────────────────────────────────
function createMain() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
    width:  Math.min(1280, width),
    height: Math.min(860,  height),
    minWidth:800, minHeight:600,
    frame:true, titleBarStyle:'default',
    show:false, backgroundColor:'#020617',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences:{
      nodeIntegration:false, contextIsolation:true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'app.html'));

  mainWindow.once('ready-to-show', () => {
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) splashWindow.destroy();
      mainWindow.show(); mainWindow.focus();
    }, 3000);
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type==='keyDown' && input.key==='F11') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    }
  });

  mainWindow.on('enter-full-screen', () =>
    mainWindow?.webContents.send('app-event', { type:'fullscreen', value:true }));
  mainWindow.on('leave-full-screen', () =>
    mainWindow?.webContents.send('app-event', { type:'fullscreen', value:false }));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url); return { action:'deny' };
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Menu natif ────────────────────────────────────────────────
function buildMenu() {
  const nav = page => () => mainWindow?.webContents.send('app-event', { type:'navigate', page });
  const template = [
    { label:'Navigation', submenu:[
      { label:'🏠  Accueil',     accelerator:'CmdOrCtrl+0', click:nav('home') },
      { label:'⏱  Chronomètre', accelerator:'CmdOrCtrl+1', click:nav('stopwatch') },
      { label:'⏳  Minuteur',    accelerator:'CmdOrCtrl+2', click:nav('timer') },
      { label:'🕐  Horloge',     accelerator:'CmdOrCtrl+3', click:nav('clock') },
      { type:'separator' },
      { label:'Quitter', accelerator:'Alt+F4', role:'quit' },
    ]},
    { label:'Affichage', submenu:[
      { label:'Plein écran', accelerator:'F11',
        click:() => mainWindow && mainWindow.setFullScreen(!mainWindow.isFullScreen()) },
      { label:'Zoom +', accelerator:'CmdOrCtrl+Equal', role:'zoomIn' },
      { label:'Zoom -', accelerator:'CmdOrCtrl+-', role:'zoomOut' },
      { label:'Zoom normal', accelerator:'CmdOrCtrl+0', role:'resetZoom' },
      { type:'separator' },
      { label:'Recharger', accelerator:'CmdOrCtrl+R', role:'reload' },
      { label:'Outils développeur', accelerator:'F12', role:'toggleDevTools' },
    ]},
    { label:'Aide', submenu:[
      { label:'Vérifier les mises à jour',
        click:() => mainWindow?.webContents.send('app-event', { type:'check-update' }) },
      { type:'separator' },
      { label:'À propos', click:() => dialog.showMessageBox(mainWindow, {
          type:'info', title:'À propos de Chrono',
          message:'Chrono', detail:`Version ${CURRENT_VERSION}\nChronomètre · Minuteur · Horloge`,
          buttons:['OK'],
        })
      },
    ]},
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── IPC fenêtre ───────────────────────────────────────────────
ipcMain.handle('fullscreen-toggle', () => {
  if (!mainWindow) return;
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
  return { fullscreen: mainWindow.isFullScreen() };
});

// ── IPC double écran ──────────────────────────────────────────
ipcMain.handle('get-displays', () =>
  screen.getAllDisplays().map((d,i) => ({
    id:d.id, index:i,
    isPrimary: d.id === screen.getPrimaryDisplay().id,
    bounds:d.bounds,
    label:`Écran ${i+1}${d.id===screen.getPrimaryDisplay().id?' (principal)':''}`,
  }))
);
ipcMain.handle('move-to-second-screen', async () => {
  const displays = screen.getAllDisplays();
  if (displays.length < 2) return { ok:false, reason:'single_screen' };
  const sec = displays.find(d => d.id !== screen.getPrimaryDisplay().id);
  mainWindow.setBounds(sec.bounds); mainWindow.setFullScreen(true);
  return { ok:true };
});
ipcMain.handle('restore-primary-screen', async () => {
  mainWindow.setFullScreen(false);
  const { x,y,width,height } = screen.getPrimaryDisplay().workArea;
  mainWindow.setBounds({
    x:x+Math.floor((width-1280)/2), y:y+Math.floor((height-860)/2),
    width:Math.min(1280,width), height:Math.min(860,height),
  });
  return { ok:true };
});

// ── IPC DB ────────────────────────────────────────────────────
ipcMain.handle('db-get-presets',    ()        => db ? db.prepare('SELECT id,name,secs FROM timer_presets ORDER BY id').all() : []);
ipcMain.handle('db-save-preset',    (_e,n,s)  => { if(!db) return null; const i=db.prepare('INSERT INTO timer_presets(name,secs) VALUES(?,?)').run(n,s); return {id:i.lastInsertRowid,name:n,secs:s}; });
ipcMain.handle('db-delete-preset',  (_e,id)   => db && db.prepare('DELETE FROM timer_presets WHERE id=?').run(id));
ipcMain.handle('db-get-setting',    (_e,key)  => { if(!db) return null; const r=db.prepare('SELECT value FROM settings WHERE key=?').get(key); return r?r.value:null; });
ipcMain.handle('db-set-setting',    (_e,k,v)  => db && db.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)').run(k,v));

// ── IPC musique ───────────────────────────────────────────────
ipcMain.handle('pick-music-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title:'Choisir une musique de fin',
    filters:[{ name:'Audio', extensions:['mp3','wav','ogg','flac','aac','m4a','opus','wma'] }],
    properties:['openFile'],
  });
  return canceled || !filePaths.length ? null : filePaths[0];
});

// ── Cycle de vie ──────────────────────────────────────────────
app.whenReady().then(() => {
  initDB();
  buildMenu();
  createSplash();
  createMain();
  // Vérification MAJ après démarrage (4.5s délai)
  setTimeout(checkForUpdate, 4500);
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
