const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { execFile, exec } = require('child_process');
const fs = require('fs');
const https = require('https');
const http = require('http');

const store = new Store({
  defaults: {
    apiUrl: '',
    businessSlug: '',
    printerName: '',
    printerType: 'xprinter',
    printerWidth: 80,
    autoConnect: true,
    setupComplete: false,
  },
});

let mainWindow;
let posWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Nova Agenda POS',
    backgroundColor: '#1a1a2e',
  });

  if (!store.get('setupComplete')) {
    mainWindow.loadFile(path.join(__dirname, 'setup', 'index.html'));
  } else {
    loadPosScreen();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (posWindow) posWindow.close();
  });
}

function loadPosScreen() {
  const apiUrl = store.get('apiUrl');
  const slug = store.get('businessSlug');
  if (!apiUrl || !slug) {
    mainWindow.loadFile(path.join(__dirname, 'setup', 'index.html'));
    return;
  }
  mainWindow.loadURL(`${apiUrl.replace(/\/$/, '')}/pos-embed?slug=${slug}`);
}

function createPosWindow() {
  const apiUrl = store.get('apiUrl');
  const slug = store.get('businessSlug');
  if (!apiUrl || !slug) return;

  posWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: `POS - ${slug}`,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  posWindow.loadURL(`${apiUrl.replace(/\/$/, '')}/pos-embed?slug=${slug}`);
  posWindow.on('closed', () => { posWindow = null; });
}

ipcMain.handle('store:get', (event, key) => store.get(key));

ipcMain.handle('store:set', (event, key, value) => {
  store.set(key, value);
  return true;
});

ipcMain.handle('setup:complete', () => {
  store.set('setupComplete', true);
  loadPosScreen();
  return true;
});

ipcMain.handle('setup:restart', () => {
  store.set('setupComplete', false);
  mainWindow.loadFile(path.join(__dirname, 'setup', 'index.html'));
  return true;
});

ipcMain.handle('printer:list', async () => {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    if (process.platform === 'win32') {
      exec('wmic printer get Name,PortName,DriverName /format:csv', (err, stdout) => {
        if (err) return resolve([]);
        const lines = stdout.trim().split('\n').filter(Boolean);
        if (lines.length < 2) return resolve([]);
        const headers = lines[0].split(',');
        const printers = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',');
          const printer = {};
          headers.forEach((h, idx) => {
            printer[h.trim()] = (values[idx] || '').trim();
          });
          if (printer.Name) {
            printers.push({
              name: printer.Name,
              port: printer.PortName || '',
              driver: printer.DriverName || '',
            });
          }
        }
        resolve(printers);
      });
    } else {
      exec('lpstat -p 2>/dev/null || echo ""', (err, stdout) => {
        if (err) return resolve([]);
        const printers = stdout.split('\n')
          .filter(l => l.startsWith('printer '))
          .map(l => ({
            name: l.split(' ')[1],
            port: '',
            driver: '',
          }));
        resolve(printers);
      });
    }
  });
});

ipcMain.handle('printer:test', async (event, printerName) => {
  return new Promise((resolve) => {
    const testReceipt = '\x1B\x40' +
      '\x1B\x61\x01' +
      '\x1B\x21\x10' +
      'NOVA AGENDA POS\n' +
      '\x1B\x21\x00' +
      '================================\n' +
      '  Impresora configurada OK\n' +
      '  ' + new Date().toLocaleString('es-MX') + '\n' +
      '================================\n' +
      '\x1B\x64\x02\n' +
      '\x1D\x56\x00\n';

    if (process.platform === 'win32') {
      const tmpFile = path.join(app.getPath('temp'), 'pos_test.txt');
      fs.writeFileSync(tmpFile, testReceipt, 'binary');
      exec(`print /d:"${printerName}" "${tmpFile}"`, (err) => {
        setTimeout(() => {
          try { fs.unlinkSync(tmpFile); } catch {}
        }, 2000);
        resolve({ ok: !err, error: err?.message || null });
      });
    } else {
      const tmpFile = path.join(app.getPath('temp'), 'pos_test.txt');
      fs.writeFileSync(tmpFile, testReceipt, 'binary');
      exec(`lp -d "${printerName}" "${tmpFile}"`, (err) => {
        setTimeout(() => {
          try { fs.unlinkSync(tmpFile); } catch {}
        }, 2000);
        resolve({ ok: !err, error: err?.message || null });
      });
    }
  });
});

ipcMain.handle('printer:installXprinter', async () => {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      return resolve({ ok: false, error: 'La instalación automática solo está disponible en Windows.' });
    }

    const driverDir = path.join(app.getPath('temp'), 'xprinter_driver');
    const driverUrl = 'https://github.com/novagenda/xprinter-drivers/raw/main/XP-N160II_Driver.zip';

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Instalar impresora XPrinter',
      message: 'Se abrirá el asistente de impresoras de Windows.',
      detail: 'Si tienes el CD o descargaste los drivers de XPrinter, selecciónalos ahora.\n\nSi no tienes los drivers, descárgalos de:\nhttps://www.xprintertech.com/downloads',
      buttons: ['Abrir asistente', 'Cancelar'],
    }).then(({ response }) => {
      if (response === 0) {
        exec('control printers', (err) => {
          resolve({ ok: !err, error: err?.message || null });
        });
      } else {
        resolve({ ok: false, error: 'Cancelado por el usuario' });
      }
    });
  });
});

ipcMain.handle('printer:printReceipt', async (event, receiptData) => {
  const printerName = store.get('printerName');
  if (!printerName) return { ok: false, error: 'No hay impresora configurada' };

  const width = store.get('printerWidth') || 80;
  const lineLen = width === 58 ? 32 : 48;

  function center(text) {
    const pad = Math.max(0, Math.floor((lineLen - text.length) / 2));
    return ' '.repeat(pad) + text;
  }

  function line(char = '='.repeat(lineLen)) {
    return char;
  }

  let receipt = '\x1B\x40';
  receipt += '\x1B\x61\x01';
  receipt += '\x1B\x21\x10';
  receipt += center(receiptData.businessName || 'NOVA AGENDA') + '\n';
  receipt += '\x1B\x21\x00';
  receipt += center(receiptData.subtitle || 'Punto de Venta') + '\n';
  receipt += line() + '\n';
  receipt += `Fecha: ${new Date().toLocaleString('es-MX')}\n`;
  receipt += `Ticket: ${receiptData.ticketId || '---'}\n`;
  if (receiptData.cashier) receipt += `Cajero: ${receiptData.cashier}\n`;
  receipt += line() + '\n';

  for (const item of (receiptData.items || [])) {
    const qty = `${item.quantity}x`;
    const name = item.name.substring(0, lineLen - 18);
    const price = `$${item.total.toFixed(2)}`;
    receipt += `${qty} ${name}${' '.repeat(Math.max(1, lineLen - qty.length - name.length - price.length))}${price}\n`;
  }

  receipt += line() + '\n';
  if (receiptData.discount > 0) {
    receipt += `Descuento:     -$${receiptData.discount.toFixed(2)}\n`;
  }
  receipt += '\x1B\x21\x08';
  receipt += `TOTAL:         $${receiptData.total.toFixed(2)}\n`;
  receipt += '\x1B\x21\x00';
  receipt += line() + '\n';
  receipt += `Pago: ${receiptData.paymentMethod || '---'}\n`;
  if (receiptData.received) {
    receipt += `Recibido: $${receiptData.received.toFixed(2)}\n`;
    receipt += `Cambio:   $${(receiptData.received - receiptData.total).toFixed(2)}\n`;
  }
  receipt += line() + '\n';
  receipt += '\x1B\x61\x01';
  receipt += (receiptData.footer || '¡Gracias por su compra!') + '\n';
  receipt += '\x1B\x64\x02';
  receipt += '\x1D\x56\x00';

  return new Promise((resolve) => {
    const tmpFile = path.join(app.getPath('temp'), `receipt_${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, receipt, 'binary');
    if (process.platform === 'win32') {
      exec(`print /d:"${printerName}" "${tmpFile}"`, (err) => {
        setTimeout(() => { try { fs.unlinkSync(tmpFile); } catch {} }, 2000);
        resolve({ ok: !err, error: err?.message || null });
      });
    } else {
      exec(`lp -d "${printerName}" "${tmpFile}"`, (err) => {
        setTimeout(() => { try { fs.unlinkSync(tmpFile); } catch {} }, 2000);
        resolve({ ok: !err, error: err?.message || null });
      });
    }
  });
});

ipcMain.handle('openExternal', (event, url) => {
  shell.openExternal(url);
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
