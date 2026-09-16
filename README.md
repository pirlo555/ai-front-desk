# Dental Leads Agent

Asistente bilingüe (inglés/español) para clínicas dentales en EE. UU.:

- **Chat en la web de la clínica**: responde preguntas, califica al paciente y toma su solicitud de cita.
- **SMS por llamada perdida**: si nadie contesta, le escribe al paciente por mensaje de texto y sigue la conversación.
- **Panel de recepción** (`/dashboard`): la clínica ve los leads, lee las conversaciones y marca su estado.
- **Avisos a recepción** por SMS cuando entra un lead nuevo, urgente o una solicitud de cita (sin datos del paciente en el SMS).

Las citas quedan como **solicitud**: el asistente nunca dice que está confirmada. Recepción la confirma.

---

## Cómo arrancarlo en tu computadora

1. Abre una terminal en `D:\dental-leads-agent`.
2. Si es la primera vez: `npm install`
3. Arranca: `npm start`
4. Abre en el navegador:
   - Web de prueba con el chat: http://localhost:3000/demo/brisa
   - Simulador de SMS: http://localhost:3000/simulator
   - Panel de recepción: http://localhost:3000/dashboard (clínica `brisa`, contraseña en el archivo `.env`, línea `CLINIC_BRISA_PASSWORD`)

Para apagarlo: `Ctrl + C` en la terminal.

## Configuración (archivo `.env`)

| Variable | Qué es |
|---|---|
| `ANTHROPIC_API_KEY` | Clave de Claude. Sin ella, el asistente solo manda un mensaje de "recepción le contactará". |
| `CLINIC_<ID>_PASSWORD` | Contraseña del panel de cada clínica. |
| `SESSION_SECRET` | Texto aleatorio para proteger los inicios de sesión. Ya viene generado. |
| `MOCK_SMS` | `true` = modo prueba (no se envían SMS). `false` = SMS reales con Twilio. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Credenciales de Twilio (solo con `MOCK_SMS=false`). |
| `PUBLIC_BASE_URL` | Dirección pública del servidor cuando esté en internet. |

**Nunca compartas el archivo `.env`.**

## Añadir una clínica nueva

1. Copia `clinics/brisa.json` con otro nombre, por ejemplo `clinics/sonrisa.json`.
2. Cambia `id`, nombre, horario, seguros, ofertas, saludos, `twilioNumber` (su número de Twilio), `frontDeskPhone` (el celular de recepción) y `allowedOrigins` (la web de la clínica, por ejemplo `https://sonrisadental.com`).
3. Añade su contraseña en `.env`: `CLINIC_SONRISA_PASSWORD=...`
4. Reinicia el servidor.

## Instalar el chat en la web de una clínica

La clínica pega esta línea en su página web (antes de `</body>`):

```html
<script src="https://TU-SERVIDOR/widget.js" data-clinic="sonrisa" defer></script>
```

## Conectar Twilio (SMS reales)

1. Compra un número de Twilio para la clínica y regístralo para SMS (A2P 10DLC).
2. En el número, configura:
   - **A call comes in** → `POST https://TU-SERVIDOR/twilio/voice/<id-clinica>`
   - **A message comes in** → `POST https://TU-SERVIDOR/twilio/sms/<id-clinica>`
3. En la compañía telefónica de la clínica, activa **desvío de llamadas cuando no contestan / ocupado** hacia el número de Twilio.
4. En `.env`: `MOCK_SMS=false`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` y `PUBLIC_BASE_URL`.

Twilio necesita una dirección pública (https), así que esto se prueba cuando el servidor esté en internet.

## Antes de usarlo con pacientes reales (HIPAA)

- Firma un **BAA** con la clínica y usa proveedores que firmen BAA contigo (Twilio, Anthropic, hosting/base de datos).
- Pon el servidor en un hosting compatible con HIPAA y con copias de seguridad de `data/app.db`.
- Revisa el contrato y los textos de consentimiento de SMS con un abogado.

## Estructura

```
clinics/          Configuración de cada clínica (JSON)
public/           Chat (widget.js), panel, simulador y web de prueba
src/agent.js      Instrucciones y llamada a Claude
src/conversation.js  Flujo de cada mensaje, leads y avisos
src/db.js         Base de datos (SQLite en data/app.db)
src/routes/       Rutas: chat, panel, Twilio y simulador
```
