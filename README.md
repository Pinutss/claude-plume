# Plume ✎ pour Claude Code

Tu dictes ou tapes ta demande en vrac. Un clic sur **Réécrire**, et Plume la transforme en prompt clair, structuré et court, que Claude comprend du premier coup.

```
[plume] Réécrire   [Haiku 5.5 ▾]   [Moyen ▾]
```

Exemple, **avant :**

> euh alors en fait je voudrais que tu me fasses un truc qui renomme mes photos, genre par date, mais pas celles qui sont déjà renommées, et euh si possible en python

**après :**

> Objectif: script Python qui renomme les photos par date.
>
> Exigences:
> - Nom basé sur la date de la photo.
> - Ignorer les photos déjà renommées.

## Ce que fait Plume

- **Réécrit le brouillon** du champ de saisie : retire hésitations, répétitions et erreurs de dictée, garde tous les détails utiles, structure en sections (Objectif, Contexte, Exigences, Contraintes, Livrable, À préciser) seulement quand c'est utile.
- **Comprend ton projet** : le nom du projet, les fichiers à la racine, le début de `CLAUDE.md` (ou du `README.md`) et les 4 derniers échanges sont joints, pour que « ça » ou « le mode » soient bien compris. Rien n'est inventé à partir de ce contexte.
- **Économe en tokens** : contexte plafonné (~1 500 tokens au plus), lu une seule fois par projet puis gardé en mémoire, et modèle léger par défaut (Haiku 5.5, effort moyen).
- **Modèle et effort au choix** dans deux listes déroulantes, mémorisés d'une session à l'autre.
- **↩ Annuler** remet ton texte d'origine si la réécriture ne te plaît pas.
- Rien n'est envoyé automatiquement : tu relis, puis tu envoies.

## Installation

Dans l'app de bureau Claude (onglet Code) : clique sur **+** à côté du champ de saisie, puis **Plugins**, **Add marketplace** avec `Pinutss/claude-plume`, puis **Add plugin**.

Dans un terminal, au prompt de Claude Code :

```
/plugin install plume --marketplace Pinutss/claude-plume
```

Ou depuis un shell :

```bash
claude plugin install plume --marketplace Pinutss/claude-plume
```

Réponds `y` pour ajouter la marketplace, puis choisis la portée (utilisateur par défaut).

## Confidentialité

La réécriture passe par ta propre session Claude Code (ton compte, tes crédits). Le brouillon et le petit contexte décrit plus haut sont envoyés au modèle choisi, et à rien d'autre.

## Personnaliser

Les consignes de réécriture et les plafonds de contexte sont en haut de [`hooks/register.tsx`](hooks/register.tsx).

## Licence

MIT
