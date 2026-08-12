import { SlashCommandBuilder } from 'discord.js';

export const commands = [new SlashCommandBuilder().setName('도움말').setDescription('젤리봇 사용법을 안내드려요!')].map((command) =>
    command.toJSON()
);
