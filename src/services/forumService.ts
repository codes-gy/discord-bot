import { ChannelType, Client, Collection, FetchedThreads, ForumChannel, Message, ThreadChannel } from 'discord.js';
import {
    MEMBER_LIST_MARKER,
    ServiceResult,
    FindMemberListMessageParams,
    SaveMemberListMessageParams,
    AddNicknameParams,
    RemoveNicknameParams,
    UpdateNicknameParams,
    ChangeJobParams,
    DuplicateMemberResult,
    JOB_CHOICES,
    JobType,
    ParsedMemberStats,
} from '../types/forumType';
import { logger } from '../utils/logger';

export async function getForumChannel(client: Client, forumChannelId: string): Promise<ForumChannel> {
    const channel = await client.channels.fetch(forumChannelId);

    if (!channel || channel.type !== ChannelType.GuildForum) {
        throw new Error('설정된 대상 채널이 포럼 채널이 아니거나 찾을 수 없습니다.');
    }

    return channel;
}

export async function getAllThreads(forumChannel: ForumChannel): Promise<ThreadChannel[]> {
    const emptyThreads = { threads: new Collection<string, ThreadChannel>() } as unknown as FetchedThreads;

    const activeThreads = await forumChannel.threads.fetchActive().catch(() => emptyThreads);
    const archivedThreads = await forumChannel.threads.fetchArchived({ limit: 100 }).catch(() => emptyThreads);

    return [...activeThreads.threads.values(), ...archivedThreads.threads.values()];
}

export async function findThreadByName(forumChannel: ForumChannel, keyword: string): Promise<ThreadChannel | undefined> {
    const cachedThread = forumChannel.threads.cache.find((t) => t.name.toLowerCase().includes(keyword.toLowerCase()));
    if (cachedThread) return cachedThread;

    const threads = await getAllThreads(forumChannel);
    const lowerKeyword = keyword.toLowerCase();

    return threads.find((thread) => thread.name.toLowerCase().includes(lowerKeyword));
}

export async function findMemberListMessage({ thread }: FindMemberListMessageParams): Promise<Message | undefined> {
    const messages = await thread.messages.fetch({ limit: 20 });

    const targetMessage = messages.find((message) => message.content.includes(MEMBER_LIST_MARKER));
    if (targetMessage) return targetMessage;

    const cachedStarter = messages.get(thread.id);
    if (cachedStarter && cachedStarter.content.includes(MEMBER_LIST_MARKER)) {
        return cachedStarter;
    }

    const starterMessage = await thread.fetchStarterMessage().catch(() => null);
    if (starterMessage && starterMessage.content.includes(MEMBER_LIST_MARKER)) {
        return starterMessage;
    }

    return undefined;
}

export async function saveMemberListMessage({ client, thread, targetMessage, updatedContent }: SaveMemberListMessageParams): Promise<void> {
    if (targetMessage.author.id === client.user?.id) {
        await targetMessage.edit({ content: updatedContent });
        return;
    }

    await thread.send({ content: updatedContent });

    await targetMessage.delete().catch((err) => {
        logger.warn('메시지 삭제 실패(권한 부족)', {
            errorMessage: err instanceof Error ? err.message : String(err),
        });
    });
}

export function createThreadUrl(guildId: string | null, threadId: string): string {
    if (!guildId) {
        return `https://discord.com/channels/@me/${threadId}`;
    }
    return `https://discord.com/channels/${guildId}/${threadId}`;
}

export function addNicknameToContent({ content, jobTarget, nickname }: AddNicknameParams): ServiceResult {
    if (hasExactNickname(content, nickname)) {
        return {
            success: false,
            message: `"${nickname}" 님은 명단에 이미 존재합니다.`,
        };
    }

    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === jobTarget) {
            if (i + 1 >= lines.length) {
                return { success: false, message: '수정에 실패했습니다.' };
            }

            const nextLine = lines[i + 1].trim();
            lines[i + 1] = nextLine === '' ? nickname : `${nextLine} ${nickname}`;

            return {
                success: true,
                message: lines.join('\n'),
            };
        }
    }

    return {
        success: false,
        message: `"${jobTarget}" 대상을 찾을 수 없어 수정에 실패했습니다.`,
    };
}

export function removeNicknameFromContent({ content, nickname }: RemoveNicknameParams): ServiceResult {
    if (!hasExactNickname(content, nickname)) {
        return {
            success: false,
            message: `"${nickname}" 님은 명단에 존재하지 않습니다.`,
        };
    }

    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const nicknames = splitNicknames(lines[i]);

        if (nicknames.includes(nickname)) {
            lines[i] = nicknames.filter((word) => word !== nickname).join(' ');

            return {
                success: true,
                message: lines.join('\n'),
            };
        }
    }

    return {
        success: false,
        message: `명단에서 "${nickname}" 님을 삭제하지 못했습니다.`,
    };
}

export function updateNicknameInContent({ content, oldNickname, newNickname }: UpdateNicknameParams): ServiceResult {
    if (!hasExactNickname(content, oldNickname)) {
        return {
            success: false,
            message: `"${oldNickname}" 님은 명단에 존재하지 않습니다.`,
        };
    }

    if (hasExactNickname(content, newNickname)) {
        return {
            success: false,
            message: `"${newNickname}" 님은 이미 명단에 존재합니다.`,
        };
    }

    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const nicknames = splitNicknames(lines[i]);

        if (nicknames.includes(oldNickname)) {
            lines[i] = nicknames.map((nickname) => (nickname === oldNickname ? newNickname : nickname)).join(' ');

            return {
                success: true,
                message: lines.join('\n'),
            };
        }
    }

    return {
        success: false,
        message: `명단에서 "${oldNickname}" 님을 수정하지 못했습니다.`,
    };
}

const JOB_VALUES = JOB_CHOICES.map((job) => job.value);

export function parseMemberStats(content: string): ParsedMemberStats {
    const byJob: Record<JobType, string[]> = {
        '### 격수': [],
        '### 도사': [],
        '### 술사': [],
    };

    const allMembers: string[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const currentLine = lines[i].trim();

        if (JOB_VALUES.includes(currentLine as JobType)) {
            const job = currentLine as JobType;
            const nextLine = lines[i + 1] ?? '';
            const nicknames = splitNicknames(nextLine);

            byJob[job].push(...nicknames);
            allMembers.push(...nicknames);
        }
    }

    const countMap = new Map<string, number>();

    for (const member of allMembers) {
        countMap.set(member, (countMap.get(member) ?? 0) + 1);
    }

    const duplicates = [...countMap.entries()].filter(([, count]) => count > 1).map(([name]) => name);

    return {
        total: allMembers.length,
        byJob,
        duplicates,
    };
}

export function changeJobInContent({ content, nickname, newJobTarget }: ChangeJobParams): ServiceResult {
    if (!hasExactNickname(content, nickname)) {
        return {
            success: false,
            message: `"${nickname}" 님은 명단에 존재하지 않습니다.`,
        };
    }

    const lines = content.split('\n');
    let removed = false;

    for (let i = 0; i < lines.length; i++) {
        const nicknames = splitNicknames(lines[i]);

        if (nicknames.includes(nickname)) {
            lines[i] = nicknames.filter((name) => name !== nickname).join(' ');
            removed = true;
            break;
        }
    }

    if (!removed) {
        return {
            success: false,
            message: `"${nickname}" 님을 기존 직업에서 제거하지 못했습니다.`,
        };
    }

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === newJobTarget) {
            const nextLine = lines[i + 1] ?? '';

            lines[i + 1] = nextLine.trim() === '' ? nickname : `${nextLine.trim()} ${nickname}`;

            return {
                success: true,
                message: lines.join('\n'),
            };
        }
    }

    return {
        success: false,
        message: `"${newJobTarget}" 항목을 찾지 못했습니다.`,
    };
}

const JOB_LABEL_MAP: Record<JobType, string> = {
    '### 격수': '격수',
    '### 도사': '도사',
    '### 술사': '술사',
};

export function extractMembersByJob(content: string): Record<JobType, string[]> {
    const membersByJob: Record<JobType, string[]> = {
        '### 격수': [],
        '### 도사': [],
        '### 술사': [],
    };

    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const currentLine = lines[i].trim();

        if (currentLine === '### 격수' || currentLine === '### 도사' || currentLine === '### 술사') {
            const job = currentLine as JobType;
            const nextLine = lines[i + 1] ?? '';
            const nicknames = splitNicknames(nextLine);

            membersByJob[job].push(...nicknames);
        }
    }

    return membersByJob;
}

export function findDuplicateMembersInContents(
    contents: {
        threadName: string;
        threadUrl: string;
        content: string;
    }[]
): DuplicateMemberResult[] {
    const memberMap = new Map<
        string,
        {
            threadName: string;
            threadUrl: string;
            jobName: string;
        }[]
    >();

    for (const item of contents) {
        const membersByJob = extractMembersByJob(item.content);

        for (const [job, nicknames] of Object.entries(membersByJob)) {
            for (const nickname of nicknames) {
                const locations = memberMap.get(nickname) ?? [];

                locations.push({
                    threadName: item.threadName,
                    threadUrl: item.threadUrl,
                    jobName: JOB_LABEL_MAP[job as JobType],
                });

                memberMap.set(nickname, locations);
            }
        }
    }

    return [...memberMap.entries()]
        .filter(([, locations]) => locations.length > 1)
        .map(([nickname, locations]) => ({
            nickname,
            locations,
        }));
}

export async function findThreadByExactName(forumChannel: ForumChannel, keyword: string): Promise<ThreadChannel | undefined> {
    const threads = await getAllThreads(forumChannel);
    const normalizedKeyword = keyword.toLowerCase().trim();

    return threads.find((thread) => thread.name.toLowerCase().trim() === normalizedKeyword);
}

function splitNicknames(line: string): string[] {
    return line.trim().split(/\s+/).filter(Boolean);
}

function hasExactNickname(content: string, nickname: string): boolean {
    return content.split('\n').some((line) => splitNicknames(line).includes(nickname));
}
