globalThis.CommunityReactionsStorage = (() => {
'use strict';

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
        const mode = generation?.reaction_mode === 'npc' ? 'npc' : 'reader';
        const target = mode === 'npc'
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
            npc_topics: [],
            reader_communities: [],
        };
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
            index.items.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
            return index;
        } catch {
            return createEmptyIndex(chatPk);
        }
    }

    async function saveIndex(index, fallbackChatPk = null) {
        const chatPk = index?.chat_pk || fallbackChatPk;
        await uploadJson(indexFileName(chatPk), {
            ...createEmptyIndex(chatPk),
            ...index,
            npc_topics: Array.isArray(index?.npc_topics) ? index.npc_topics : [],
            reader_communities: Array.isArray(index?.reader_communities) ? index.reader_communities : [],
            items: Array.isArray(index?.items) ? index.items : [],
        });
    }

    async function saveResult(result) {
        const itemName = itemFileName(result.chat_pk, result.generation, result.id, result.created_at);
        await uploadJson(itemName, result);

        const index = await loadIndex(result.chat_pk);
        const item = {
            id: result.id,
            path: filePath(itemName),
            reaction_mode: result.generation.reaction_mode || 'reader',
            topic_id: result.generation.topic_id || '',
            topic_title: result.generation.topic_title || '',
            reader_community_id: result.generation.reader_community_id || '',
            reader_community_title: result.generation.reader_community_title || '',
            site: result.generation.site,
            site_country: result.generation.site_country,
            output_language: result.generation.output_language,
            preserve_original: Boolean(result.generation.preserve_original),
            has_anti: Boolean(result.generation.has_anti),
            media_type: result.generation.media_type,
            created_at: result.created_at,
            post_count: result.posts.length,
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
            target.post_count = result.posts.length;
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
                topic_id: input.topic_id || '',
                topic_title: input.topic_title || '',
                reader_community_id: input.reader_community_id || '',
                reader_community_title: input.reader_community_title || '',
                site: input.site,
                site_country: input.site_country,
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
