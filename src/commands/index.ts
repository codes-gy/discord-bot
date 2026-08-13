import { registerChannelCommand } from './registerChannel';
import { unregisterChannelCommand } from './unregisterChannel';
import { playCommand } from './musicPlay';
import { stopCommand } from './musicStop';

export const commandList = [registerChannelCommand, unregisterChannelCommand, playCommand, stopCommand];

export const commandJsonList = commandList.map((cmd) => cmd.data.toJSON());
