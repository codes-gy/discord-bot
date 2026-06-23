function isKoreanLastChar(word: string): boolean {
    if (!word) return false;

    const lastChar = word.charCodeAt(word.length - 1);

    return lastChar >= 0xac00 && lastChar <= 0xd7a3;
}

function hasFinalConsonant(word: string): boolean {
    if (!isKoreanLastChar(word)) {
        return false;
    }

    const lastChar = word.charCodeAt(word.length - 1);

    return (lastChar - 0xac00) % 28 !== 0;
}

export function getTopicParticle(word: string): string {
    if (!isKoreanLastChar(word)) {
        return '은/는';
    }

    return hasFinalConsonant(word) ? '은' : '는';
}

export function getSubjectParticle(word: string): string {
    if (!isKoreanLastChar(word)) {
        return '이/가';
    }

    return hasFinalConsonant(word) ? '이' : '가';
}
