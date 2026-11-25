# Asistente personal de LEGAL-OS

Aplicación personal para organizar citas, audiencias y juntas; asociar pendientes a expedientes; y generar cotizaciones de honorarios por etapas.

## Requisitos

- Node.js 20.19+ o 22.12+
- npm

## Inicio

```powershell
cd apps\asistente-personal
npm install
npm run dev
```

La aplicación se ejecuta localmente en el navegador. Los datos se guardan en `localStorage` del dispositivo y perfil del navegador actuales. Usa **Exportar respaldo** para descargar una copia JSON; importar un respaldo reemplaza los datos locales actuales.

Al abrirla en el mismo origen del gestor anterior, migra automáticamente expedientes (`exp_mgz`), audiencias (`aud_mgz`) y cotizaciones (`cot_mgz`) guardados previamente.

## Avisos

Activa **Activar avisos** para permitir notificaciones del navegador. Los avisos se evalúan mientras la aplicación está abierta; el navegador puede requerir `localhost` o HTTPS. No es un servicio de alarmas en segundo plano y no enviará notificaciones si la aplicación se cierra.

## Pruebas y compilación

```powershell
npm test
npm run build
```

Las cotizaciones son borradores y deben revisarse antes de enviarse, en particular los importes, el alcance del servicio y el tratamiento del IVA.
