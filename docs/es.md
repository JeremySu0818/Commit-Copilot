# Información de actualización de Commit Copilot

## Novedades de la versión 1.14.0

- Soporte para el modo proxy de Ollama: Se introdujeron protocolos de herramientas de agentes de texto para eliminar el mecanismo de respaldo obligatorio de Direct Diff, y se añadió soporte para abortar el progreso de descarga (Pull) del modelo de Ollama al cancelar la generación.
- Soporte para proveedores personalizados de Anthropic: Se permite configurar endpoints personalizados con el formato de la API de Anthropic y establecer los tokens de salida máximos, además de optimizar el orden de entrada de los nuevos campos y migrar automáticamente las configuraciones anteriores.
- Modularización de la arquitectura central: Se dividieron componentes clave como la orquestación de generación, las operaciones de Git, la gestión de modelos y los protocolos de webview en módulos independientes, y se modularizaron los prompts de idioma para mejorar el rendimiento de carga.
- Simplificación de los nombres de visualización de proveedores: Se corrigieron las etiquetas de los proveedores integrados para mostrar nombres más limpios.
- Corrección de etiquetas de idioma en la interfaz: Se cambió la etiqueta de acción del selector de modelos de "Agregar modelo" a "Administrar modelos..." para que coincida mejor con la pantalla de la función.
- Actualización y optimización de la documentación de README.md y de los ejemplos de configuración.
