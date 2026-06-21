import type { ChatInputCommandInteraction, Client, ForumChannel, Message, ThreadChannel } from 'discord.js';

export interface ServiceResult {
    success: boolean;
    message: string;
    threadUrl?: string;
    threadName?: string;
}

export type JobType = '### 격수' | '### 도사' | '### 술사';

export const MEMBER_LIST_MARKER = '## 문파원 정보 안내';

export const JOB_CHOICES: { name: string; value: JobType }[] = [
    { name: '격수', value: '### 격수' },
    { name: '도사', value: '### 도사' },
    { name: '술사', value: '### 술사' },
];

export interface CommandHandlerParams {
    interaction: ChatInputCommandInteraction;
    forumChannel: ForumChannel;
}

export interface CommandHandlerWithClientParams extends CommandHandlerParams {
    client: Client;
}

export type CommandHandler = (params: CommandHandlerParams) => Promise<void>;

export type CommandHandlerWithClient = (params: CommandHandlerWithClientParams) => Promise<void>;

export interface FindMemberListMessageParams {
    thread: ThreadChannel;
}

export interface SaveMemberListMessageParams {
    client: Client;
    thread: ThreadChannel;
    targetMessage: Message;
    updatedContent: string;
}

export interface AddNicknameParams {
    content: string;
    jobTarget: JobType;
    nickname: string;
}

export interface RemoveNicknameParams {
    content: string;
    nickname: string;
}
