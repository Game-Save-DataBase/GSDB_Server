const fs = require('fs');
const path = require('path');
const config = require('../utils/config');

function createAssetsFolders() {
    const requiredPaths = [
        config.paths.assetsFolder,
        config.paths.uploads,
        config.paths.userProfiles,
        config.paths.defaultsInAssetsFolder
    ];
    console.log("comprobando carpeta de assets...")
    for (const p of requiredPaths) {
        const absPath = path.join(process.cwd(), p);
        if (!fs.existsSync(absPath)) {
            console.log(`No existe ${absPath}, creando...`);
            fs.mkdirSync(absPath, { recursive: true });
        }
    }

    // Carpeta default dentro del repo (local o prod)
    if (config.paths.default) {
        const defaultsSrc = path.join(process.cwd(), config.paths.default);
        const defaultsDest = path.join(process.cwd(), config.paths.defaultsInAssetsFolder);

        if (fs.existsSync(defaultsSrc)) {
            const files = fs.readdirSync(defaultsSrc);
            for (const f of files) {
                const destFile = path.join(defaultsDest, f);
                if (!fs.existsSync(destFile)) {
                    console.log(`Copiando archivo ${destFile}...`)
                    fs.copyFileSync(path.join(defaultsSrc, f), destFile);
                }
            }
        } else {
            console.warn(` Carpeta default no encontrada en ${defaultsSrc}`);
        }
    }
}

module.exports = { createAssetsFolders };
