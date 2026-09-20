# AI Front Desk — recepcionista bilingüe para negocios locales

Asistente bilingüe (inglés/español) que contesta por el chat de la web del negocio
y por SMS cuando nadie coge el teléfono. Captura el nombre, qué necesita la persona
y cuándo quiere la cita, y avisa a recepción. Funciona para **cualquier negocio local**:
clínicas dentales, consultas médicas, fontaneros y aire acondicionado, talleres y abogados.

## Qué hace

- **Llamada perdida → mensaje de texto.** Si nadie contesta, el sistema le escribe al
  que llamó en segundos y sigue la conversación por SMS.
- **Chat en la web del negocio.** Una sola línea de código en su página.
- **Habla español e inglés** y responde en el idioma de la persona.
- **Panel de recepción** con los contactos nuevos, lo que necesitan y su urgencia.
- **Alertas por SMS** a recepción cuando entra un contacto urgente o hace falta una persona.

## Sectores incluidos

Cada negocio elige uno en su archivo con el campo `vertical`. El sector decide qué datos
pide el asistente, cómo se etiquetan los trabajos en el panel y qué reglas de seguridad aplica.

| `vertical` | Para quién | Dato clave que pide |
|---|---|---|
| `dental` | Clínicas dentales | Seguro médico |
| `medical` | Consultas médicas y med spas | Seguro médico |
| `home_services` | Fontanería, aire acondicionado, electricidad, techos, cerrajería | Dirección del servicio |
| `auto` | Talleres mecánicos | Vehículo (año, marca, modelo) |
| `legal` | Despachos de abogados | Ciudad y estado del caso |
| `general` | Cualquier otro negocio local | Ninguno |

Cada sector trae sus **reglas de seguridad** propias. Por ejemplo: el dental nunca
diagnostica y manda al 911 ante una infección grave; el de abogados nunca da consejo legal
ni dice si alguien tiene caso; el de fontanería manda salir de la casa si huele a gas.

## Poner en marcha

```bash
npm install
npm run dev
```

Se abre en <http://localhost:3000>:

- **Panel de recepción** — <http://localhost:3000/dashboard>
- **Web de prueba de cada negocio** — `/demo/brisa`, `/demo/rapido-air`, `/demo/costa-legal`
- **Simulador de SMS** — <http://localhost:3000/simulator> (solo en modo prueba)

Las claves van en el archivo `.env`. Copia `.env.example` a `.env` y rellénalo.
Sin `ANTHROPIC_API_KEY` todo funciona igual, pero el asistente solo manda una
respuesta genérica en lugar de conversar.

## Añadir un cliente nuevo

1. Copia `businesses/_template.json` y ponle el nombre del negocio, por ejemplo `mi-taller.json`.
2. Rellena los datos. El archivo `_template.json` explica cada campo por dentro.
3. Añade la contraseña del panel a `.env`:
   `BUSINESS_MI_TALLER_PASSWORD=algo-largo-y-dificil`
   (el `id` en mayúsculas, con guiones convertidos en guiones bajos)
4. Reinicia el servidor.

Ya tiene su panel, su web de prueba y su chat. No hay que tocar código.

Para poner el chat en la web real del cliente, él añade esta línea a su página:

```html
<script src="https://TU-SERVIDOR/widget.js" data-business="mi-taller" defer></script>
```

y tú añades su dominio a `allowedOrigins` en su archivo JSON.

## Modo prueba y modo real

`MOCK_SMS=true` en `.env` (lo normal mientras desarrollas): no se manda ningún SMS de
verdad. Todo queda guardado y se ve en el simulador.

`MOCK_SMS=false`: se mandan SMS reales por Twilio. Necesita `TWILIO_ACCOUNT_SID`
y `TWILIO_AUTH_TOKEN`, y que cada negocio tenga su `twilioNumber`.

En Twilio, para cada número:
- **A call comes in** → `https://TU-SERVIDOR/twilio/voice/<id-del-negocio>`
- **A message comes in** → `https://TU-SERVIDOR/twilio/sms/<id-del-negocio>`

## Cómo está organizado

```
businesses/          un archivo JSON por cliente (_template.json es la plantilla)
src/verticals.js     los sectores: qué pide cada uno y sus reglas de seguridad
src/config.js        lee y valida los archivos de negocio
src/agent.js         construye las instrucciones y habla con Claude
src/conversation.js  la lógica de una conversación: bajas, avisos, contactos
src/db.js            base de datos SQLite
src/routes/          chat web, webhooks de Twilio, panel, simulador
public/              panel, widget de chat, webs de prueba, simulador
```

## Seguridad

- Cada negocio solo ve lo suyo: el panel filtra siempre por negocio.
- Los webhooks de Twilio se verifican con firma cuando el modo real está activo.
- Límite de mensajes por minuto en el chat y en los intentos de login.
- El asistente nunca pide número de seguro social, fecha de nacimiento ni tarjetas.
- Las bajas por SMS (STOP / BAJA) se respetan y quedan guardadas.

## Pendiente

- Voz: que el asistente conteste el teléfono hablando, no solo con SMS.
- Conexión con la agenda real (Google Calendar) para confirmar citas de verdad.
- Recordatorios y seguimiento automático.
- Cobro de suscripciones.
