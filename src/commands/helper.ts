import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export type CommandHandler = (interaction: ChatInputCommandInteraction) => Promise<void>;

export interface CommandModule {
    data: SlashCommandBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
    execute: CommandHandler;
}

export function createCommand(
    builder: (command: SlashCommandBuilder) => SlashCommandBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>,
    execute: CommandHandler
): CommandModule {
    const commandBuilder = new SlashCommandBuilder();
    const data = builder(commandBuilder);
    return { data, execute };
}
