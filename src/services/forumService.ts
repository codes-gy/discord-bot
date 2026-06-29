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
import { redisClient } from '../utils/redis';

// [추가] 채널 고유 ID를 결합하여 충돌을 방지하는 동적 캐시 키 생성기
const getThreadsCacheKey = (channelId: string) => `forum:${channelId}:threads:all`;
const getMsgCacheKey = (channelId: string, threadId: string) => `forum:${channelId}:msg:${threadId}`;

export async function getForumChannel(client: Client, forumChannelId: string): Promise<ForumChannel> {
    const channel = await client.channels.fetch(forumChannelId);

    if (!channel || channel.type !== ChannelType.GuildForum) {
        throw new Error('설정된 대상 채널이 포럼 채널이 아니거나 찾을 수 없습니다.');
    }

    return channel;
}

/**
 * [수정] 모든 스레드를 조회할 때 해당 포럼 채널 고유의 캐시 키를 조회/갱신합니다.
 */
export async function getAllThreads(forumChannel: ForumChannel): Promise<ThreadChannel[]> {
    const cacheKey = getThreadsCacheKey(forumChannel.id);

    try {
        // 1. 레디스 캐시 확인
        const cachedThreadIds = await redisClient.get(cacheKey);
        if (cachedThreadIds) {
            const ids: string[] = JSON.parse(cachedThreadIds);
            // 디스코드 client가 메모리에 들고 있는 캐시에서 스레드를 매핑해 반환
            const threads = ids.map((id) => forumChannel.threads.cache.get(id)).filter((t) => t !== undefined) as unknown as ThreadChannel[];

            // 디스코드 내부 로컬 메모리 캐시와 레디스 저장된 ID 개수가 정확히 일치할 때만 캐시 즉시 반환
            if (threads.length === ids.length) {
                return threads;
            }
        }
    } catch (err) {
        logger.error(`Redis에서 채널(${forumChannel.id}) 스레드 목록 조회 실패:`, err);
    }

    // 캐시가 없거나 유효하지 않으면 원격 디스코드 API 서버 fetch 수행
    const emptyThreads = { threads: new Collection<string, ThreadChannel>() } as unknown as FetchedThreads;
    const activeThreads = await forumChannel.threads.fetchActive().catch(() => emptyThreads);
    const archivedThreads = await forumChannel.threads.fetchArchived({ limit: 100 }).catch(() => emptyThreads);
    const allThreads = [...activeThreads.threads.values(), ...archivedThreads.threads.values()];

    try {
        // 새로 가져온 스레드의 ID 리스트를 채널 고유 키에 10분(600초) 동안 보관
        const threadIds = allThreads.map((t) => t.id);
        await redisClient.setEx(cacheKey, 600, JSON.stringify(threadIds));
    } catch (err) {
        logger.error(`Redis에 채널(${forumChannel.id}) 스레드 목록 저장 실패:`, err);
    }

    return allThreads;
}

export async function findThreadByName(forumChannel: ForumChannel, keyword: string): Promise<ThreadChannel | undefined> {
    const cachedThread = forumChannel.threads.cache.find((t) => t.name.toLowerCase().includes(keyword.toLowerCase()));
    if (cachedThread) return cachedThread;

    const threads = await getAllThreads(forumChannel);
    const lowerKeyword = keyword.toLowerCase();

    return threads.find((thread) => thread.name.toLowerCase().includes(lowerKeyword));
}

/**
 * [수정] 특정 스레드의 명단 본문을 가져올 때, 소속 채널 ID를 조합한 고유 키를 사용합니다.
 */
export async function findMemberListMessage({ thread }: FindMemberListMessageParams): Promise<Message | undefined> {
    const parentChannelId = thread.parentId || 'unknown';
    const cacheKey = getMsgCacheKey(parentChannelId, thread.id);

    try {
        // 1. 레디스 캐시 확인
        const cachedMsg = await redisClient.get(cacheKey);
        if (cachedMsg) {
            const parsed = JSON.parse(cachedMsg);
            // 디스코드 Message 인터페이스 구조에 호환되도록 필요한 핵심 데이터 구조 복구(Mocking)
            return {
                id: parsed.id,
                content: parsed.content,
                author: { id: parsed.authorId },
                thread: thread,
            } as unknown as Message;
        }
    } catch (err) {
        logger.error(`Redis에서 메시지 캐시 조회 실패 (채널: ${parentChannelId}, 스레드: ${thread.id}):`, err);
    }

    // 캐시가 없으면 원격 디스코드 채널 메시지 수집 시작
    const messages = await thread.messages.fetch({ limit: 20 });

    let targetMessage = messages.find((message) => message.content.includes(MEMBER_LIST_MARKER));
    if (!targetMessage) {
        const cachedStarter = messages.get(thread.id);
        if (cachedStarter && cachedStarter.content.includes(MEMBER_LIST_MARKER)) {
            targetMessage = cachedStarter;
        }
    }

    if (!targetMessage) {
        const starterMessage = await thread.fetchStarterMessage().catch(() => null);
        if (starterMessage && starterMessage.content.includes(MEMBER_LIST_MARKER)) {
            targetMessage = starterMessage;
        }
    }

    // 조건에 부합하는 명단 원본을 찾았다면 해당 채널 캐시에 1시간(3600초) 동안 보관
    if (targetMessage) {
        try {
            const serialized = {
                id: targetMessage.id,
                content: targetMessage.content,
                authorId: targetMessage.author.id,
            };
            await redisClient.setEx(cacheKey, 3600, JSON.stringify(serialized));
        } catch (err) {
            logger.error(`Redis에 메시지 캐시 저장 실패 (채널: ${parentChannelId}, 스레드: ${thread.id}):`, err);
        }
    }

    return targetMessage;
}

/**
 * [수정] 메시지가 변경되었을 때, 다른 채널을 건드리지 않고 해당 스레드가 속한 채널 공간만 무효화/업데이트합니다.
 */
export async function saveMemberListMessage({ client, thread, targetMessage, updatedContent }: SaveMemberListMessageParams): Promise<void> {
    let finalMessageId = targetMessage.id;

    if (targetMessage.author.id === client.user?.id) {
        await targetMessage.edit({ content: updatedContent });
    } else {
        const sentMessage = await thread.send({ content: updatedContent });
        finalMessageId = sentMessage.id;

        await targetMessage.delete().catch((err) => {
            logger.warn('메시지 삭제 실패(권한 부족)', {
                errorMessage: err instanceof Error ? err.message : String(err),
            });
        });
    }

    // 데이터 변동 발생에 따른 캐시 무효화 및 동기화 작업 시작
    const parentChannelId = thread.parentId || 'unknown';
    const msgCacheKey = getMsgCacheKey(parentChannelId, thread.id);
    const threadsCacheKey = getThreadsCacheKey(parentChannelId);

    try {
        const serialized = {
            id: finalMessageId,
            content: updatedContent,
            authorId: client.user?.id || '',
        };
        // 수정된 최신 내용을 레디스 캐시에 강제 동기화 (만료 시간 1시간 연장)
        await redisClient.setEx(msgCacheKey, 3600, JSON.stringify(serialized));

        // 중요: 다른 포럼 채널 캐시는 그대로 유지하고, 현재 글이 위치한 채널의 전체 목록 캐시만 선별하여 폐기
        await redisClient.del(threadsCacheKey);
    } catch (err) {
        logger.error(`데이터 변경 후 Redis 캐시 동기화 실패 (채널: ${parentChannelId}, 스레드: ${thread.id}):`, err);
    }
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
                lines.push(nickname);
            } else {
                const nextLine = lines[i + 1].trim();
                lines[i + 1] = nextLine === '' ? nickname : `${nextLine} ${nickname}`;
            }

            return {
                success: true,
                message: lines.join('\n'),
            };
        }
    }

    return {
        success: false,
        message: `"${jobTarget}" 대상을 찾을 수 없어 등록에 실패했습니다.`,
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
            if (i + 1 >= lines.length) {
                lines.push(nickname);
            } else {
                const nextLine = lines[i + 1] ?? '';
                lines[i + 1] = nextLine.trim() === '' ? nickname : `${nextLine.trim()} ${nickname}`;
            }
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

// [수정] content 내부 줄바꿈 단위로 완전 정밀 매칭 검사 수행
function hasExactNickname(content: string, nickname: string): boolean {
    return content.split('\n').some((line) => splitNicknames(line).includes(nickname));
}
