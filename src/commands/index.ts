import { Collection } from 'discord.js';
import type { Command } from '@/types';

import playCommand from '@/commands/music/play';
import stopCommand from '@/commands/music/stop';
import queueCommand from '@/commands/music/queue';
import leaveCommand from '@/commands/music/leave';
import registerChannelCommand from '@/commands/tts/registerChannel';
import unregisterChannelCommand from '@/commands/tts/unregisterChannel';

const allCommands: Command[] = [playCommand, stopCommand, queueCommand, leaveCommand, registerChannelCommand, unregisterChannelCommand];

/**
 * 커맨드 이름 -> Command 조회용 컬렉션. interactionCreate 이벤트 핸들러가 사용한다.
 */
export const commands = new Collection<string, Command>(allCommands.map((command) => [command.data.name, command]));

/**
 * 디스코드 REST API에 등록할 슬래시 커맨드 JSON 목록. deploy-commands.ts가 사용한다.
 */
export const commandJsonList = allCommands.map((command) => command.data.toJSON());
