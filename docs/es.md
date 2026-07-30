# Información de actualización de Commit Copilot

## Novedades de la versión 1.18.0

- Se añadió soporte para consultar los diffs de varios archivos en una sola solicitud de herramienta y devolver el diff exacto completo de cada archivo solicitado.
- Se añadió un ajuste opcional de cobertura completa de diffs, desactivado de forma predeterminada, que al activarse exige revisar todos los archivos modificados antes de finalizar el mensaje de commit.
- Se corrigió la cancelación de solicitudes para abortar inmediatamente las conexiones HTTP activas con los proveedores LLM al cancelar la generación.
