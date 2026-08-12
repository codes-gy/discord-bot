import { registerChannelCommand } from './registerChannel';
import { unregisterChannelCommand } from './unregisterChannel';

export const commandList = [registerChannelCommand, unregisterChannelCommand];

export const commandJsonList = commandList.map((cmd) => cmd.data.toJSON());
