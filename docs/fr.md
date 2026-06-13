# Informations de mise à jour de Commit Copilot

## Nouveautés de la version 1.14.0

- Prise en charge du mode proxy d'Ollama : Introduction de protocoles d'outils d'agent texte pour supprimer le mécanisme de secours obligatoire Direct Diff, et prise en charge de l'interruption du téléchargement (Pull) du modèle Ollama lors de l'annulation de la génération.
- Prise en charge des fournisseurs personnalisés Anthropic : Permet de configurer des points de terminaison personnalisés au format de l'API Anthropic et de définir les jetons de sortie maximaux, avec optimisation de l'ordre de saisie des nouveaux champs et migration automatique des anciennes configurations.
- Modularisation de l'architecture centrale : Séparation des composants clés tels que l'orchestration de la génération, les opérations Git, la gestion des modèles et les protocoles de webview en modules indépendants, et modularisation des prompts de langue pour améliorer les performances de chargement.
- Simplification des noms d'affichage des fournisseurs : Correction des étiquettes des fournisseurs intégrés pour obtenir des noms plus épurés.
- Correction des étiquettes de langue de l'interface : Correction de l'étiquette d'action du sélecteur de modèle de « Ajouter un modèle » à « Gérer les modèles... » pour mieux correspondre à l'écran de la fonctionnalité.
- Mise à jour et optimisation de la documentation README.md et des exemples de configuration.
