# Información de actualización de Commit Copilot

## Novedades de la versión 1.18.0

- Se añadió soporte para consultar los diffs de varios archivos en una sola solicitud de herramienta y devolver el diff exacto completo de cada archivo solicitado.
- Se implementó la verificación obligatoria de cobertura de diffs para garantizar que se revisen todos los archivos modificados antes de finalizar la generación del mensaje de commit.
- Se corrigió la cancelación de solicitudes para abortar inmediatamente las conexiones HTTP activas con los proveedores LLM al cancelar la generación.
