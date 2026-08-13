import { ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandsOnlyBuilder } from 'discord.js';

export type CommandHandler = (interaction: ChatInputCommandInteraction) => Promise<void>;

// ➕ 옵션 및 서브커맨드 체이닝 결과 타입을 모두 수용하는 유니온 타입 정의
export type CommandData = SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;

export interface CommandModule {
    data: CommandData;
    execute: CommandHandler;
}

export function createCommand(builder: (command: SlashCommandBuilder) => CommandData, execute: CommandHandler): CommandModule {
    const commandBuilder = new SlashCommandBuilder();
    const data = builder(commandBuilder);
    return { data, execute };
}
