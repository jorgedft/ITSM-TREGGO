# Despliegue de notificaciones push reales

Esto requiere el [Supabase CLI](https://supabase.com/docs/guides/cli) instalado
y que inicies sesión y enlaces tu proyecto. Todo esto se corre **una sola vez**.

## 1. Instalar y enlazar el CLI

```bash
npm install -g supabase
supabase login
cd C:\ITS-TREGGO
supabase link --project-ref <tu-project-ref>
```

`<tu-project-ref>` es el identificador de tu proyecto (lo ves en la URL del
dashboard de Supabase, o en Project Settings → General).

## 2. Configurar las llaves VAPID (secretas)

Estas llaves ya te las generé — **el valor de `VAPID_PRIVATE_KEY` es secreto**,
no lo pongas en ningún archivo del repo. Pídemelo en el chat si lo perdiste,
o genera un par nuevo tú mismo con `npx web-push generate-vapid-keys`.

```bash
supabase secrets set VAPID_PUBLIC_KEY=<la_llave_publica> VAPID_PRIVATE_KEY=<la_llave_privada> VAPID_SUBJECT=mailto:jorge.daniel@treggo.mx
```

La `VAPID_PUBLIC_KEY` también debe estar en el frontend: agrégala como
variable de entorno `VITE_VAPID_PUBLIC_KEY` en tu proyecto de Vercel
(Settings → Environment Variables) con el mismo valor, y vuelve a desplegar.
Localmente ya quedó en `client/.env`.

## 3. Desplegar la función

```bash
supabase functions deploy send-push
```

## 4. Crear el Database Webhook

En el dashboard de Supabase: **Database → Webhooks → Create a new webhook**

- Name: `send-push-on-notification`
- Table: `notifications`
- Events: `Insert`
- Type: `Supabase Edge Functions`
- Edge Function: `send-push`

Guarda. A partir de aquí, cada vez que se inserte una fila en `notifications`
(lo hacen los triggers de `010_notificaciones.sql`), se disparará la función
y se enviará el push real a los dispositivos suscritos del usuario.

## 5. Probar

1. En la app, abre la campanita (🔔) en la barra superior y da clic en
   "Activar notificaciones en este dispositivo" — el navegador pedirá permiso.
2. Crea un ticket nuevo con otro usuario (o cambia el `assigned_to` de un
   ticket) — debería llegar la notificación tanto en la campanita como una
   notificación real del sistema operativo, incluso con la pestaña cerrada.

Si no llega el push pero sí aparece en la campanita, revisa los logs de la
función en el dashboard (Edge Functions → send-push → Logs) para ver el error
exacto (llaves VAPID mal configuradas es la causa más común).
