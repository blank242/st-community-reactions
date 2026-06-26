# Community Reactions

Community Reactions is a SillyTavern extension that generates fictional community reactions from your chat content.

It can treat the selected chat range as a novel chapter, drama episode, comic/webtoon update, movie scene, or game event, then render reactions in styles such as Twitter/X, cafe boards, anonymous campus boards, or web novel reviews.

## Features

- Generate community reactions from chat content
- Reader reaction mode and in-world NPC reaction mode
- Twitter/X-style timeline
- Daum Cafe-style board
- Everytime-style anonymous board
- Web novel review-style page
- Saved custom reader communities and NPC reaction categories
- Optional world info, character card, and hidden message context
- Original text preservation option
- Delete selected posts or all saved results for the current community/category

## Basic Usage

1. Open a chat in SillyTavern.
2. Click `커뮤니티 보기` in the wand menu.
3. Choose a reaction type.
4. Select a community, message range, country, output language, and post count.
5. Optionally include world info, character card, anti reactions, hidden messages, or original text preservation.
6. Click `생성하기`.
7. Open the viewer with `커뮤니티 보기` to browse saved reactions.

## Reaction Types

### Reader Reactions

Reader reactions treat the selected chat range as content from a fictional work.

Use `Original Medium` to choose whether the chat should be treated as a novel, drama, comic, movie, or game. The generated users should react as people who consumed that medium.

For example, if the medium is `novel`, users should react as readers who read a novel scene, not as people directly witnessing a real event.

### In-World NPC Reactions

NPC reactions treat the selected chat range as a real event inside the fictional world.

You can save separate category titles and prompts for different in-world boards or communities.

## Communities and Categories

### Custom Reader Communities

In reader reaction mode, you can add your own custom communities.

Example:

```text
Community title: Baseball fan timeline
Base community: Twitter
Community prompt:
- A timeline full of baseball fans
- Casual tone with many jokes and memes
```

### NPC Reaction Categories

In NPC reaction mode, you can save the board style and topic direction.

Example:

```text
Category title: Magic school anonymous board
Target board: Everytime
Category prompt:
An anonymous board where students discuss the incident that just happened
```

## Options

- `Message range`: The chat messages used as the reaction target.
- `Country`: The cultural tone of the community users.
- `Output language`: The final language of generated reactions.
- `Connection Profile`: Use the current Main API or a selected Connection Profile.
- `Max tokens`: Maximum response length for generation.
- `Post count`: Number of posts to generate.
- `Include hidden messages`: Include hidden/system messages in the source context.
- `Include world info`: Add activated world info as background context.
- `Include character card`: Add current character card details as background context.
- `Include anti reactions`: Include some critical or negative reactions.
- `Preserve original`: Generate both original text and translation when the community language differs from the output language.
- `Custom prompt`: Add extra direction for tone, community behavior, or reaction style.

## Storage

Generated results are saved as JSON files in SillyTavern's user files area.

Files use the `crx__...json` naming pattern. The extension uses SillyTavern's default file upload API and does not require server patches.

## Deleting Results

Click the trash button in the viewer to enter delete mode.

- `선택 삭제`: Delete only checked posts.
- `전체 삭제`: Delete all saved results for the currently selected community/category.

Deleting a custom community or NPC category also deletes reactions generated under that community/category.

## Notes

- The model must return valid JSON. If it does not, generation may fail.
- Failed raw responses are saved as debugging JSON files.
- Including world info and character cards can increase token usage.
- Original preservation can greatly increase token usage because both original and translated text are generated.
- The extension does not use AI-generated HTML. The model outputs JSON, and the extension's renderer displays it.

## Troubleshooting

### I do not see `커뮤니티 보기` in the wand menu

Refresh SillyTavern. If it still does not appear, check the browser console for `Community Reactions` errors.

### Generation fails

Check the following:

- Your current Main API or selected Connection Profile works
- Max tokens is not too low
- The model can follow JSON-only output instructions
- A failed response file was saved as `/user/files/crx__failed__...json`

### The reactions do not match the community tone I wanted

Use the custom prompt field to describe tone, community behavior, and what to avoid.

Example:

```text
- Do not react as if this happened in real life; write as readers discussing a novel scene
- Mix immersive readers, analysis-heavy readers, and meme/joke replies
- Avoid long explanations; use short community-style posts
```
