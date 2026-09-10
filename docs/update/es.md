# Información de actualización de Commit Copilot

## Novedades de la versión 1.20.0

- Se deshabilitó el modo thinking de Ollama en solicitudes de Agent y Direct Diff para garantizar que se devuelvan los mensajes de commit y las llamadas a herramientas.
- Se corrigió un error por el cual las llamadas a herramientas de Google Gemini fallaban, pasando correctamente los parámetros de declaración de funciones a través del campo JSON Schema nativo.
- Se añadió soporte para Gemini 3.8 Flash en el proveedor Google Gemini y se actualizó el modelo predeterminado de Google a Gemini 3.8 Flash.
- Se añadió soporte para GPT-6 Astra en el proveedor OpenAI.
- Se añadió soporte para Claude Fable 5.1 en el proveedor Anthropic Claude.
- Se actualizó el catálogo de modelos de DeepSeek con DeepSeek V4.1 Flash, eliminando los modelos obsoletos.
