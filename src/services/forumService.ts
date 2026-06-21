import { ChannelType, Client, Collection, FetchedThreads, ForumChannel, Message, ThreadChannel } from 'discord.js';
import {
    MEMBER_LIST_MARKER,
    ServiceResult,
    FindMemberListMessageParams,
    SaveMemberListMessageParams,
    AddNicknameParams,
    RemoveNicknameParams,
} from '../types/forumType';

export async function getForumChannel(client: Client, forumChannelId: string): Promise<ForumChannel> {
    const channel = await client.channels.fetch(forumChannelId);

    if (!channel || channel.type !== ChannelType.GuildForum) {
        throw new Error('설정된 대상 채널이 포럼 채널이 아니거나 찾을 수 없습니다.');
    }

    return channel; // 불필요한 'as ForumChannel' 타입 단언 제거 (이미 위에서 타입 체크 완료)
}

/**
 * 활성 스레드는 캐시와 API를 통해 가져오고,
 * 보관된 스레드는 양이 많을 수 있으므로 대규모 서비스라면
 * fetchArchived에 페이지네이션 처리를 고려해야 합니다.
 */
export async function getAllThreads(forumChannel: ForumChannel): Promise<ThreadChannel[]> {
    const emptyThreads = { threads: new Collection<string, ThreadChannel>() } as unknown as FetchedThreads;

    // 대안: 외부에서 보관된 스레드까지 매번 전체 조회하는 것보다
    // 최근 활성화된 스레드 위주로 검색하는 편이 리소스를 아낍니다.
    const activeThreads = await forumChannel.threads.fetchActive().catch(() => emptyThreads);
    const archivedThreads = await forumChannel.threads.fetchArchived({ limit: 100 }).catch(() => emptyThreads);

    return [...activeThreads.threads.values(), ...archivedThreads.threads.values()];
}

export async function findThreadByName(forumChannel: ForumChannel, keyword: string): Promise<ThreadChannel | undefined> {
    // 꿀팁: Discord.js의 캐시를 먼저 확인하면 API 호출을 줄일 수 있습니다.
    const cachedThread = forumChannel.threads.cache.find((t) => t.name.toLowerCase().includes(keyword.toLowerCase()));
    if (cachedThread) return cachedThread;

    const threads = await getAllThreads(forumChannel);
    const lowerKeyword = keyword.toLowerCase();

    return threads.find((thread) => thread.name.toLowerCase().includes(lowerKeyword));
}

export async function findMemberListMessage({ thread }: FindMemberListMessageParams): Promise<Message | undefined> {
    const messages = await thread.messages.fetch({ limit: 20 });

    // 1. 가져온 20개의 메시지 중 마커가 있는지 확인
    const targetMessage = messages.find((message) => message.content.includes(MEMBER_LIST_MARKER));
    if (targetMessage) return targetMessage;

    // 2. 만약 20개 내에 없지만, 이미 캐시되었거나 가져온 메시지 중 스타터 메시지가 있는지 확인 (API 호출 절약)
    const cachedStarter = messages.get(thread.id);
    if (cachedStarter && cachedStarter.content.includes(MEMBER_LIST_MARKER)) {
        return cachedStarter;
    }

    // 3. 그것도 아니라면 새로 fetch
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

    // 타인의 메시지일 경우 대체 처리
    await thread.send({ content: updatedContent });

    // 삭제 권한이 없을 때 발생하는 에러를 캐치하되, 로그를 남겨두면 디버깅이 편합니다.
    await targetMessage.delete().catch((err) => {
        console.error(`[Warning] 메시지 삭제 실패 (권한 부족 가능성): ${err.message}`);
    });
}

export function createThreadUrl(guildId: string | null, threadId: string): string {
    return `https://discord.com/channels/${guildId ?? '@me'}/${threadId}`; // guildId가 없을 때(DM 등)를 위한 방어 코드 추가
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
                return { success: false, message: '수정에 실패했습니다. (하위 줄이 존재하지 않음)' };
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
            // 빈 공간이 남지 않도록 필터링 후 다시 공백으로 join
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

function splitNicknames(line: string): string[] {
    return line.trim().split(/\s+/).filter(Boolean); // 미리 trim 수행하여 사이드 이펙트 방지
}

function hasExactNickname(content: string, nickname: string): boolean {
    return content.split('\n').some((line) => splitNicknames(line).includes(nickname));
}
