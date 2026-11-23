# ¿Qué dibujo hoy?

Una página sencilla para los días en que no sabes qué dibujar. Te propone un tema y una foto de referencia, y va rotando entre siete categorías:

**objeto → planta → rostro → pose → animal → edificio → paisaje** → vuelta a empezar.

## Qué hace

- **Rotación:** siempre marca la categoría que «toca». Si un día prefieres otra, la eliges arriba; la rotación no se mueve hasta que dibujes la que toca.
- **Técnica:** lápiz, lápices de colores o acuarela. Cada una ajusta la búsqueda de fotos (blanco y negro y luz marcada, colores vivos, luz suave) y trae un consejo.
- **Complejidad:** sencillo, medio o detallado, con temas distintos para cada nivel.
- **Fotos de referencia** desde API abiertas: [Openverse](https://openverse.org) y [Wikimedia Commons](https://commons.wikimedia.org), sin clave. Opcionalmente, con una clave gratuita de [Pexels](https://www.pexels.com/api/) busca primero allí.
- **Ver valores:** muestra la foto en escala de grises para estudiar luces y sombras.
- **Ideas absurdas:** fuera de la rotación, sin foto («un plátano en patines», «una taza con bigote»…).
- **Sincronización opcional** entre dispositivos con un usuario y contraseña (ver más abajo).
- **Historial** con la foto de cada dibujo y **contador** por categoría.
- Botón para buscar más referencias en Pinterest.

Por defecto todo se guarda en el navegador (`localStorage`). Si configuras el backend de `server/`, puedes crear un usuario y el historial se sincroniza entre dispositivos.

## Usarla

La web es un único archivo, `server/public/index.html`, sin dependencias ni compilación. El servidor de Railway la sirve en su dirección raíz, junto a la API: `https://que-dibujo-hoy-production.up.railway.app`.

- **En local:** abre `server/public/index.html` con doble clic (necesita conexión para las fotos y, si quieres sincronizar, para el backend).
- **Alternativa sin servidor:** el mismo archivo funciona en GitHub Pages u otro hosting estático.

## Sincronización (backend en Railway)

La carpeta `server/` es una API pequeña (Node + Express + Postgres) con usuario/contraseña e historial. Sin ella la web funciona igual, solo en local.

1. En Railway: *New Project → Deploy from GitHub repo* y elige este repositorio. En el servicio, *Settings → Root Directory* = `server`.
2. Añade un **Postgres** al proyecto (*New → Database → PostgreSQL*) y en el servicio de la API crea la variable `DATABASE_URL` con referencia `${{Postgres.DATABASE_URL}}`.
3. Variables del servicio: `JWT_SECRET` (una cadena larga y aleatoria, p. ej. `openssl rand -hex 32`) y, solo si sirves la web desde otro dominio, `ALLOWED_ORIGIN` (por defecto `https://diegociborro99-bot.github.io`; admite varios separados por comas). Si la web se abre desde la propia dirección de Railway no hace falta.
4. *Settings → Networking → Generate Domain* y copia la URL pública.
5. En `server/public/index.html`, pon esa URL en `const API_URL='...'`. Aparecerá el bloque «Sincronizar entre dispositivos» al final de la página.

Las tablas se crean solas al arrancar. Para probar en local: `cd server && npm i && TEST_DATABASE_URL=postgres://… npm test`.

**Cómo se fusiona:** los dibujos se unen por identificador, así que no se pierde ninguno entre dispositivos. «Borrar historial» deja una marca de fecha para que otro dispositivo no lo recupere. La categoría que toca gana por el cambio más reciente.

## Créditos

Las fotos pertenecen a sus autores y se muestran con su licencia y un enlace al original.
