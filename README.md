# Prototipo Innovacion 2

Aplicacion local para administrar y organizar un negocio de suministros como alimentos, higiene, proveedores, ventas y reportes, sin depender de internet, la nube ni suscripciones.

## Acceso

- Usuario: `Admin`
- Contraseña: `InnovaAdmin`

## Estructura

- `Backend`: API local con SQLite, exportacion/importacion Excel y manejo de documentos.
- `Front end`: interfaz React con inicio de sesion, panel lateral y vistas independientes para cada modulo.
- `Front end/src-tauri`: base preparada para empaquetar la aplicacion con Tauri mas adelante.

## Modulos

- `Productos`
- `Proveedores`
- `Valores de Productos`
- `Ventas`
- `Reportes`
- `Documentos`

## Funciones principales

- Inicio de sesion local con credenciales fijas.
- Navegacion por vistas separadas, una por modulo.
- Carga de archivos Excel para importar registros.
- Descarga de Excel por modulo.
- Carga y descarga de documentos e imagenes.

## Ejecucion local

1. Instala dependencias en `Backend`.
2. Instala dependencias en `Front end`.
3. Ejecuta primero el backend y luego el frontend.

Ejemplo:

```powershell
cd Backend
npm install
npm run dev
```

```powershell
cd "Front end"
npm install
npm run dev
```

La interfaz queda disponible en `http://localhost:5173` y la API en `http://localhost:3001`.

## Tauri

La base de Tauri ya queda lista en `Front end/src-tauri`. Cuando quieran generar el ejecutable, se puede conectar esa carpeta con el build de Vite.
