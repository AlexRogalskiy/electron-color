//
const electron = require ('electron');
const { app, BrowserWindow, clipboard, dialog, globalShortcut, ipcMain, Menu, shell } = electron;
//
let mainWindow = null;
//
const gotTheLock = app.requestSingleInstanceLock ();
if (!gotTheLock)
{
    app.quit ();
}
else
{
    app.on
    (
        'second-instance',
        (event, commandLine, workingDirectory) =>
        {
            if (mainWindow)
            {
                if (mainWindow.isMinimized ())
                {
                    mainWindow.restore ();
                }
                mainWindow.show ();
            }
        }
    );
    //
    // Share settings with the renderer process
    global.settings = require ('./settings.json');
    //
    if (!settings.accelerated)
    {
        app.disableHardwareAcceleration ();
    }
    //
    const fs = require ('fs');
    const os = require ('os');
    const path = require ('path');
    //
    const isPackaged = !process.defaultApp;
    //
    const appName = app.name;
    const appVersion = app.getVersion ();
    const appDate = (isPackaged ? fs.statSync (process.resourcesPath).ctime : new Date ()).toISOString ();
    //
    let appDirname = app.getAppPath ();
    let unpackedDirname = `${appDirname}.unpacked`;
    if (!fs.existsSync (unpackedDirname))
    {
        unpackedDirname = appDirname;
    };
    //
    function showAboutBox (menuItem, browserWindow, event)
    {
        let options =
        {
            type: 'info',
            message: `${appName}`,
            detail: `${settings.description}\n${settings.copyright}\n\nVersion: ${appVersion}\nDate: ${appDate}`,
            buttons: [ "OK" ]
        };
        dialog.showMessageBox ((process.platform === 'darwin') ? null : browserWindow, options);
    }
    //
    let licenseWindow = null;
    //
    function showLicense (menuItem, browserWindow, event)
    {
        if (!licenseWindow)
        {
            licenseWindow = new BrowserWindow
            (
                {
                    title: `License | ${appName}`,
                    width: 384,
                    height: (process.platform !== 'darwin') ? 480 : 540,
                    parent: browserWindow,
                    minimizable: false,
                    maximizable: false,
                    resizable: false,
                    fullscreenable: false,
                    show: false
                }
            );
            if (process.platform !== 'darwin')
            {
                licenseWindow.removeMenu ();
            }
            licenseWindow.loadFile (path.join (__dirname, 'license-index.html'));
            licenseWindow.once ('ready-to-show', () => { licenseWindow.show (); });
            licenseWindow.on ('close', () => { licenseWindow = null; });
        }
        else
        {
            licenseWindow.show ();
        }
    }
    //
    function copySystemInfo ()
    {
        const infos =
        [
            "-- Application --",
            "",
            [ "Name", appName ],
            [ "Version", appVersion ],
            [ "Date", appDate ],
            "",
            [ "Locale", app.getLocale () ],
            [ "Packaged", app.isPackaged ],
            "",
            "-- Framework --",
            "",
            [ "System Version", process.getSystemVersion () ],
            [ "Platform", process.platform ],
            [ "Architecture", process.arch ],
            [ "Default App", process.defaultApp || false ],
            [ "Mac App Store App", process.mas || false ],
            [ "Windows Store App", process.windowsStore || false ],
            [ "Electron Version", process.versions.electron ],
            [ "Node Version", process.versions.node ],
            [ "V8 Version", process.versions.v8 ],
            [ "Chromium Version", process.versions.chrome ],
            [ "ICU Version", process.versions.icu ],
            [ "Unicode Version", process.versions.unicode ],
            // [ "CLDR Version", process.versions.cldr ],
            // [ "Time Zone Version", process.versions.tz ],
            "",
            "-- Operating System --",
            "",
            [ "OS Type", os.type () ],
            [ "OS Platform", os.platform () ],
            [ "OS Release", os.release () ],
            [ "CPU Architecture", os.arch () ],
            [ "CPU Endianness", os.endianness () ],
            [ "CPU Logical Cores", os.cpus ().length ],
            [ "CPU Model", os.cpus ()[0].model ],
            [ "CPU Speed (MHz)", os.cpus ()[0].speed ]
        ];
        let systemInfo = infos.map (info => (Array.isArray (info) ? `${info[0]}: ${info[1]}` : info) + "\n").join ("");
        clipboard.writeText (systemInfo);
    }
    //
    let defaultWidth;
    let defaultHeight;
    //
    function resetWindow ()
    {
        if (mainWindow.isFullScreen ())
        {
            shell.beep ();
        }
        else
        {
            if (mainWindow.isMaximized ())
            {
                mainWindow.unmaximize ();
            }
            mainWindow.setSize (defaultWidth, defaultHeight);
            mainWindow.center ();
            if (mainWindow.isMinimized ())
            {
                mainWindow.restore ();
            }
        }
    }
    //
    const darwinAppMenu =
    {
        label: appName,
        submenu:
        [
            { label: `About ${appName}...`, click: showAboutBox },
            { type: 'separator' },
            { role: 'services', submenu: [ ] },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideothers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
        ]
    };
    const appMenu =
    {
        label: settings.shortAppName,
        submenu:
        [
            { role: 'quit' }
        ]
    };
    const editMenu =
    {
        label: "Edit",
        submenu:
        [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { role: 'delete' },
            { type: 'separator' },
            { role: 'selectall' }
        ]
    };
    const fileMenu =
    {
        label: "File",
        submenu:
        [
            { label: "Load Formula...", accelerator: 'CommandOrControl+L', click: () => { mainWindow.webContents.send ('load-formula'); } },
            { label: "Save Formula...", accelerator: 'CommandOrControl+S', click: () => { mainWindow.webContents.send ('save-formula'); } },
            { type: 'separator' },
            {
                label: "Import",
                submenu:
                [
                    { label: "Color Ramp (.json)...", click: () => { mainWindow.webContents.send ('import-color-ramp'); } },
                    { label: "Color Table (.act)...", click: () => { mainWindow.webContents.send ('import-color-table'); } },
                    { label: "Curves Map (.amp)...", click: () => { mainWindow.webContents.send ('import-curves-map'); } },
                    { label: "Lookup Table (.lut)...", click: () => { mainWindow.webContents.send ('import-lookup-table'); } }
                ]
            },
            {
                label: "Export",
                submenu:
                [
                    { label: "Color Ramp (.json)...", enabled: false, click: () => { mainWindow.webContents.send ('export-color-ramp'); } },
                    { label: "Color Palette (.json)...", enabled: false, click: () => { mainWindow.webContents.send ('export-color-palette'); } }
                ]
            }
        ]
    };
    const viewMenu =
    {
        label: "View",
        submenu:
        [
            { label: "Scroll to Top", accelerator: 'CommandOrControl+T', click: () => { mainWindow.webContents.send ('scroll-to-top'); } },
            { label: "Scroll to Bottom", accelerator: 'CommandOrControl+B', click: () => { mainWindow.webContents.send ('scroll-to-bottom'); } },
            { type: 'separator' },
            { label: "Actual Size", accelerator: 'CommandOrControl+0', click: () => { mainWindow.webContents.send ('reset-zoom'); } },
            { label: "Zoom In", accelerator: 'CommandOrControl+Plus', click: () => { mainWindow.webContents.send ('zoom-in'); } },
            { label: "Zoom Out", accelerator: 'CommandOrControl+-', click: () => { mainWindow.webContents.send ('zoom-out'); } },
            { type: 'separator' },
            { role: 'togglefullscreen' }
        ]
    };
    const developerMenu =
    {
        label: "Developer",
        submenu:
        [
            { role: 'reload' },
            { role: 'toggledevtools' },
            { type: 'separator' },
            { label: "Open User Data Directory", click: () => { shell.openItem (app.getPath ('userData')); } },
            { label: "Open Temporary Directory", click: () => { shell.openItem (app.getPath ('temp')); } },
            { type: 'separator' },
            { label: "Show Executable File", click: () => { shell.showItemInFolder (app.getPath ('exe')); } },
            { type: 'separator' },
            { label: "Copy System Info to Clipboard", click: copySystemInfo }
        ]
    };
    const darwinWindowMenu =
    {
        role: 'window',
        submenu:
        [
            { role: 'close' },
            { role: 'minimize' },
            { role: 'zoom' },
            { type: 'separator' },
            { label: "Reset to Default", accelerator: 'CommandOrControl+D', click: () => { resetWindow (); } },
            { type: 'separator' },
            { role: 'front' }
        ]
    };
    const windowMenu =
    {
        label: "Window",
        submenu:
        [
            { role: 'minimize' },
            { role: 'close' },
            { type: 'separator' },
            { label: "Reset to Default", accelerator: 'CommandOrControl+D', click: () => { resetWindow (); } }
         ]
    };
    const darwinHelpMenu =
    {
        role: 'help',
        submenu:
        [
            { label: "License...", click: showLicense },
            { type: 'separator' },
            { label: "Documentation", click: () => { shell.openItem (path.join (unpackedDirname, 'doc', 'index.html')); } },
            { label: "Formula Format", click: () => { shell.openItem (path.join (unpackedDirname, 'doc', 'formula.html')); } },
            { type: 'separator' },
            { label: settings.repository.label, click: () => { shell.openExternal (settings.repository.URL); } },
            { label: settings.releases.label, click: () => { shell.openExternal (settings.releases.URL); } }
        ]
    };
    const helpMenu =
    {
        label: 'Help',
        submenu:
        [
            { label: "About...", click: showAboutBox },
            { label: "License...", click: showLicense },
            { type: 'separator' },
            { label: "Documentation", click: () => { shell.openItem (path.join (unpackedDirname, 'doc', 'index.html')); } },
            { label: "Formula Format", click: () => { shell.openItem (path.join (unpackedDirname, 'doc', 'formula.html')); } },
            { type: 'separator' },
            { label: settings.repository.label, click: () => { shell.openExternal (settings.repository.URL); } },
            { label: settings.releases.label, click: () => { shell.openExternal (settings.releases.URL); } }
        ]
    };
    //
    let menuTemplate = [ ];
    menuTemplate.push ((process.platform === 'darwin') ? darwinAppMenu : appMenu);
    menuTemplate.push (fileMenu);
    menuTemplate.push (editMenu);
    menuTemplate.push (viewMenu);
    if ((!isPackaged) || settings.developerFeatures)
    {
        menuTemplate.push (developerMenu);
    }
    menuTemplate.push ((process.platform === 'darwin') ? darwinWindowMenu : windowMenu);
    menuTemplate.push ((process.platform === 'darwin') ? darwinHelpMenu : helpMenu);
    //
    let menu;
    //
    function onAppReady ()
    {
        menu = Menu.buildFromTemplate (menuTemplate);
        Menu.setApplicationMenu (menu);
        //
        const Storage = require ('./lib/storage.js');
        const mainStorage = new Storage ('main-preferences');
        //
        const { screen } = electron;
        let workAreaWidth = screen.getPrimaryDisplay ().workArea.width;
        let workAreaHeight = screen.getPrimaryDisplay ().workArea.height;
        //
        defaultWidth = settings.window.largerDefaultWidth;
        defaultHeight = settings.window.largerDefaultHeight;
        if ((defaultWidth > workAreaWidth) || (defaultHeight > workAreaHeight))
        {
            defaultWidth = settings.window.defaultWidth;
            defaultHeight = settings.window.defaultHeight;
        }
        //
        const defaultPrefs =
        {
            windowBounds:
            {
                width: defaultWidth,
                height: defaultHeight
            }
        };
        let prefs = mainStorage.get (defaultPrefs);
        let windowBounds = prefs.windowBounds;
        //
        mainWindow = new BrowserWindow
        (
            {
                icon: (process.platform === 'linux') && path.join (__dirname, 'icons', 'icon-256.png'),
                center: true,
                x: windowBounds.x,
                y: windowBounds.y,
                width: windowBounds.width,
                height: windowBounds.height,
                minWidth: settings.window.minWidth,
                minHeight: settings.window.minHeight,
                backgroundColor: settings.window.backgroundColor,
                show: !settings.window.deferredShow,
                webPreferences:
                {
                    nodeIntegration: true
                }
            }
        );
        //
        mainWindow.loadFile (path.join (__dirname, 'renderer', 'index.html'));
        //
        mainWindow.webContents.on ('will-navigate', (event) => { event.preventDefault (); }); // Inhibit drag-and-drop of URL on window
        //
        mainWindow.once ('close', () => { mainStorage.set ({ windowBounds: mainWindow.getBounds () }); });
        //
        mainWindow.once ('closed', () => { if (process.platform === 'darwin') { app.hide (); } app.quit (); });
        //
        ipcMain.on ('show-window', () => { mainWindow.show (); });
        //
        if (settings.escapeExitsFullScreen)
        {
            ipcMain.on
            (
                'exit-full-screen',
                () =>
                {
                    if (mainWindow.isFullScreen ())
                    {
                        mainWindow.setFullScreen (false);
                    }
                    else
                    {
                        // shell.beep ();
                    }
                }
            );
        }
        //
        if (settings.hotKey)
        {
            // Set hot key
            globalShortcut.register (settings.hotKey, () => { mainWindow.show (); });
        }
    }
    //
    app.once ('ready', onAppReady);
}
//
