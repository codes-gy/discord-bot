import { registerChannelCommand } from './registerChannel';
import { unregisterChannelCommand } from './unregisterChannel';
import { playCommand } from './musicPlay';

export const commandList = [registerChannelCommand, unregisterChannelCommand, playCommand];

export const commandJsonList = commandList.map((cmd) => cmd.data.toJSON());
