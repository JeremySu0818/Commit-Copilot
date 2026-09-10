# Informations de mise à jour de Commit Copilot

## Nouveautés de la version 1.20.0

- Désactivation du mode thinking d'Ollama dans les requêtes Agent et Direct Diff pour s'assurer que les messages de commit et les appels d'outils sont bien renvoyés.
- Correction d'un problème où les appels d'outils Google Gemini échouaient en transmettant correctement les paramètres de déclaration de fonction via le champ JSON Schema brut.
- Ajout de la prise en charge de Gemini 3.8 Flash pour le fournisseur Google Gemini et mise à niveau du modèle par défaut vers Gemini 3.8 Flash.
- Ajout de la prise en charge de GPT-6 Astra pour le fournisseur OpenAI.
- Ajout de la prise en charge de Claude Fable 5.1 pour le fournisseur Anthropic Claude.
- Mise à jour du catalogue de modèles DeepSeek avec DeepSeek V4.1 Flash, et suppression des modèles obsolètes.
