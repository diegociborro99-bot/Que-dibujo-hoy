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
- **Historial** con la foto de cada dibujo y **contador** por categoría.
- Botón para buscar más referencias en Pinterest.

Todo se guarda en el navegador (`localStorage`); no hay servidor ni cuentas.

## Usarla

Es un único archivo, `index.html`, sin dependencias ni compilación.

- **En local:** abre `index.html` con doble clic (necesita conexión para las fotos).
- **En GitHub Pages:** en el repositorio, *Settings → Pages → Deploy from a branch → `main` / root*. Quedará en `https://diegociborro99-bot.github.io/Que-dibujo-hoy/`.

## Créditos

Las fotos pertenecen a sus autores y se muestran con su licencia y un enlace al original.
