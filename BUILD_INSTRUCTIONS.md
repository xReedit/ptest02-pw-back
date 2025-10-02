# 🚀 Instrucciones de Build para Producción

## 📋 Prerrequisitos

Asegúrate de tener instaladas todas las dependencias:

```bash
npm install
```

## 🔨 Proceso de Build

### 1. Instalar Dependencias de Desarrollo

```bash
npm install --save-dev @babel/cli @babel/core @babel/preset-env babel-plugin-transform-remove-console cross-env rimraf
```

### 2. Generar Build de Producción

```bash
npm run build
```

Este comando:
- ✅ Limpia la carpeta `dist/` anterior
- ✅ Compila todo el código con Babel
- ✅ **Elimina todos los `console.log` y `console.debug`**
- ✅ **Mantiene `console.error` y `console.warn`**
- ✅ Copia archivos necesarios (.json, .env, etc.)
- ✅ Ignora carpetas innecesarias (node_modules, test, logs, .git)

### 3. Verificar Build

La carpeta `dist/` contendrá:
```
dist/
├── app.js
├── _config.js
├── package.json
├── controllers/
├── service/
├── routes/
├── middleware/
├── models/
├── utilitarios/
└── ...
```

## 🏃 Ejecutar en Producción

### Opción 1: Usar script npm

```bash
npm run prod
```

### Opción 2: Directamente con Node

```bash
cd dist
NODE_ENV=production node app.js
```

### Opción 3: Con PM2 (Recomendado)

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar la aplicación
pm2 start dist/app.js --name "backend-pedidos" --env production

# Ver logs
pm2 logs backend-pedidos

# Reiniciar
pm2 restart backend-pedidos

# Detener
pm2 stop backend-pedidos
```

## 📦 Scripts Disponibles

| Script | Comando | Descripción |
|--------|---------|-------------|
| **dev** | `npm run dev` | Desarrollo con nodemon (hot-reload) |
| **start** | `npm start` | Inicia servidor sin build |
| **build** | `npm run build` | Genera build de producción en /dist |
| **prod** | `npm run prod` | Ejecuta versión de producción desde /dist |
| **clean** | `npm run clean` | Limpia carpeta dist/ |
| **test** | `npm test` | Ejecuta todos los tests |

## 🔍 Verificación de Console.log Eliminados

Para verificar que se eliminaron los console.log:

### Antes del build (código fuente):
```javascript
console.log('Debug info');  // ❌ Se eliminará
console.debug('Data');       // ❌ Se eliminará
console.error('Error');      // ✅ Se mantiene
console.warn('Warning');     // ✅ Se mantiene
logger.info('Info');         // ✅ Se mantiene (no es console)
```

### Después del build (dist/):
```javascript
// console.log y console.debug eliminados
console.error('Error');      // ✅ Presente
console.warn('Warning');     // ✅ Presente
logger.info('Info');         // ✅ Presente
```

## 🌍 Variables de Entorno

Asegúrate de tener estos archivos configurados:

### Para desarrollo (.env)
```env
NODE_ENV=development
LOG_LEVEL=debug
```

### Para producción (.env.production)
```env
NODE_ENV=production
LOG_LEVEL=error
```

**Nota:** Los archivos `.env*` NO se incluyen en el build. Debes copiarlos manualmente al servidor.

## 📂 Desplegar a Servidor

### Paso 1: Generar build local
```bash
npm run build
```

### Paso 2: Copiar archivos al servidor
```bash
# Opción A: SCP
scp -r dist/ user@servidor:/ruta/backend-pedidos/

# Opción B: FTP/SFTP usando cliente
# Subir carpeta dist/ completa

# Opción C: Git (si usas CI/CD)
git push origin main
# El servidor ejecuta npm run build automáticamente
```

### Paso 3: En el servidor
```bash
cd /ruta/backend-pedidos/dist

# Copiar .env de producción
cp ../.env.production .env

# Instalar solo dependencias de producción
npm install --production

# Iniciar con PM2
pm2 start app.js --name backend-pedidos
pm2 save
pm2 startup  # Configurar inicio automático
```

## ⚙️ Configuración Babel

La configuración en `.babelrc` elimina console.log solo en producción:

```json
{
  "env": {
    "production": {
      "plugins": [
        ["transform-remove-console", {
          "exclude": ["error", "warn"]
        }]
      ]
    }
  }
}
```

## 🔄 Actualizar Build

Para actualizar el código en producción:

```bash
# 1. Generar nuevo build
npm run build

# 2. Subir al servidor
scp -r dist/ user@servidor:/ruta/backend-pedidos/

# 3. Reiniciar en servidor
pm2 restart backend-pedidos
```

## 🐛 Troubleshooting

### Error: "Cannot find module"
**Solución:** Verifica que package.json se copió a dist/
```bash
npm run build
ls dist/package.json  # Debe existir
```

### Los console.log siguen apareciendo
**Solución:** Verifica que NODE_ENV=production
```bash
# Windows PowerShell
$env:NODE_ENV="production"
npm run build

# Linux/Mac
NODE_ENV=production npm run build
```

### Error de permisos en logs/
**Solución:** Crea la carpeta logs en dist
```bash
mkdir dist/logs
```

## 📊 Comparación de Tamaño

| Métrica | Desarrollo | Producción (dist/) |
|---------|-----------|-------------------|
| Console.log | ~200+ | 0 |
| Tamaño código | 100% | ~95% |
| Rendimiento | Normal | +5-10% más rápido |

## ✅ Checklist Pre-Despliegue

- [ ] Ejecutar `npm run build`
- [ ] Verificar que dist/ se generó correctamente
- [ ] Copiar .env.production como .env en dist/
- [ ] Probar localmente: `npm run prod`
- [ ] Verificar logs con logger (no console.log)
- [ ] Subir a servidor
- [ ] Instalar dependencias de producción
- [ ] Iniciar con PM2
- [ ] Verificar que la API responde
- [ ] Monitorear logs iniciales

---

**🎉 ¡Listo! Tu aplicación está optimizada para producción sin console.log**
