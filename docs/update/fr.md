# Informations de mise à jour de Commit Copilot

## Nouveautés de la version 1.20.0

- Correction d'un problème où les appels d'outils sur les points de terminaison OpenAI échouaient en raison de mots-clés de schéma non pris en charge, en nettoyant correctement les schémas de paramètres pour les appels de fonction et l'API Responses.
- Désactivation du mode thinking d'Ollama dans les requêtes Agent et Direct Diff pour s'assurer que les messages de commit et les appels d'outils sont bien renvoyés.
- Correction d'un problème où les appels d'outils Google Gemini échouaient en transmettant correctement les paramètres de déclaration de fonction via le champ JSON Schema brut.
- Ajout de la prise en charge de Gemini 3.8 Flash pour le fournisseur Google Gemini et mise à niveau du modèle par défaut vers Gemini 3.8 Flash.
- Ajout de la prise en charge de GPT-6 Astra pour le fournisseur OpenAI.
- Ajout de la prise en charge de Claude Fable 5.1 pour le fournisseur Anthropic Claude.
- Mise à jour du catalogue de modèles DeepSeek avec DeepSeek V4.1 Flash, et suppression des modèles obsolètes.
- Ajout de la prise en charge de GPT-6 Luna, GPT-6 Sol et GPT-6.1 Sol pour le fournisseur OpenAI, et mise à niveau du modèle OpenAI par défaut vers GPT-6.1 Sol.
- Ajout de la prise en charge de Claude Opus 5.5 pour le fournisseur Anthropic Claude.
- Ajout de la prise en charge de Grok 4.7 pour le fournisseur xAI Grok.
- Mise à jour du catalogue de modèles Groq avec Qwen 3.8 27b, et suppression des modèles obsolètes.
