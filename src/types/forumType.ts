import type { ChatInputCommandInteraction, Client, ForumChannel, Message, ThreadChannel } from 'discord.js';

export interface ServiceResult {
    success: boolean;
    message: string;
    threadUrl?: string;
    threadName?: string;
}

export type JobType = '### 격수' | '### 도사' | '### 술사';

export const JOB_LABEL: Record<JobType, string> = {
    '### 격수': '격수',
    '### 도사': '도사',
    '### 술사': '술사',
};

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

export type SortType = 'latest' | 'oldest' | 'title';

export const SORT_CHOICES: { name: string; value: SortType }[] = [
    { name: '최신순', value: 'latest' },
    { name: '오래된순', value: 'oldest' },
    { name: '제목순', value: 'title' },
];

export interface UpdateNicknameParams {
    content: string;
    oldNickname: string;
    newNickname: string;
}

export interface ParsedMemberStats {
    total: number;
    byJob: Record<JobType, string[]>;
    duplicates: string[];
}

export interface ChangeJobParams {
    content: string;
    nickname: string;
    newJobTarget: JobType;
}

export interface DuplicateMemberLocation {
    threadName: string;
    threadUrl: string;
    jobName: string;
}

export interface DuplicateMemberResult {
    nickname: string;
    locations: DuplicateMemberLocation[];
}

export interface SearchResult {
    thread: ThreadChannel;
    matchedWord: string;
}
