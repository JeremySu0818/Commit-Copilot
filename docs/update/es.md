# Información de actualización de Commit Copilot

## Novedades de la versión 1.20.0

- Se corrigió un error por el cual las llamadas a herramientas en los puntos finales de OpenAI fallaban debido a palabras clave de esquema no compatibles, depurando correctamente los esquemas de parámetros para llamadas a funciones y la API Responses.
- Se deshabilitó el modo thinking de Ollama en solicitudes de Agent y Direct Diff para garantizar que se devuelvan los mensajes de commit y las llamadas a herramientas.
- Se corrigió un error por el cual las llamadas a herramientas de Google Gemini fallaban, pasando correctamente los parámetros de declaración de funciones a través del campo JSON Schema nativo.
- Se añadió soporte para Gemini 3.8 Flash en el proveedor Google Gemini y se actualizó el modelo predeterminado de Google a Gemini 3.8 Flash.
- Se añadió soporte para GPT-6 Astra en el proveedor OpenAI.
- Se añadió soporte para Claude Fable 5.1 en el proveedor Anthropic Claude.
- Se actualizó el catálogo de modelos de DeepSeek con DeepSeek V4.1 Flash, eliminando los modelos obsoletos.
- Se añadió soporte para GPT-6 Luna, GPT-6 Sol y GPT-6.1 Sol en el proveedor OpenAI, y se actualizó el modelo predeterminado de OpenAI a GPT-6.1 Sol.
- Se añadió soporte para Claude Opus 5.5 en el proveedor Anthropic Claude.
- Se añadió soporte para Grok 4.7 en el proveedor xAI Grok.
- Se actualizó el catálogo de modelos de Groq con Qwen 3.8 27b, eliminando los modelos obsoletos.
