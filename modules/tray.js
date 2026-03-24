const { Tray, Menu } = require('electron');
const path = require('path');
const { getWindow } = require('./window');

let tray = null;

function createTray() {
  tray = new Tray(path.join(__dirname, '..', 'assets', 'default.png'));
  const contextMenu = Menu.buildFromTemplate([
    { label: '顯示小澪', click: () => getWindow()?.show() },
    { label: '設定', click: () => getWindow()?.webContents.send('open-settings') },
    { type: 'separator' },
    { label: '退出', click: () => require('electron').app.quit() },
  ]);
  tray.setToolTip('小澪桌寵');
  tray.setContextMenu(contextMenu);
}

module.exports = { createTray };
