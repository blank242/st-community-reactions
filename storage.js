globalThis.CommunityReactionsStorage = (() => {
'use strict';

const DEFAULT_NPC_TOPICS = Object.freeze([
    Object.freeze({
        id: 'topic_private_thought_timeline',
        title: '속마음 타임라인',
        site: 'twitter',
        prompt: '- {{char}}와 {{user}}가 쓰는 프라이빗 트위터 계정\n- 두 계정은 모두 팔로잉 0, 팔로워 0지만 해당 타임라인에서는 두 계정의 트윗을 한꺼번에 볼 수 있다.\n- 혼자만의 일기장으로 쓴다. 속마음, 고민, 별것 아닌 생각들을 모두 적는다.',
        preserve_profile_identity: true,
        created_at: '2026-06-24T00:00:00.000Z',
        updated_at: '2026-06-24T00:00:00.000Z',
        is_default: true,
    }),
]);

function coerceBoolean(value) {
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'number') {
        return value !== 0;
    }

    if (typeof value === 'string') {
        return ['true', '1', 'yes', 'y'].includes(value.trim().toLowerCase());
    }

    return false;
}

function cloneDefaultNpcTopic(topic) {
    return { ...topic, is_default: true };
}

function getDefaultNpcTopics() {
    return DEFAULT_NPC_TOPICS.map(cloneDefaultNpcTopic);
}

function normalizeReaderSiteOptionsMap(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizePhoneAppOptionsMap(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function withDefaultNpcTopics(index) {
    const npcTopics = Array.isArray(index?.npc_topics) ? index.npc_topics : [];
    const normalizedTopics = npcTopics.map(topic => {
        if (!topic || typeof topic !== 'object') {
            return topic;
        }

        const defaultTopic = DEFAULT_NPC_TOPICS.find(item => item.id === topic?.id);
        if (!defaultTopic) {
            return topic;
        }

        return {
            ...cloneDefaultNpcTopic(defaultTopic),
            ...topic,
            preserve_profile_identity: Object.prototype.hasOwnProperty.call(topic, 'preserve_profile_identity')
                ? coerceBoolean(topic.preserve_profile_identity)
                : coerceBoolean(defaultTopic.preserve_profile_identity),
            is_default: true,
        };
    });
    const existingIds = new Set(normalizedTopics.map(topic => String(topic?.id || '')));
    const missingDefaults = DEFAULT_NPC_TOPICS
        .filter(topic => !existingIds.has(topic.id))
        .map(cloneDefaultNpcTopic);

    return {
        ...index,
        npc_topics: [...missingDefaults, ...normalizedTopics],
    };
}

function create(deps) {
    const {
        DEFAULT_MAX_TOKENS,
        FILE_PREFIX,
        JSON_INDENT,
        createId,
        getContextSafe,
        getDateOrNull,
    } = deps;

    function getHeaders() {
        return getContextSafe()?.getRequestHeaders?.() || { 'Content-Type': 'application/json' };
    }

    function encodeBase64Utf8(value) {
        const bytes = new TextEncoder().encode(value);
        const chunkSize = 0x8000;
        const chunks = [];

        for (let index = 0; index < bytes.length; index += chunkSize) {
            chunks.push(String.fromCharCode(...bytes.subarray(index, index + chunkSize)));
        }

        return btoa(chunks.join(''));
    }

    function sanitizeFilePart(value) {
        return String(value || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
    }

    function formatPathDatePart(value) {
        const date = getDateOrNull(value) || new Date();
        return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    }

    function indexFileName(chatPk) {
        return `${FILE_PREFIX}__index__${sanitizeFilePart(chatPk)}.json`;
    }

    function itemFileName(chatPk, generation, resultId, createdAt) {
        const mode = generation?.reaction_mode === 'phone'
            ? 'phone'
            : generation?.reaction_mode === 'npc' ? 'npc' : 'reader';
        const target = mode === 'phone'
            ? sanitizeFilePart(generation?.phone_app_id || generation?.site || 'app')
            : mode === 'npc'
                ? sanitizeFilePart(generation?.topic_id || generation?.site || 'topic')
                : sanitizeFilePart(generation?.reader_community_id || generation?.site || 'site');
        return `${FILE_PREFIX}__item__${sanitizeFilePart(chatPk)}__${mode}__${target}__${formatPathDatePart(createdAt)}__${sanitizeFilePart(resultId)}.json`;
    }

    function failedFileName(chatPk, failedId) {
        return `${FILE_PREFIX}__failed__${sanitizeFilePart(chatPk)}__${sanitizeFilePart(failedId)}.json`;
    }

    function filePath(fileName) {
        return `/user/files/${fileName}`;
    }

    function createEmptyIndex(chatPk) {
        return {
            version: 1,
            chat_pk: chatPk,
            items: [],
            npc_topics: getDefaultNpcTopics(),
            reader_communities: [],
            reader_site_options: {},
            phone_app_options: {},
        };
    }

    function getPhonePayloadCount(result) {
        if (Array.isArray(result?.phone?.searches)) {
            return result.phone.searches.length;
        }
        if (Array.isArray(result?.phone?.payment?.transactions)) {
            return result.phone.payment.transactions.length;
        }
        return 0;
    }

    async function uploadJson(fileName, payload) {
        const response = await fetch('/api/files/upload', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                name: fileName,
                data: encodeBase64Utf8(JSON.stringify(payload, null, JSON_INDENT)),
            }),
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }

        return response.json();
    }

    async function readJson(path) {
        const response = await fetch(path, {
            method: 'GET',
            cache: 'no-store',
            headers: getHeaders(),
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }

        return response.json();
    }

    async function deleteFile(path) {
        const response = await fetch('/api/files/delete', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ path }),
        });

        return response.ok || response.status === 404;
    }

    async function loadIndex(chatPk) {
        try {
            const index = await readJson(filePath(indexFileName(chatPk)));
            if (!Array.isArray(index.items)) {
                return createEmptyIndex(chatPk);
            }
            if (!Array.isArray(index.npc_topics)) {
                index.npc_topics = [];
            }
            if (!Array.isArray(index.reader_communities)) {
                index.reader_communities = [];
            }
            index.reader_site_options = normalizeReaderSiteOptionsMap(index.reader_site_options);
            index.phone_app_options = normalizePhoneAppOptionsMap(index.phone_app_options);
            const indexWithDefaults = withDefaultNpcTopics(index);
            indexWithDefaults.items.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
            return indexWithDefaults;
        } catch {
            return createEmptyIndex(chatPk);
        }
    }

    async function saveIndex(index, fallbackChatPk = null) {
        const chatPk = index?.chat_pk || fallbackChatPk;
        const normalizedIndex = withDefaultNpcTopics({
            ...createEmptyIndex(chatPk),
            ...index,
            reader_communities: Array.isArray(index?.reader_communities) ? index.reader_communities : [],
            reader_site_options: normalizeReaderSiteOptionsMap(index?.reader_site_options),
            phone_app_options: normalizePhoneAppOptionsMap(index?.phone_app_options),
            items: Array.isArray(index?.items) ? index.items : [],
        });
        await uploadJson(indexFileName(chatPk), normalizedIndex);
    }

    async function saveResult(result) {
        const itemName = itemFileName(result.chat_pk, result.generation, result.id, result.created_at);
        await uploadJson(itemName, result);

        const index = await loadIndex(result.chat_pk);
        const item = {
            id: result.id,
            path: filePath(itemName),
            reaction_mode: result.generation.reaction_mode || 'reader',
            phone_app_id: result.generation.phone_app_id || '',
            phone_app_label: result.generation.phone_app_label || '',
            topic_id: result.generation.topic_id || '',
            topic_title: result.generation.topic_title || '',
            preserve_profile_identity: Boolean(result.generation.preserve_profile_identity),
            reader_community_id: result.generation.reader_community_id || '',
            reader_community_title: result.generation.reader_community_title || '',
            site: result.generation.site,
            selected_site_country: result.generation.selected_site_country || result.generation.site_country,
            site_country: result.generation.site_country,
            custom_site_country: result.generation.custom_site_country || '',
            site_country_label: result.generation.site_country_label || '',
            output_language: result.generation.output_language,
            preserve_original: Boolean(result.generation.preserve_original),
            has_anti: Boolean(result.generation.has_anti),
            media_type: result.generation.media_type,
            created_at: result.created_at,
            post_count: result.generation.reaction_mode === 'phone'
                ? getPhonePayloadCount(result)
                : result.posts.length,
        };

        index.items = [item, ...index.items.filter(x => x.id !== result.id)]
            .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
        await saveIndex(index, result.chat_pk);
    }

    async function updateResult(result) {
        const index = await loadIndex(result.chat_pk);
        const target = index.items.find(x => x.id === result.id);
        const itemName = target?.path?.replace(/^\/user\/files\//, '') || itemFileName(result.chat_pk, result.generation, result.id, result.created_at);
        await uploadJson(itemName, result);
        if (target) {
            target.path = filePath(itemName);
            target.post_count = result.generation?.reaction_mode === 'phone'
                ? getPhonePayloadCount(result)
                : result.posts.length;
            await saveIndex(index, result.chat_pk);
        }
    }

    async function saveFailedGeneration(chatPk, input, raw, error, phase) {
        const failedId = createId('crx_failed');
        const fileName = failedFileName(chatPk, failedId);
        const payload = {
            version: 1,
            id: failedId,
            chat_pk: chatPk,
            created_at: new Date().toISOString(),
            phase,
            error: {
                name: error?.name || 'Error',
                message: error?.message || String(error || 'Unknown error'),
            },
            generation: {
                reaction_mode: input.reaction_mode || 'reader',
                phone_app_id: input.phone_app_id || '',
                phone_app_label: input.phone_app_label || '',
                topic_id: input.topic_id || '',
                topic_title: input.topic_title || '',
                preserve_profile_identity: Boolean(input.preserve_profile_identity),
                reader_community_id: input.reader_community_id || '',
                reader_community_title: input.reader_community_title || '',
                site: input.site,
                selected_site_country: input.selected_site_country || input.site_country,
                site_country: input.site_country,
                custom_site_country: input.custom_site_country || '',
                site_country_label: input.site_country_label || '',
                output_language: input.output_language,
                preserve_original: Boolean(input.preserve_original),
                has_anti: Boolean(input.has_anti),
                media_type: input.media_type,
                api_source: input.apiSource === 'main' ? 'main' : 'profile',
                max_tokens: input.max_tokens || DEFAULT_MAX_TOKENS,
            },
            raw_response: String(raw ?? ''),
        };

        await uploadJson(fileName, payload);
        return fileName;
    }

    return {
        createEmptyIndex,
        deleteFile,
        loadIndex,
        readJson,
        sanitizeFilePart,
        saveFailedGeneration,
        saveIndex,
        saveResult,
        updateResult,
    };
}

return { create };
})();
