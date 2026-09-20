# Tokenizer States

A Foundry VTT tokenizer with named token states. Each state has its own avatar and token art. The default state stays in Foundry’s normal actor and token image fields, so the character still looks correct if this module is disabled.

## Manifest

https://raw.githubusercontent.com/Me0wX-LR/tokenizer-states/main/module.json

In Foundry: **Add-on Modules → Install Module → Manifest URL**. Do not enable this alongside the original Tokenizer module; both use the `vtta-tokenizer` id.

## Features

- Full Tokenizer editor: load images from disk, URL, Foundry, paste, or drag and drop; stack layers; frames; masks; Magic Lasso; presets.
- Named states you assign yourself (for example Default, Combat, Disguise). Each state has its own avatar and token artwork, made with the same editor.
- Default state is the actor’s normal avatar and prototype token image. Extra states are stored by this module and do not overwrite those native images.
- Right-click a token to open the Token HUD, then use the masks button for a Visage-style preview grid. Click a thumbnail to switch state.

## How to use

1. Install from the manifest URL above, then enable **Tokenizer States** in the world.
2. Open Tokenizer from an actor or token the same way as the original module (portrait click, sheet header, or directory context menu).
3. Use **Editing state** at the top of Tokenizer. **Add state**, name it, compose the avatar and token with frames, masks, and layers, then **Apply**.
4. To edit another state, pick it from the dropdown and Apply again. **Rename** and **Delete** apply to extra states; Default cannot be deleted.
5. On the canvas, **right-click** the token → masks button → click a preview tile to switch. The gold border is the active state. The pencil opens Tokenizer for that state; **+** creates a new one.

Switching a non-default state only changes what you see. Foundry’s actor `img` and token `texture.src` remain the default art.
