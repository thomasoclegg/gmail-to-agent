// Every video the recorder makes, in the order it renders them.

import { hero } from './hero.mjs';
import { pickAis, desktopAgent, copyAny, bulk } from './clips.mjs';
import { setupMac, setupWin } from './setup.mjs';
import { walkthrough, thumbnail } from './walkthrough.mjs';
import { install, installThumbnail } from './install.mjs';

export const BOARDS = [hero('win'), hero('mac'), pickAis, desktopAgent, copyAny, bulk, setupMac, setupWin, walkthrough, thumbnail, install, installThumbnail];
