globalThis.CommunityReactionsTemplates = (() => {
'use strict';

function create(deps) {
    const {
        ADD_OPTION_VALUE,
        COUNTRY_PRESETS,
        DEFAULT_MAX_TOKENS,
        LANGUAGE_PRESETS,
        MEDIA_TYPES,
        NPC_SITE_KEYS,
        REACTION_MODES,
        READER_SITE_KEYS,
        SITE_PRESETS,
        buildProfileOptions,
        createEmptyIndex,
        createMaskedReviewerId,
        escapeHtml,
        getCommunityOptions,
        getDefaultRange,
        getPostKey,
        getViewLabel,
        sanitizeId,
        state,
    } = deps;

function renderInfoIcon(label, text) {
    const key = label.replace(/\s+/g, '-');
    return `
        <button class="crx-info-button" type="button" data-crx-help="${escapeHtml(key)}" aria-expanded="false" title="${escapeHtml(label)} 설명">i</button>
        <span class="crx-help-text" data-crx-help-text="${escapeHtml(key)}">${escapeHtml(text)}</span>
    `;
}

function renderOptions(entries, getLabel = value => value) {
    return entries.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(getLabel(label))}</option>`).join('');
}

function renderSiteOptions(siteKeys, valuePrefix = '') {
    return siteKeys.map(value => `<option value="${escapeHtml(`${valuePrefix}${value}`)}" data-site="${escapeHtml(value)}">${escapeHtml(SITE_PRESETS[value].label)}</option>`).join('');
}

function getComposerOptions(context, index) {
    const siteOptions = renderSiteOptions(READER_SITE_KEYS, 'site:');
    const savedReaderOptions = (index.reader_communities || []).map(community => `<option value="custom:${escapeHtml(community.id)}" data-id="${escapeHtml(community.id)}" data-site="${escapeHtml(community.site)}">${escapeHtml(community.title)}</option>`).join('');
    const savedTopicOptions = (index.npc_topics || []).map(topic => `<option value="${escapeHtml(topic.id)}" data-site="${escapeHtml(topic.site)}">${escapeHtml(topic.title)}</option>`).join('');

    return {
        modeOptions: renderOptions(Object.entries(REACTION_MODES)),
        readerCommunityOptions: `${siteOptions}${savedReaderOptions}<option value="${ADD_OPTION_VALUE}">+ 추가하기</option>`,
        readerCommunitySiteOptions: renderSiteOptions(READER_SITE_KEYS),
        topicOptions: `${savedTopicOptions || '<option value="">등록된 카테고리 없음</option>'}<option value="${ADD_OPTION_VALUE}">+ 추가하기</option>`,
        npcSiteOptions: renderSiteOptions(NPC_SITE_KEYS),
        countryOptions: renderOptions(Object.entries(COUNTRY_PRESETS), country => country.label),
        langOptions: renderOptions(Object.entries(LANGUAGE_PRESETS)),
        mediaOptions: renderOptions(Object.entries(MEDIA_TYPES)),
        profileOptions: buildProfileOptions(context),
    };
}

function renderComposerHeader() {
    return `
        <div class="crx-header">
            <div>
                <div class="crx-eyebrow">Community Reactions</div>
                <div class="crx-title">커뮤니티 보기</div>
            </div>
            <button id="crx-close-composer" class="crx-icon-button" type="button" aria-label="닫기"><i class="fa-solid fa-xmark"></i></button>
        </div>
    `;
}

function renderReactionModeSection(modeOptions) {
    return `
        <div class="crx-section">
            <label class="crx-field-wrap">
                <span class="crx-label crx-label-with-info">
                    <span>반응 유형</span>
                    ${renderInfoIcon('반응유형', '독자 반응은 이 채팅을 소설, 드라마 등으로 가정하고 팬들의 반응을 보여줍니다. NPC 반응은 이야기 속 세계관에 인터넷이 있다는 가정으로 반응을 보여주며, 게시판 사용자가 누구인지는 자유롭게 설정할 수 있습니다.')}
                </span>
                <select id="crx-reaction-mode" class="crx-field">${modeOptions}</select>
            </label>
        </div>
    `;
}

function renderCommunityPickerSections(options) {
    return `
        <div id="crx-topic-section" class="crx-section is-hidden">
            <label id="crx-topic-row" class="crx-field-wrap">
                <span class="crx-label">NPC 반응 카테고리</span>
                <select id="crx-topic" class="crx-field">
                    ${options.topicOptions}
                </select>
            </label>
        </div>
        <div id="crx-reader-community-section" class="crx-section">
            <label id="crx-reader-community-row" class="crx-field-wrap">
                <span class="crx-label">커뮤니티</span>
                <select id="crx-reader-community" class="crx-field">
                    ${options.readerCommunityOptions}
                </select>
            </label>
        </div>
    `;
}

function renderCommunityEditForms(options) {
    return `
        <div class="crx-section">
            <div id="crx-reader-community-form" class="crx-topic-form is-hidden">
                <label class="crx-field-wrap">
                    <span class="crx-label">커뮤니티 제목</span>
                    <input id="crx-reader-community-title" class="crx-field" type="text" placeholder="예: 야구팬 타임라인">
                </label>
                <label class="crx-field-wrap">
                    <span class="crx-label">기본 커뮤니티</span>
                    <select id="crx-reader-community-site" class="crx-field">${options.readerCommunitySiteOptions}</select>
                </label>
                <label class="crx-field-wrap crx-full-span">
                    <span class="crx-label">커뮤니티 프롬프트</span>
                    <textarea id="crx-reader-community-prompt" class="crx-field crx-textarea" placeholder="예: - 야구를 좋아하는 유저들로만 이루어진 타임라인.&#13;&#10;- 반드시 야구 이야기를 내용에 포함해라.&#13;&#10;- 욕설, 비속어를 많이 사용할 것."></textarea>
                </label>
                <div class="crx-topic-form-actions crx-full-span">
                    <button id="crx-save-reader-community" class="crx-primary-button" type="button">커뮤니티 추가</button>
                    <button id="crx-delete-reader-community" class="crx-secondary-button crx-danger" type="button">삭제하기</button>
                </div>
            </div>
            <div id="crx-topic-form" class="crx-topic-form is-hidden">
                <label class="crx-field-wrap">
                    <span class="crx-label">카테고리 제목</span>
                    <input id="crx-topic-title" class="crx-field" type="text" placeholder="예: 남주 학교 에브리타임">
                </label>
                <label class="crx-field-wrap">
                    <span class="crx-label">대상 게시판</span>
                    <select id="crx-topic-site" class="crx-field">${options.npcSiteOptions}</select>
                </label>
                <label class="crx-field-wrap crx-full-span">
                    <span class="crx-label">카테고리 프롬프트</span>
                    <textarea id="crx-topic-prompt" class="crx-field crx-textarea" placeholder="예: 소설 속 남주인공과 같은 학교 학생들이 익명 게시판에서 사건을 두고 떠드는 반응"></textarea>
                </label>
                <div class="crx-topic-form-actions crx-full-span">
                    <button id="crx-save-topic" class="crx-primary-button" type="button">카테고리 추가</button>
                    <button id="crx-delete-topic" class="crx-secondary-button crx-danger" type="button">삭제하기</button>
                </div>
            </div>
        </div>
    `;
}

function renderMessageRangeSection(range) {
    return `
        <div class="crx-section crx-message-range">
            <span class="crx-label">반응을 확인할 메시지는</span>
            <label class="crx-inline-field">
                <input id="crx-range-start" class="crx-field" type="number" min="1" max="${range.max}" value="${range.start}">
                <span>부터</span>
            </label>
            <span id="crx-range-start-preview" class="crx-message-preview"></span>
            <label class="crx-inline-field">
                <input id="crx-range-end" class="crx-field" type="number" min="1" max="${range.max}" value="${range.end}">
                <span>까지</span>
            </label>
            <span id="crx-range-end-preview" class="crx-message-preview"></span>
        </div>
    `;
}

function renderGenerationOptionsSection(options) {
    return `
        <div class="crx-section crx-options-grid">
            <label class="crx-field-wrap">
                <span class="crx-label crx-label-with-info">
                    <span>국가</span>
                    ${renderInfoIcon('국가', '해당 커뮤니티 유저들의 국적. 반응은 국가에 맞는 말투와 분위기로 생성됩니다.')}
                </span>
                <select id="crx-country" class="crx-field">${options.countryOptions}</select>
            </label>
            <label class="crx-field-wrap">
                <span class="crx-label">출력 언어</span>
                <select id="crx-language" class="crx-field">${options.langOptions}</select>
            </label>
            <label id="crx-media-row" class="crx-field-wrap">
                <span class="crx-label">원작 매체</span>
                <select id="crx-media-type" class="crx-field">${options.mediaOptions}</select>
            </label>
            <label class="crx-field-wrap">
                <span class="crx-label">연결 프로필</span>
                <select id="crx-api-source" class="crx-field">${options.profileOptions}</select>
            </label>
            <label class="crx-field-wrap">
                <span class="crx-label">답변 최대 토큰 수</span>
                <input id="crx-max-tokens" class="crx-field" type="number" min="1000" max="64000" step="500" value="${DEFAULT_MAX_TOKENS}">
            </label>
        </div>
    `;
}

function renderPostCountSection() {
    return `
        <div class="crx-section">
            <div class="crx-field-wrap crx-range-field">
                <span class="crx-label">게시글 수</span>
                <span id="crx-post-count-value" class="crx-muted"></span>
                <input id="crx-post-count" class="crx-range" type="range">
            </div>
        </div>
    `;
}

function renderComposerCheckOptions() {
    return `
        <div class="crx-section crx-check-grid">
            <label class="crx-check-row">
                <input id="crx-include-hidden" type="checkbox">
                <span class="crx-check-text">숨김 메시지 포함</span>
            </label>
            <label class="crx-check-row">
                <input id="crx-include-world-info" type="checkbox">
                <span class="crx-check-text">월드인포 포함</span>
            </label>
            <label class="crx-check-row">
                <input id="crx-include-character-card" type="checkbox">
                <span class="crx-check-text">캐릭터카드 포함</span>
            </label>
            <label class="crx-check-row">
                <input id="crx-has-anti" type="checkbox">
                <span class="crx-check-text">
                    <span>안티반응포함</span>
                    ${renderInfoIcon('안티반응포함', '작품을 비판, 비난하는 안티의 글도 포함. 팬들이 댓글로 싸울 수도 있습니다.')}
                </span>
            </label>
            <label id="crx-preserve-row" class="crx-check-row">
                <input id="crx-preserve-original" type="checkbox">
                <span class="crx-check-text">
                    <span>원문보존</span>
                    ${renderInfoIcon('원문보존', '국적과 출력 언어가 다를 경우, 원문과 번역을 모두 생성합니다. 내용이 두 배가 되므로 토큰을 많이 사용합니다.')}
                </span>
            </label>
        </div>
    `;
}

function renderCustomPromptSection() {
    return `
        <div id="crx-custom-prompt-section" class="crx-section">
            <label class="crx-field-wrap">
                <span class="crx-label">커스텀 프롬프트</span>
                <textarea id="crx-custom-prompt" class="crx-field crx-textarea" placeholder="말투나 게시판의 성격, 유저들의 성향을 적을 수 있어요."></textarea>
            </label>
        </div>
    `;
}

function renderComposerFooter() {
    return `
        <div class="crx-footer">
            <button id="crx-open-library" class="crx-secondary-button" type="button">커뮤니티 보기</button>
            <button id="crx-generate" class="crx-primary-button" type="button">생성하기</button>
        </div>
    `;
}

function buildComposerHtml(context, index = createEmptyIndex('unknown')) {
    const range = getDefaultRange(context);
    const options = getComposerOptions(context, index);

    return `
        <div class="crx-popup">
            ${renderComposerHeader()}
            <div class="crx-sheet">
                ${renderReactionModeSection(options.modeOptions)}
                ${renderCommunityPickerSections(options)}
                ${renderCommunityEditForms(options)}
                ${renderMessageRangeSection(range)}
                ${renderGenerationOptionsSection(options)}
                ${renderPostCountSection()}
                ${renderComposerCheckOptions()}
                ${renderCustomPromptSection()}
            </div>
            ${renderComposerFooter()}
        </div>
    `;
}

function buildViewerHtml(result, index) {
    const communityOptions = getCommunityOptions(index).map(option => {
        return `<option value="${escapeHtml(option.key)}" ${option.key === state.activeViewKey ? 'selected' : ''}>${escapeHtml(option.label)}</option>`;
    }).join('');
    const site = getViewLabel(index, state.activeViewKey) || SITE_PRESETS[state.activeCommunity]?.label || state.activeCommunity;

    return `
        <div class="crx-popup crx-viewer">
            <div class="crx-header">
                <div class="crx-viewer-heading">
                    <div class="crx-eyebrow">${escapeHtml(site)}</div>
                    <select id="crx-community-select" class="crx-title-select" aria-label="커뮤니티 선택">${communityOptions}</select>
                </div>
                <button id="crx-toggle-delete-mode" class="crx-icon-button crx-delete-mode-button" type="button" aria-label="삭제모드" aria-pressed="false"><i class="fa-solid fa-trash"></i></button>
                <button id="crx-close-viewer" class="crx-icon-button" type="button" aria-label="닫기"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="crx-viewer-tools">
                <div class="crx-delete-actions">
                    <button id="crx-delete-selected-posts" class="crx-tool-button" type="button"><i class="fa-solid fa-trash"></i><span>선택 삭제</span></button>
                    <button id="crx-delete-category" class="crx-tool-button crx-danger" type="button"><i class="fa-solid fa-folder-minus"></i><span>전체 삭제</span></button>
                </div>
            </div>
            <div id="crx-post-list" class="crx-post-list"></div>
        </div>
    `;
}

function getPostText(post, result, original = false) {
    if (result.generation.preserve_original) {
        return original ? post.original?.content : post.translation?.content;
    }
    return post.content;
}

function getReplyText(reply, result, original = false) {
    if (result.generation.preserve_original) {
        return original ? reply.original?.content : reply.translation?.content;
    }
    return reply.content;
}

function getPostTextPair(post, result) {
    return {
        translated: getPostText(post, result, false),
        original: getPostText(post, result, true),
    };
}

function getReplyTextPair(reply, result) {
    return {
        translated: getReplyText(reply, result, false),
        original: getReplyText(reply, result, true),
    };
}

function renderPostCheckbox(postKey) {
    return `<label class="crx-post-check"><input type="checkbox" value="${escapeHtml(postKey)}" aria-label="게시글 선택"></label>`;
}

function renderOriginalContent(original, className = 'crx-content crx-original') {
    return original ? `<div class="${className}">${escapeHtml(original)}</div>` : '';
}

function renderTranslationBar(post, result) {
    if (!result.generation.preserve_original || !post.original || !post.translation) {
        return '';
    }

    return `
        <div class="crx-translation-bar">
            <span>원문 언어 ${escapeHtml(getLanguageLabel(post.original.language))}</span>
            <button class="crx-translation-toggle" type="button">원본 보기</button>
        </div>
    `;
}

function getLanguageLabel(language) {
    return LANGUAGE_PRESETS[language] || language || '원문';
}

const TWITTER_AVATAR_PALETTE = Object.freeze([
    ['#ff4d6d', '#f9c74f', '#00bbf9', 'rgba(255, 255, 255, 0.44)'],
    ['#7c3aed', '#ec4899', '#f97316', 'rgba(255, 255, 255, 0.42)'],
    ['#06b6d4', '#22c55e', '#fde047', 'rgba(255, 255, 255, 0.4)'],
    ['#2563eb', '#a855f7', '#fb7185', 'rgba(255, 255, 255, 0.42)'],
    ['#14b8a6', '#84cc16', '#f59e0b', 'rgba(255, 255, 255, 0.4)'],
    ['#f43f5e', '#8b5cf6', '#38bdf8', 'rgba(255, 255, 255, 0.42)'],
    ['#fb923c', '#ef4444', '#a855f7', 'rgba(255, 255, 255, 0.4)'],
    ['#2dd4bf', '#3b82f6', '#c084fc', 'rgba(255, 255, 255, 0.42)'],
    ['#eab308', '#22c55e', '#0ea5e9', 'rgba(255, 255, 255, 0.4)'],
    ['#f472b6', '#facc15', '#34d399', 'rgba(255, 255, 255, 0.42)'],
]);

const TWITTER_AVATAR_PATTERNS = Object.freeze(['rings', 'grid', 'stripes', 'dots', 'beam', 'corner']);
const TWITTER_AVATAR_ANGLES = Object.freeze(['25deg', '70deg', '120deg', '160deg', '210deg', '260deg', '315deg']);
const TWITTER_AVATAR_EMOJIS = Object.freeze(['✨', '🔥', '💫', '🌙', '🫧', '🍀', '🧃', '🎧', '🪐', '⚡', '🍒', '🩵', '💜', '😵‍💫', '🤍', '🦋']);

function hashString(value) {
    const text = String(value || '');
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function getTwitterAvatarStyle(author, handle = '') {
    const key = `${author || ''}|${handle || ''}`.trim() || 'anonymous';
    const hash = hashString(key);
    const [start, mid, end, accent] = TWITTER_AVATAR_PALETTE[hash % TWITTER_AVATAR_PALETTE.length];
    const pattern = TWITTER_AVATAR_PATTERNS[Math.floor(hash / TWITTER_AVATAR_PALETTE.length) % TWITTER_AVATAR_PATTERNS.length];
    const angle = TWITTER_AVATAR_ANGLES[Math.floor(hash / 17) % TWITTER_AVATAR_ANGLES.length];
    return `--crx-avatar-angle: ${angle}; --crx-avatar-start: ${start}; --crx-avatar-mid: ${mid}; --crx-avatar-end: ${end}; --crx-avatar-accent: ${accent}; --crx-avatar-pattern: ${pattern};`;
}

function getTwitterAvatarContent(author, handle = '') {
    const key = `${author || ''}|${handle || ''}`.trim() || 'anonymous';
    const hash = hashString(key);
    if (hash % 2 === 0) {
        return '';
    }
    return escapeHtml(TWITTER_AVATAR_EMOJIS[Math.floor(hash / 3) % TWITTER_AVATAR_EMOJIS.length]);
}

function formatMetric(value) {
    const number = Number(value || 0);
    if (!Number.isFinite(number) || number <= 0) {
        return '';
    }
    if (number >= 10000) {
        return `${Math.round(number / 1000) / 10}만`;
    }
    if (number >= 1000) {
        return `${Math.round(number / 100) / 10}천`;
    }
    return String(number);
}

function getDaumTitle(post) {
    return post.title;
}

function getDaumCategory(post) {
    return post.category;
}

function formatDaumNumber(value) {
    const number = Number(value || 0);
    if (!Number.isFinite(number) || number <= 0) {
        return '0';
    }
    return number.toLocaleString('ko-KR');
}

function getPostReplyCount(post) {
    const explicit = Number(post?.replies_count);
    if (Number.isFinite(explicit)) {
        return Math.max(0, explicit);
    }
    return Array.isArray(post?.replies) ? post.replies.length : 0;
}

function getDateOrNull(value) {
    const date = new Date(value || '');
    return Number.isNaN(date.getTime()) ? null : date;
}

function isSameLocalDay(a, b) {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}

function pad2(value) {
    return String(value).padStart(2, '0');
}

function getResultDateValues(result) {
    const posts = Array.isArray(result?.posts) ? result.posts : [];
    return posts.map(post => post?.created_at);
}

function getResultReferenceDate(result) {
    if (result?.generation?.reaction_mode !== 'npc') {
        return new Date();
    }

    const newestTime = getResultDateValues(result)
        .map(value => getDateOrNull(value)?.getTime())
        .filter(Number.isFinite)
        .reduce((newest, time) => Math.max(newest, time), -Infinity);

    return Number.isFinite(newestTime) ? new Date(newestTime) : new Date();
}

function formatTwitterDate(value, referenceDate = new Date()) {
    const date = getDateOrNull(value);
    if (!date) {
        return '방금 전';
    }

    const now = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime()) ? referenceDate : new Date();
    const diffMs = Math.max(0, now.getTime() - date.getTime());
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 60) {
        return `${Math.max(1, minutes)}분 전`;
    }

    const hours = Math.floor(diffMs / 3600000);
    if (hours < 24) {
        return `${hours}시간 전`;
    }

    const days = Math.floor(diffMs / 86400000);
    if (days < 7) {
        return `${Math.max(1, days)}일 전`;
    }

    if (date.getFullYear() === now.getFullYear()) {
        return `${date.getMonth() + 1}월 ${date.getDate()}일`;
    }

    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function formatDaumDate(value, referenceDate = new Date()) {
    const date = getDateOrNull(value);
    if (!date) {
        return '방금';
    }

    const now = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime()) ? referenceDate : new Date();
    if (isSameLocalDay(date, now)) {
        return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
    }

    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function formatDaumDetailDate(value, referenceDate = new Date()) {
    const date = getDateOrNull(value);
    if (!date) {
        return '방금';
    }

    const now = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime()) ? referenceDate : new Date();
    if (isSameLocalDay(date, now)) {
        return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
    }

    return `${date.getFullYear()}년 ${pad2(date.getMonth() + 1)}월 ${pad2(date.getDate())}일 ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatEverytimeDetailDate(value) {
    const date = getDateOrNull(value);
    if (!date) {
        return '방금';
    }
    return `${pad2(date.getMonth() + 1)}/${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatReviewDate(value) {
    const date = getDateOrNull(value);
    if (!date) {
        return '오늘';
    }
    return `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`;
}

function formatReviewReplyDate(value) {
    const date = getDateOrNull(value);
    if (!date) {
        return '오늘';
    }
    return `${formatReviewDate(value)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function renderStarRating(value) {
    const rating = Math.max(1, Math.min(5, Math.round(Number(value || 5))));
    return Array.from({ length: 5 }, (_, index) => `<span class="${index < rating ? 'is-filled' : ''}">★</span>`).join('');
}

function renderWebNovelReviewPost(post, result, postKey = getPostKey(result.id, post.id)) {
    const { translated, original } = getPostTextPair(post, result);
    const replies = post.replies.map(reply => renderWebNovelReviewReply(reply, result)).join('');
    const commentCount = getPostReplyCount(post);
    const reviewerId = post.reviewer_id || createMaskedReviewerId(post.id);
    const repliesId = `crx-webnovel-replies-${sanitizeId(postKey)}`;

    return `
        <article class="crx-post crx-webnovel-review" data-post-key="${escapeHtml(postKey)}">
            ${renderPostCheckbox(postKey)}
            <div class="crx-webnovel-stars" aria-label="별점 ${escapeHtml(post.rating)}점">${renderStarRating(post.rating)}</div>
            ${renderTranslationBar(post, result)}
            <div class="crx-content crx-webnovel-content crx-translated">${escapeHtml(translated)}</div>
            ${renderOriginalContent(original, 'crx-content crx-webnovel-content crx-original')}
            <div class="crx-webnovel-row">
                <div class="crx-webnovel-user">
                    <span class="crx-webnovel-buyer">구매자</span>
                    <span>${escapeHtml(reviewerId)}</span>
                </div>
                <div class="crx-webnovel-actions">
                    <button class="crx-webnovel-comment-toggle" type="button" aria-expanded="false" aria-controls="${escapeHtml(repliesId)}">댓글 ${formatDaumNumber(commentCount)}</button>
                    <span><i class="fa-regular fa-thumbs-up" aria-hidden="true"></i> ${formatDaumNumber(post.likes)}</span>
                </div>
            </div>
            <div class="crx-webnovel-date">${escapeHtml(formatReviewDate(post.created_at))} <span>|</span> 신고 · 차단</div>
            <div id="${escapeHtml(repliesId)}" class="crx-webnovel-replies" hidden>
                ${replies || '<div class="crx-webnovel-empty-replies">댓글이 없습니다.</div>'}
            </div>
        </article>
    `;
}

function renderWebNovelReviewReply(reply, result) {
    const { translated, original } = getReplyTextPair(reply, result);
    const reviewerId = reply.reviewer_id || createMaskedReviewerId(reply.id);
    const createdAt = formatReviewReplyDate(reply.created_at);
    return `
        <div class="crx-webnovel-reply">
            <div class="crx-webnovel-reply-line">
                <span class="crx-webnovel-reply-mark">ㄴ</span>
                <div class="crx-content crx-webnovel-reply-content crx-translated">${escapeHtml(translated)}</div>
            </div>
            ${renderOriginalContent(original)}
            <div class="crx-webnovel-reply-meta">
                <span>${escapeHtml(reviewerId)}</span>
                <span>|</span>
                <span>${escapeHtml(createdAt)}</span>
                <span>|</span>
                <span>신고 · 차단</span>
            </div>
        </div>
    `;
}

function renderTwitterPost(post, result, postKey = getPostKey(result.id, post.id)) {
    const { translated, original } = getPostTextPair(post, result);
    const referenceDate = getResultReferenceDate(result);
    const replies = post.replies.map((reply, index) => renderTwitterReply(reply, result, index < post.replies.length - 1, referenceDate)).join('');
    const createdAtLabel = formatTwitterDate(post.created_at, referenceDate);
    const commentCount = getPostReplyCount(post);

    return `
        <article class="crx-post crx-twitter-post" data-post-key="${escapeHtml(postKey)}">
            ${renderPostCheckbox(postKey)}
            <div class="crx-twitter-row crx-twitter-main-row">
                <div class="crx-twitter-avatar-slot ${replies ? 'has-replies' : ''}">
                    <div class="crx-twitter-avatar" style="${escapeHtml(getTwitterAvatarStyle(post.author, post.handle))}" aria-hidden="true"><span class="crx-twitter-avatar-symbol">${getTwitterAvatarContent(post.author, post.handle)}</span></div>
                </div>
                <div class="crx-twitter-body">
                    <div class="crx-twitter-head">
                        <span class="crx-twitter-author">${escapeHtml(post.author)}</span>
                        ${post.handle ? `<span class="crx-twitter-handle">${escapeHtml(post.handle)}</span>` : ''}
                        <span class="crx-dot">·</span>
                        <span class="crx-twitter-time">${escapeHtml(createdAtLabel)}</span>
                        <span class="crx-twitter-more" aria-hidden="true"><i class="fa-solid fa-ellipsis"></i></span>
                    </div>
                    ${renderTranslationBar(post, result)}
                    <div class="crx-content crx-translated">${escapeHtml(translated)}</div>
                    ${renderOriginalContent(original)}
                    ${renderQuotedTweet(post.quoted_post, result, referenceDate)}
                    <div class="crx-twitter-actions">
                        <span title="댓글"><i class="fa-regular fa-comment"></i>${formatMetric(commentCount)}</span>
                        <span title="재게시"><i class="fa-solid fa-retweet"></i>${formatMetric(post.reposts)}</span>
                        <span title="좋아요"><i class="fa-regular fa-heart"></i>${formatMetric(post.likes)}</span>
                        <span title="조회"><i class="fa-solid fa-chart-simple"></i>${formatMetric(post.views)}</span>
                        <span class="flex-0" title="북마크"><i class="fa-regular fa-bookmark"></i></span>
                        <span class="flex-0" title="공유"><i class="fa-solid fa-arrow-up-from-bracket"></i></span>
                    </div>
                </div>
            </div>
            ${replies ? `<div class="crx-twitter-replies">${replies}</div>` : ''}
        </article>
    `;
}

function renderQuotedTweet(quotedPost, result, referenceDate = getResultReferenceDate(result)) {
    if (!quotedPost) {
        return '';
    }

    const { translated, original } = getPostTextPair(quotedPost, result);
    if (!translated && !original) {
        return '';
    }

    return `
        <div class="crx-twitter-quote">
            <div class="crx-twitter-quote-header">
                <div class="crx-twitter-avatar crx-twitter-quote-avatar" style="${escapeHtml(getTwitterAvatarStyle(quotedPost.author, quotedPost.handle))}" aria-hidden="true"><span class="crx-twitter-avatar-symbol">${getTwitterAvatarContent(quotedPost.author, quotedPost.handle)}</span></div>
                <div class="crx-twitter-quote-meta">
                    <span class="crx-twitter-quote-author">${escapeHtml(quotedPost.author || '익명')}</span>
                    ${quotedPost.handle ? `<span class="crx-twitter-quote-handle">${escapeHtml(quotedPost.handle)}</span>` : ''}
                    ${quotedPost.created_at ? `<span class="crx-twitter-quote-dot">·</span><span class="crx-twitter-quote-time">${escapeHtml(formatTwitterDate(quotedPost.created_at, referenceDate))}</span>` : ''}
                </div>
            </div>
            <div class="crx-twitter-quote-content crx-translated">${escapeHtml(translated)}</div>
            ${renderOriginalContent(original, 'crx-twitter-quote-content crx-twitter-quote-original crx-original')}
        </div>
    `;
}

function renderTwitterReply(reply, result, hasFollowingReply = false, referenceDate = getResultReferenceDate(result)) {
    const { translated, original } = getReplyTextPair(reply, result);
    const createdAtLabel = formatTwitterDate(reply.created_at, referenceDate);
    return `
        <div class="crx-twitter-row crx-twitter-reply">
            <div class="crx-twitter-reply-avatar-slot ${hasFollowingReply ? 'has-following-reply' : ''}">
                <div class="crx-twitter-avatar crx-twitter-avatar-small" style="${escapeHtml(getTwitterAvatarStyle(reply.author, reply.handle))}" aria-hidden="true"><span class="crx-twitter-avatar-symbol">${getTwitterAvatarContent(reply.author, reply.handle)}</span></div>
            </div>
            <div class="crx-twitter-reply-body">
                <div class="crx-twitter-head">
                    <span class="crx-twitter-author">${escapeHtml(reply.author)}</span>
                    ${reply.handle ? `<span class="crx-twitter-handle">${escapeHtml(reply.handle)}</span>` : ''}
                    <span class="crx-dot">·</span>
                    <span class="crx-twitter-time">${escapeHtml(createdAtLabel)}</span>
                    <span class="crx-twitter-more" aria-hidden="true"><i class="fa-solid fa-ellipsis"></i></span>
                </div>
                <div class="crx-content crx-translated">${escapeHtml(translated)}</div>
                ${renderOriginalContent(original)}
                <div class="crx-twitter-reply-actions" aria-hidden="true">
                    <span><i class="fa-regular fa-comment"></i>${formatMetric(reply.replies_count || 0)}</span>
                    <span><i class="fa-solid fa-retweet"></i>${formatMetric(reply.reposts || 0)}</span>
                    <span><i class="fa-regular fa-heart"></i>${formatMetric(reply.likes)}</span>
                    <span><i class="fa-solid fa-chart-simple"></i>${formatMetric(reply.views || 0)}</span>
                    <span class="flex-0"><i class="fa-regular fa-bookmark"></i></span>
                    <span class="flex-0"><i class="fa-solid fa-arrow-up-from-bracket"></i></span>
                </div>
            </div>
        </div>
    `;
}

function renderDaumListItem(post, postKey, isLatestResult = false, result = null) {
    const commentCount = getPostReplyCount(post);
    const author = getDaumAuthor(post.author);
    const createdAtLabel = formatDaumDate(post.created_at, getResultReferenceDate(result));

    return `
        <article class="crx-post crx-daum-list-item" data-post-key="${escapeHtml(postKey)}" role="button" tabindex="0">
            ${renderPostCheckbox(postKey)}
            <div class="crx-daum-list-main">
                <div class="crx-daum-list-title">${escapeHtml(getDaumTitle(post))}</div>
                <div class="crx-daum-list-meta">
                    <span>${escapeHtml(author)}</span>
                    <span class="crx-daum-meta-dot">·</span>
                    <span>${escapeHtml(createdAtLabel)}</span>
                    ${isLatestResult ? '<span class="crx-daum-new-badge">N</span><span class="crx-daum-meta-dot">·</span>' : ''}
                    <span>조회 ${formatDaumNumber(post.views)}</span>
                </div>
            </div>
            <div class="crx-daum-list-count">
                <span>${formatDaumNumber(commentCount)}</span>
            </div>
        </article>
    `;
}

function renderDaumPost(post, result, postKey = getPostKey(result.id, post.id)) {
    const { translated, original } = getPostTextPair(post, result);
    const referenceDate = getResultReferenceDate(result);
    const replies = post.replies.map(reply => renderDaumReply(reply, result, referenceDate)).join('');
    const commentCount = getPostReplyCount(post);
    const author = getDaumAuthor(post.author);
    const createdAtLabel = formatDaumDetailDate(post.created_at, referenceDate);

    return `
        <article class="crx-post crx-daum-post" data-post-key="${escapeHtml(postKey)}">
            <div class="crx-daum-card">
                <div class="crx-daum-appbar">
                    <button class="crx-daum-back" type="button" aria-label="목록으로 돌아가기"><i class="fa-solid fa-chevron-left"></i></button>
                    <div class="crx-daum-appbar-title">${escapeHtml(getDaumCategory(post))}</div>
                    <div class="crx-daum-appbar-actions" aria-hidden="true">
                        <i class="fa-regular fa-bookmark"></i>
                        <i class="fa-solid fa-bars"></i>
                    </div>
                </div>
                <div class="crx-daum-top">
                    <div class="crx-daum-heading">${escapeHtml(getDaumTitle(post))}</div>
                    <div class="crx-daum-meta-row">
                        <div class="crx-daum-writer">
                            <span>${escapeHtml(author)}</span>
                        </div>
                        <div class="crx-daum-detail-stats">
                            <span><i class="fa-regular fa-clock"></i> ${escapeHtml(createdAtLabel)}</span>
                            <span>·</span>
                            <span><i class="fa-regular fa-rectangle-list"></i> ${formatDaumNumber(post.views)}</span>
                        </div>
                        <div class="crx-daum-detail-comment-count">${formatDaumNumber(commentCount)}</div>
                    </div>
                </div>
                <div class="crx-daum-body">
                    ${renderTranslationBar(post, result)}
                    <div class="crx-content crx-translated">${escapeHtml(translated)}</div>
                    ${renderOriginalContent(original)}
                    <div class="crx-daum-return-row">
                        <button class="crx-daum-return-to-list" type="button">목록으로</button>
                    </div>
                </div>
                <div class="crx-daum-comment-area">
                    <div class="crx-daum-comment-head">
                        <span class="crx-daum-comment-bell"><i class="fa-regular fa-bell"></i></span>
                        <span>댓글</span>
                        <span class="crx-daum-comment-total">${formatDaumNumber(commentCount)}</span>
                    </div>
                    <div class="crx-daum-replies">${replies || '<div class="crx-daum-empty-comment">댓글이 없습니다.</div>'}</div>
                </div>
            </div>
        </article>
    `;
}

function renderDaumReply(reply, result, referenceDate = getResultReferenceDate(result)) {
    const { translated, original } = getReplyTextPair(reply, result);
    const author = getDaumAuthor(reply.author);
    const createdAtLabel = formatDaumDetailDate(reply.created_at, referenceDate);
    return `
        <div class="crx-daum-reply ${reply.is_reply ? 'is-reply' : ''}">
            ${reply.is_reply ? '<span class="crx-daum-reply-mark">ㄴ</span>' : ''}
            <div class="crx-daum-reply-head">
                <div>
                    <span class="crx-daum-reply-author">${escapeHtml(author)}</span>
                </div>
                <span class="crx-daum-reply-menu" aria-hidden="true"><i class="fa-solid fa-ellipsis-vertical"></i></span>
            </div>
            <div class="crx-daum-reply-time">${escapeHtml(createdAtLabel)}</div>
            <div class="crx-content crx-translated">${escapeHtml(translated)}</div>
            ${renderOriginalContent(original)}
        </div>
    `;
}

function getEverytimeAnonymousName(value, fallback = 1) {
    const text = String(value || '').trim();
    if (/^익명(?:\d+)?$/.test(text) || text === '익명 (글쓴이)') {
        return text;
    }
    return fallback <= 1 ? '익명' : `익명${fallback}`;
}

function renderEverytimeListItem(post, result, postKey) {
    const commentCount = getPostReplyCount(post);
    const translated = getPostText(post, result, false) || post.content || '';
    const createdAtLabel = formatTwitterDate(post.created_at, getResultReferenceDate(result));

    return `
        <article class="crx-post crx-daum-list-item crx-everytime-list-item" data-post-key="${escapeHtml(postKey)}" role="button" tabindex="0">
            ${renderPostCheckbox(postKey)}
            <div class="crx-everytime-board-chip">${escapeHtml(getDaumCategory(post) || '자유게시판')}</div>
            <div class="crx-everytime-list-title">${escapeHtml(getDaumTitle(post))}</div>
            <div class="crx-content crx-everytime-list-content">${escapeHtml(translated)}</div>
            <div class="crx-everytime-list-meta">
                <span class="crx-everytime-like"><i class="fa-regular fa-thumbs-up" aria-hidden="true"></i> ${formatDaumNumber(post.likes)}</span>
                <span class="crx-everytime-comment"><i class="fa-regular fa-comment" aria-hidden="true"></i> ${formatDaumNumber(commentCount)}</span>
                <span class="crx-everytime-divider">|</span>
                <span>${escapeHtml(createdAtLabel)}</span>
                <span class="crx-everytime-divider">|</span>
                <span>익명</span>
            </div>
        </article>
    `;
}

function renderEverytimePost(post, result, postKey = getPostKey(result.id, post.id)) {
    const { translated, original } = getPostTextPair(post, result);
    const referenceDate = getResultReferenceDate(result);
    const replies = post.replies.map((reply, index) => renderEverytimeReply(reply, result, index + 1, referenceDate)).join('');
    const commentCount = getPostReplyCount(post);
    const createdAtLabel = formatEverytimeDetailDate(post.created_at);

    return `
        <article class="crx-post crx-everytime-post" data-post-key="${escapeHtml(postKey)}">
            <div class="crx-everytime-card">
                <div class="crx-everytime-appbar">
                    <button class="crx-daum-back crx-everytime-back" type="button" aria-label="목록으로 돌아가기"><i class="fa-solid fa-chevron-left"></i></button>
                    <div class="crx-everytime-appbar-title">
                        <strong>${escapeHtml(getDaumCategory(post) || '자유게시판')}</strong>
                        <span></span>
                    </div>
                    <div class="crx-everytime-appbar-actions" aria-hidden="true">
                        <i class="fa-regular fa-bell-slash"></i>
                        <i class="fa-solid fa-ellipsis-vertical"></i>
                    </div>
                </div>
                <div class="crx-everytime-article">
                    <div class="crx-everytime-author-row">
                        <span class="crx-everytime-avatar" aria-hidden="true"></span>
                        <div>
                            <div class="crx-everytime-author">익명</div>
                            <div class="crx-everytime-date">${escapeHtml(createdAtLabel)}</div>
                        </div>
                    </div>
                    <h3 class="crx-everytime-heading">${escapeHtml(getDaumTitle(post))}</h3>
                    ${renderTranslationBar(post, result)}
                    <div class="crx-content crx-everytime-content crx-translated">${escapeHtml(translated)}</div>
                    ${renderOriginalContent(original, 'crx-content crx-everytime-content crx-original')}
                    <div class="crx-everytime-stats">
                        <span class="crx-everytime-like"><i class="fa-regular fa-thumbs-up" aria-hidden="true"></i> ${formatDaumNumber(post.likes)}</span>
                        <span class="crx-everytime-comment"><i class="fa-regular fa-comment" aria-hidden="true"></i> ${formatDaumNumber(commentCount)}</span>
                        <span class="crx-everytime-scrap"><i class="fa-regular fa-star" aria-hidden="true"></i> 0</span>
                    </div>
                    <div class="crx-everytime-buttons">
                        <button type="button"><i class="fa-regular fa-thumbs-up" aria-hidden="true"></i> 공감</button>
                        <button type="button"><i class="fa-regular fa-star" aria-hidden="true"></i> 스크랩</button>
                    </div>
                </div>
                <div class="crx-everytime-replies">${replies || '<div class="crx-everytime-empty-comment">댓글이 없습니다.</div>'}</div>
                <div class="crx-everytime-comment-input" aria-hidden="true">
                    <span><i class="fa-regular fa-square-check"></i> 익명</span>
                    <span>댓글을 입력하세요.</span>
                    <i class="fa-regular fa-paper-plane"></i>
                </div>
            </div>
        </article>
    `;
}

function renderEverytimeReply(reply, result, index, referenceDate = getResultReferenceDate(result)) {
    const { translated, original } = getReplyTextPair(reply, result);
    const author = reply.is_reply ? getEverytimeAnonymousName(reply.author, index) : getEverytimeAnonymousName(reply.author, index);
    const createdAtLabel = formatEverytimeDetailDate(reply.created_at);

    return `
        <div class="crx-everytime-reply ${reply.is_reply ? 'is-reply' : ''}">
            ${reply.is_reply ? '<span class="crx-everytime-reply-mark">ㄴ</span>' : ''}
            <span class="crx-everytime-avatar crx-everytime-reply-avatar" aria-hidden="true"></span>
            <div class="crx-everytime-reply-body">
                <div class="crx-everytime-reply-top">
                    <span class="crx-everytime-reply-author">${escapeHtml(author)}</span>
                    <span class="crx-everytime-reply-actions" aria-hidden="true"><i class="fa-regular fa-comment"></i><span></span><i class="fa-regular fa-thumbs-up"></i><span></span><i class="fa-solid fa-ellipsis-vertical"></i></span>
                </div>
                <div class="crx-content crx-everytime-reply-content crx-translated">${escapeHtml(translated)}</div>
                ${renderOriginalContent(original, 'crx-content crx-everytime-reply-content crx-original')}
                <div class="crx-everytime-reply-date">${escapeHtml(createdAtLabel)}${reply.likes ? ` <span><i class="fa-regular fa-thumbs-up"></i> ${formatDaumNumber(reply.likes)}</span>` : ''}</div>
            </div>
        </div>
    `;
}

function getDaumAuthor() {
    return '익명';
}

    return {
        buildComposerHtml,
        buildViewerHtml,
        renderDaumListItem,
        renderDaumPost,
        renderEverytimeListItem,
        renderEverytimePost,
        renderTwitterPost,
        renderWebNovelReviewPost,
    };
}

return { create };
})();
