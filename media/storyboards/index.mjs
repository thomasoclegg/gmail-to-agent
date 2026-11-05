// Every video the recorder makes, in the order it renders them.

import { hero } from './hero.mjs';
import { pickAis, desktopAgent, copyAny, bulk } from './clips.mjs';
import { walkthrough, thumbnail } from './walkthrough.mjs';

export const BOARDS = [hero('win'), hero('mac'), pickAis, desktopAgent, copyAny, bulk, walkthrough, thumbnail];
