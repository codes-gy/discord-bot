/**
 * 슬래시 커맨드 옵션으로 입력받은 이모지 문자열을 리액션 역할 저장/조회에 쓸 고유 키로 변환한다.
 * - 커스텀 이모지(<:name:id> 또는 <a:name:id>)는 id 부분만 키로 사용한다
 *   (MessageReaction.emoji.id와 정확히 일치시키기 위함 — 이름은 바뀔 수 있지만 id는 불변).
 * - 유니코드 이모지는 문자열 그대로가 키가 된다 (MessageReaction.emoji.name과 일치).
 */
export function parseEmojiKey(input: string): string {
    const customEmojiMatch = /^<a?:\w+:(\d+)>$/.exec(input.trim());
    return customEmojiMatch ? customEmojiMatch[1] : input.trim();
}
