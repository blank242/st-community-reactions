globalThis.CommunityReactionsExtension = (() => {
    'use strict';

    const MODULE_NAME = 'st-community-reactions';
    const EXTENSION_BASE_URL = (() => {
        if (typeof import.meta?.url === 'string') {
            return new URL('.', import.meta.url).href;
        }
        const src = document.currentScript?.src;
        return src
            ? new URL('.', src).href
            : new URL(`/scripts/extensions/third-party/${MODULE_NAME}/`, window.location.href).href;
    })();
    const TEMPLATE_SCRIPT_VERSION = '20260625-payment-edit-1';
    const PROMPT_SCRIPT_VERSION = '20260624-custom-country-1';
    const STORAGE_SCRIPT_VERSION = '20260624-custom-country-1';
    const PHONE_SCRIPT_VERSION = '20260626-payment-bofa-copy-1';
    const PHONE_STYLE_VERSION = '20260625-google-logo-1';
    const PHONE_PAYMENT_STYLE_VERSION = '20260625-payment-edit-1';
    const PHONE_MODULE_SCRIPT_GROUPS = Object.freeze([
        Object.freeze(['phone-registry.js']),
        Object.freeze([
            'phone-home.js',
            'phone-payment-helpers.js',
            'phone-app-safari.js',
            'phone-app-static.js',
        ]),
        Object.freeze(['phone-app-payment-history.js']),
    ]);
    const FILE_PREFIX = 'crx';
    const JSON_INDENT = 2;
    const VIEW_PAGE_SIZE = 6;
    const DEFAULT_MAX_TOKENS = 10000;

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
    const SITE_PRESETS = Object.freeze({
        twitter: {
            label: 'Twitter',
            supportsCountry: true,
            minPosts: 8,
            maxPosts: 15,
            defaultPosts: 10,
            maxChars: 140,
            promptName: 'Twitter timeline',
        },
        daumCafe: {
            label: 'Cafe',
            supportsCountry: false,
            fixedCountry: 'korea',
            minPosts: 5,
            maxPosts: 10,
            defaultPosts: 6,
            maxChars: 900,
            promptName: 'Cafe article list',
        },
        everytime: {
            label: '에브리타임',
            supportsCountry: false,
            fixedCountry: 'korea',
            minPosts: 5,
            maxPosts: 12,
            defaultPosts: 7,
            maxChars: 700,
            promptName: 'Everytime anonymous board',
        },
        webNovelReview: {
            label: '소설 리뷰',
            supportsCountry: false,
            fixedCountry: 'korea',
            minPosts: 6,
            maxPosts: 14,
            defaultPosts: 9,
            maxChars: 700,
            promptName: 'web novel review page',
        },
        googleSearch: {
            label: '구글 검색결과',
            supportsCountry: true,
            minPosts: 1,
            maxPosts: 4,
            defaultPosts: 4,
            maxChars: 300,
            promptName: 'Google search history and search results',
        },
        paymentHistory: {
            label: '결제 내역',
            supportsCountry: true,
            minPosts: 10,
            maxPosts: 10,
            defaultPosts: 10,
            maxChars: 500,
            promptName: 'iPhone banking payment history',
        },
    });

    const READER_SITE_KEYS = Object.freeze(['twitter', 'daumCafe', 'webNovelReview']);
    const NPC_SITE_KEYS = Object.freeze(['twitter', 'daumCafe', 'everytime']);
    const PHONE_APP_PRESETS = Object.freeze({
        googleSearch: {
            id: 'googleSearch',
            label: '구글 검색결과',
            homeLabel: 'Safari',
            countLabel: '검색어 수',
            promptName: 'Google search history and search results',
            minSearches: 1,
            maxSearches: 4,
            defaultSearches: 4,
            minResults: 5,
            maxResults: 7,
        },
        paymentHistory: {
            id: 'paymentHistory',
            label: '결제 내역',
            homeLabel: 'Bank',
            countLabel: '결제내역 수',
            promptName: 'Payment history',
            minTransactions: 10,
            maxTransactions: 10,
            defaultTransactions: 10,
        },
    });
    const PHONE_APP_KEYS = Object.freeze(Object.keys(PHONE_APP_PRESETS));
    const PHONE_VIEWER_ITEMS_PER_APP = 16;
    const ADD_OPTION_VALUE = '__add__';

    const CUSTOM_COUNTRY_KEY = 'custom';
    const COUNTRY_PRESETS = Object.freeze({
        korea: { label: '한국', language: 'ko' },
        japan: { label: '일본', language: 'ja' },
        usa: { label: '미국', language: 'en' },
        china: { label: '중국', language: 'zh' },
        global: { label: '글로벌', language: 'en' },
        [CUSTOM_COUNTRY_KEY]: { label: '직접 입력', language: '' },
    });

    const RANDOM_COUNTRY_KEYS = Object.freeze(Object.keys(COUNTRY_PRESETS).filter(key => key !== 'global' && key !== CUSTOM_COUNTRY_KEY));

    const LANGUAGE_PRESETS = Object.freeze({
        ko: '한국어',
        ja: '日本語',
        en: 'English',
        zh: '中文',
    });

    const MEDIA_TYPES = Object.freeze({
        novel: '소설',
        drama: '드라마',
        comic: '만화',
        movie: '영화',
        game: '게임',
    });

    const REACTION_MODES = Object.freeze({
        reader: '독자 반응',
        npc: '작중 NPC 반응',
        phone: '휴대폰 확인하기',
    });

    let templates = null;
    let communityRenderers = null;
    let prompts = null;
    let phone = null;
    let storage = null;

    function getCommunityRenderer(site = state.activeCommunity) {
        return communityRenderers?.[site] || communityRenderers?.twitter;
    }

    function isBoardSite(site) {
        return getCommunityRenderer(site)?.viewType === 'board';
    }

    const state = {
        composerModal: null,
        viewerModal: null,
        postEditorModal: null,
        activeResult: null,
        activeIndex: null,
        activeCommunity: '',
        activeViewKey: '',
        latestCommunityResultId: '',
        communityItems: [],
        communityItemCursor: 0,
        communityResults: new Map(),
        communityPosts: [],
        communityReferenceDate: null,
        isLoadingCommunity: false,
        hasMoreCommunityItems: false,
        renderedCount: 0,
        deleteMode: false,
        boardDetailPostKey: null,
        boardListScrollTop: 0,
        boardListRenderedCount: 0,
        activeHelpButton: null,
    };

    function getContextSafe() {
        return globalThis.SillyTavern?.getContext?.();
    }

    function escapeHtml(value) {
        const span = document.createElement('span');
        span.textContent = value == null ? '' : String(value);
        return span.innerHTML;
    }

    function loadExtensionScript(fileName) {
        return new Promise((resolve, reject) => {
            const src = new URL(fileName, EXTENSION_BASE_URL).href;
            const existing = [...document.scripts].find(script => script.dataset.crxScript === src || script.src === src);
            if (existing) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.dataset.crxScript = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load ${fileName}`));
            document.head.appendChild(script);
        });
    }

    function loadExtensionStyle(fileName) {
        const href = new URL(fileName, EXTENSION_BASE_URL).href;
        const existing = [...document.querySelectorAll('link[rel="stylesheet"]')].find(link => link.dataset.crxStyle === href || link.href === href);
        if (existing) {
            return;
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.dataset.crxStyle = href;
        document.head.appendChild(link);
    }

    function createId(prefix = 'crx') {
        const uuid = globalThis.crypto?.randomUUID?.();
        if (uuid) {
            return `${prefix}_${uuid.replaceAll('-', '')}`;
        }
        return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    function createRandomRecentDateIso(maxHours = 3, startMs = null) {
        const now = Date.now();
        const minMs = Number.isFinite(startMs) ? Math.min(startMs, now) : now - (maxHours * 60 * 60 * 1000);
        return new Date(minMs + Math.random() * (now - minMs)).toISOString();
    }

    function createRandomRecentDateSeries(count, maxHours = 3) {
        return Array.from({ length: Math.max(0, count) }, () => createRandomRecentDateIso(maxHours))
            .sort((a, b) => String(b).localeCompare(String(a)));
    }

    function createAscendingDateSeriesAfter(count, startMs = null) {
        if (!count) {
            return [];
        }

        const baseMs = Number.isFinite(startMs) ? startMs : Date.now() - (3 * 60 * 60 * 1000);
        const now = Date.now();
        const minMs = Math.min(baseMs + 1000, now);
        if (minMs >= now) {
            return Array.from({ length: count }, (_, index) => new Date(baseMs + 1000 + index).toISOString());
        }

        return Array.from({ length: count }, () => createRandomRecentDateIso(3, minMs))
            .sort((a, b) => String(a).localeCompare(String(b)));
    }

    function getDateOrNull(value) {
        const date = new Date(value || '');
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function createQuoteDateNearPostIso(postCreatedMs, value = null) {
        const postDate = Number.isFinite(postCreatedMs) ? new Date(postCreatedMs) : new Date();
        const parsed = getDateOrNull(value);
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

        if (parsed && Math.abs(postDate.getTime() - parsed.getTime()) <= sevenDaysMs) {
            return parsed.toISOString();
        }

        const offsetMs = randomInt(5 * 60 * 1000, 48 * 60 * 60 * 1000);
        return new Date(postDate.getTime() - offsetMs).toISOString();
    }

    function hashString(value) {
        const text = String(value || '');
        let hash = 2166136261;
        for (let index = 0; index < text.length; index += 1) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    function createMaskedReviewerId(seed = '') {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        const hash = seed ? hashString(seed) : Math.floor(Math.random() * 0xffffffff);
        let value = '';
        for (let index = 0; index < 3; index += 1) {
            const offset = Math.floor(hash / Math.pow(chars.length, index)) % chars.length;
            value += chars[offset] || chars[Math.floor(Math.random() * chars.length)];
        }
        return `${value}***`;
    }

    function randomInt(min, max) {
        const low = Math.ceil(min);
        const high = Math.floor(max);
        return Math.floor(Math.random() * (high - low + 1)) + low;
    }

    function coerceCreatedAtIso(value, startMs = null) {
        const date = getDateOrNull(value);
        return date ? date.toISOString() : createRandomRecentDateIso(3, startMs);
    }

    function sanitizeId(value, prefix = 'id') {
        const sanitized = storage.sanitizeFilePart(value);
        if (/^[a-zA-Z0-9_-]+$/.test(sanitized) && sanitized !== 'unknown') {
            return sanitized;
        }
        return createId(prefix);
    }

    function ensureChatPk(context) {
        if (!context?.chatMetadata) {
            throw new Error('현재 채팅 메타데이터를 읽을 수 없습니다.');
        }

        if (!context.chatMetadata.integrity) {
            context.chatMetadata.integrity = createId('chat');
            context.saveMetadataDebounced?.();
            context.saveMetadata?.();
        }

        return context.chatMetadata.integrity;
    }

    function getProfiles(context) {
        const profiles = context?.extensionSettings?.connectionManager?.profiles;
        if (!profiles) {
            return [];
        }
        return Array.isArray(profiles) ? profiles : Object.values(profiles);
    }

    function getProfileId(profile) {
        return profile?.id || profile?.profileId || profile?.profile_id || profile?.uuid || '';
    }

    function getProfileName(profile) {
        return profile?.name || profile?.profileName || profile?.profile_name || profile?.displayName || getProfileId(profile);
    }

    function clampInteger(value, min, max, fallback) {
        const number = Number(value);
        if (!Number.isFinite(number)) {
            return fallback;
        }

        return Math.max(min, Math.min(max, Math.round(number)));
    }

    function setSelectValue(select, value, fallback = '') {
        if (!select) {
            return;
        }

        const stringValue = String(value || '');
        const fallbackValue = String(fallback || '');
        const hasValue = Array.from(select.options).some(option => option.value === stringValue);
        if (hasValue) {
            select.value = stringValue;
            return;
        }

        if (fallbackValue && Array.from(select.options).some(option => option.value === fallbackValue)) {
            select.value = fallbackValue;
        }
    }

    function getRandomArrayItem(items) {
        if (!Array.isArray(items) || !items.length) {
            return null;
        }

        return items[Math.floor(Math.random() * items.length)];
    }

    function normalizeCustomCountry(value) {
        return String(value || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 80);
    }

    function inferCustomCountryLanguage(customCountry) {
        const text = normalizeCustomCountry(customCountry).toLowerCase();
        if (!text) {
            return '';
        }
        if (/(한국|대한민국|korea|korean)/i.test(text)) {
            return 'ko';
        }
        if (/(일본|japan|japanese)/i.test(text)) {
            return 'ja';
        }
        if (/(미국|미합중국|usa|u\.s\.a|united states|america|american|영국|uk|u\.k|britain|england|canada|australia|new zealand)/i.test(text)) {
            return 'en';
        }
        if (/(중국|china|chinese|대만|taiwan|홍콩|hong kong)/i.test(text)) {
            return 'zh';
        }
        return '';
    }

    function isAmericanCountry(countryKey, customCountry = '') {
        if (countryKey === 'usa') {
            return true;
        }
        if (countryKey !== CUSTOM_COUNTRY_KEY) {
            return false;
        }
        return /(미국|미합중국|usa|u\.s\.a|united states|american)/i.test(normalizeCustomCountry(customCountry));
    }

    function getCountryContext(countryKey, customCountry = '') {
        const key = COUNTRY_PRESETS[countryKey] ? countryKey : 'korea';
        const customLabel = normalizeCustomCountry(customCountry);
        const preset = COUNTRY_PRESETS[key] || COUNTRY_PRESETS.korea;
        const isCustom = key === CUSTOM_COUNTRY_KEY;
        const label = isCustom ? customLabel || preset.label : preset.label;
        const language = isCustom ? inferCustomCountryLanguage(customLabel) : preset.language;
        const languageLabel = language
            ? LANGUAGE_PRESETS[language] || language
            : isCustom && customLabel ? `the natural local language of ${customLabel}` : '';

        return {
            key,
            label,
            language,
            languageLabel,
            isCustom,
            isAmerican: isAmericanCountry(key, customLabel),
        };
    }

    function shouldShowPreserveOriginal(countryContext, outputLanguage, isPhone) {
        if (isPhone) {
            return false;
        }
        if (countryContext.isCustom && !countryContext.language) {
            return Boolean(countryContext.label && countryContext.label !== COUNTRY_PRESETS[CUSTOM_COUNTRY_KEY].label);
        }
        return Boolean(countryContext.language && outputLanguage !== countryContext.language);
    }

    function resolveSiteCountryForGeneration(siteCountry, customCountry = '') {
        const country = String(siteCountry || '');
        if (country === 'global') {
            return getRandomArrayItem(RANDOM_COUNTRY_KEYS) || 'usa';
        }
        if (country === CUSTOM_COUNTRY_KEY && normalizeCustomCountry(customCountry)) {
            return CUSTOM_COUNTRY_KEY;
        }

        return COUNTRY_PRESETS[country] && country !== CUSTOM_COUNTRY_KEY ? country : 'korea';
    }

    function getDefaultGenerationOptions(site, reactionMode = 'reader') {
        const preset = SITE_PRESETS[site] || SITE_PRESETS.twitter;
        const options = {
            site_country: preset.supportsCountry ? 'korea' : preset.fixedCountry,
            output_language: 'ko',
            api_source: 'main',
            max_tokens: DEFAULT_MAX_TOKENS,
            post_count: preset.defaultPosts,
            include_hidden_messages: false,
            include_world_info: false,
            include_character_card: false,
            has_anti: false,
            preserve_original: false,
        };

        if (reactionMode === 'reader') {
            options.media_type = 'novel';
        }

        if (reactionMode === 'npc' && site === 'twitter') {
            options.preserve_profile_identity = false;
        }

        return options;
    }

    function normalizeGenerationOptions(options, site, reactionMode = 'reader') {
        if (!options || typeof options !== 'object' || Array.isArray(options)) {
            return null;
        }

        const defaults = getDefaultGenerationOptions(site, reactionMode);
        const preset = SITE_PRESETS[site] || SITE_PRESETS.twitter;
        const customCountry = normalizeCustomCountry(options.custom_site_country || options.customSiteCountry);
        const requestedCountry = String(options.site_country || '');
        const country = preset.supportsCountry
            && COUNTRY_PRESETS[requestedCountry]
            && (requestedCountry !== CUSTOM_COUNTRY_KEY || customCountry)
            ? requestedCountry
            : defaults.site_country;
        const outputLanguage = LANGUAGE_PRESETS[options.output_language]
            ? options.output_language
            : defaults.output_language;
        const apiSource = String(options.api_source || options.apiSource || defaults.api_source);
        const normalized = {
            site_country: country,
            output_language: outputLanguage,
            api_source: apiSource || defaults.api_source,
            max_tokens: clampInteger(options.max_tokens, 1000, 64000, defaults.max_tokens),
            post_count: clampInteger(options.post_count, preset.minPosts, preset.maxPosts, defaults.post_count),
            include_hidden_messages: coerceBoolean(options.include_hidden_messages),
            include_world_info: coerceBoolean(options.include_world_info),
            include_character_card: coerceBoolean(options.include_character_card),
            has_anti: coerceBoolean(options.has_anti),
            preserve_original: coerceBoolean(options.preserve_original),
            custom_site_country: country === CUSTOM_COUNTRY_KEY ? customCountry : '',
        };

        if (reactionMode === 'reader') {
            normalized.media_type = MEDIA_TYPES[options.media_type] ? options.media_type : defaults.media_type;
        }

        if (reactionMode === 'npc' && site === 'twitter') {
            normalized.preserve_profile_identity = coerceBoolean(options.preserve_profile_identity);
        }

        return normalized;
    }

    function getGenerationOptionsFromInput(input) {
        const options = {
            site_country: input.selected_site_country || input.site_country,
            custom_site_country: input.selected_site_country === CUSTOM_COUNTRY_KEY || input.site_country === CUSTOM_COUNTRY_KEY
                ? normalizeCustomCountry(input.custom_site_country)
                : '',
            output_language: input.output_language,
            api_source: input.apiSource === 'main' ? 'main' : input.apiSource,
            max_tokens: input.max_tokens,
            post_count: input.post_count,
            include_hidden_messages: Boolean(input.include_hidden_messages),
            include_world_info: Boolean(input.include_world_info),
            include_character_card: Boolean(input.include_character_card),
            has_anti: Boolean(input.has_anti),
            preserve_original: Boolean(input.preserve_original),
        };

        if (input.reaction_mode === 'reader') {
            options.media_type = input.media_type;
        }

        if (input.reaction_mode === 'npc' && input.site === 'twitter') {
            options.preserve_profile_identity = Boolean(input.preserve_profile_identity);
        }

        return normalizeGenerationOptions(options, input.site, input.reaction_mode) || getDefaultGenerationOptions(input.site, input.reaction_mode);
    }

    function areGenerationOptionsEqual(left, right, site, reactionMode = 'reader') {
        const normalizedLeft = normalizeGenerationOptions(left, site, reactionMode);
        const normalizedRight = normalizeGenerationOptions(right, site, reactionMode);
        return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight);
    }

    function normalizeReaderSiteOptionsMap(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return {};
        }

        return READER_SITE_KEYS.reduce((acc, site) => {
            const options = normalizeGenerationOptions(value[site], site, 'reader');
            if (options) {
                acc[site] = options;
            }
            return acc;
        }, {});
    }

    function normalizePhoneAppOptionsMap(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return {};
        }

        return PHONE_APP_KEYS.reduce((acc, appId) => {
            const options = normalizeGenerationOptions(value[appId], appId, 'phone');
            if (options) {
                acc[appId] = options;
            }
            return acc;
        }, {});
    }

    function createEmptyIndex(chatPk) {
        return storage.createEmptyIndex(chatPk);
    }

    async function saveIndex(index) {
        const chatPk = index?.chat_pk || ensureChatPk(getContextSafe());
        await storage.saveIndex(index, chatPk);
    }

    async function loadIndex(chatPk) {
        return storage.loadIndex(chatPk);
    }

    async function readJson(path) {
        return storage.readJson(path);
    }

    async function deleteFile(path) {
        return storage.deleteFile(path);
    }

    function normalizeReaderCommunity(community) {
        if (!community || typeof community !== 'object') {
            return null;
        }
        const title = String(community.title || '').trim();
        const site = String(community.site || '').trim();
        const prompt = String(community.prompt || '').trim();
        if (!title || !READER_SITE_KEYS.includes(site) || !prompt) {
            return null;
        }
        const normalized = {
            id: sanitizeId(community.id || createId('community'), 'community'),
            title,
            site,
            prompt,
            created_at: community.created_at || new Date().toISOString(),
            updated_at: community.updated_at || new Date().toISOString(),
        };
        const generationOptions = normalizeGenerationOptions(community.generation_options, site, 'reader');
        if (generationOptions) {
            normalized.generation_options = generationOptions;
        }
        return normalized;
    }

    async function updateReaderSiteOptions(chatPk, site, options) {
        const normalizedSite = getReaderSiteOrDefault(site);
        const normalizedOptions = normalizeGenerationOptions(options, normalizedSite, 'reader');
        if (!normalizedOptions) {
            return null;
        }

        const index = await loadIndex(chatPk);
        index.reader_site_options = {
            ...normalizeReaderSiteOptionsMap(index.reader_site_options),
            [normalizedSite]: normalizedOptions,
        };
        await saveIndex(index);
        return normalizedOptions;
    }

    async function updatePhoneAppOptions(chatPk, appId, options) {
        const normalizedAppId = getPhoneAppOrDefault(appId);
        const normalizedOptions = normalizeGenerationOptions(options, normalizedAppId, 'phone');
        if (!normalizedOptions) {
            return null;
        }

        const index = await loadIndex(chatPk);
        index.phone_app_options = {
            ...normalizePhoneAppOptionsMap(index.phone_app_options),
            [normalizedAppId]: normalizedOptions,
        };
        await saveIndex(index);
        return normalizedOptions;
    }

    async function addReaderCommunity(chatPk, communityInput) {
        const index = await loadIndex(chatPk);
        const community = normalizeReaderCommunity(communityInput);
        if (!community) {
            throw new Error('독자 반응 커뮤니티 제목, 기본 커뮤니티, 프롬프트를 모두 입력하세요.');
        }
        index.reader_communities = [...(index.reader_communities || []), community];
        await saveIndex(index);
        return community;
    }

    async function updateReaderCommunity(chatPk, communityId, updates) {
        const index = await loadIndex(chatPk);
        const communityIndex = (index.reader_communities || []).findIndex(community => community.id === communityId);
        if (communityIndex < 0) {
            return null;
        }

        const community = normalizeReaderCommunity({
            ...index.reader_communities[communityIndex],
            ...updates,
            id: index.reader_communities[communityIndex].id,
            updated_at: new Date().toISOString(),
        });
        if (!community) {
            throw new Error('독자 반응 커뮤니티 제목, 기본 커뮤니티, 프롬프트를 모두 입력하세요.');
        }

        index.reader_communities[communityIndex] = community;
        await saveIndex(index);
        return community;
    }

    async function deleteReaderCommunity(chatPk, communityId) {
        const index = await loadIndex(chatPk);
        const community = getReaderCommunity(index, communityId);
        if (!community) {
            throw new Error('삭제할 커뮤니티를 찾을 수 없습니다.');
        }

        const viewKey = `reader-custom:${communityId}`;
        const targetItems = index.items.filter(item => getItemViewKey(item) === viewKey);
        for (const item of targetItems) {
            await deleteFile(item.path);
        }

        index.items = index.items.filter(item => getItemViewKey(item) !== viewKey);
        index.reader_communities = (index.reader_communities || []).filter(item => item.id !== communityId);
        await saveIndex(index);
        return { community, deletedCount: targetItems.length };
    }

    function getReaderCommunity(index, communityId) {
        return (index?.reader_communities || []).find(community => community.id === communityId) || null;
    }

    function getComposerIndex(root) {
        return root?._crxIndex || createEmptyIndex(ensureChatPk(getContextSafe()));
    }

    function setComposerIndex(root, index) {
        if (root) {
            root._crxIndex = index;
        }
    }

    function upsertComposerReaderCommunity(root, community) {
        if (!root || !community) {
            return;
        }

        const index = getComposerIndex(root);
        const communities = Array.isArray(index.reader_communities) ? index.reader_communities : [];
        const existingIndex = communities.findIndex(item => item.id === community.id);
        index.reader_communities = existingIndex >= 0
            ? communities.map(item => item.id === community.id ? community : item)
            : [...communities, community];
        setComposerIndex(root, index);
    }

    function upsertComposerReaderSiteOptions(root, site, options) {
        if (!root || !READER_SITE_KEYS.includes(site)) {
            return;
        }

        const normalizedOptions = normalizeGenerationOptions(options, site, 'reader');
        if (!normalizedOptions) {
            return;
        }

        const index = getComposerIndex(root);
        index.reader_site_options = {
            ...normalizeReaderSiteOptionsMap(index.reader_site_options),
            [site]: normalizedOptions,
        };
        setComposerIndex(root, index);
    }

    function upsertComposerPhoneAppOptions(root, appId, options) {
        if (!root || !PHONE_APP_KEYS.includes(appId)) {
            return;
        }

        const normalizedOptions = normalizeGenerationOptions(options, appId, 'phone');
        if (!normalizedOptions) {
            return;
        }

        const index = getComposerIndex(root);
        index.phone_app_options = {
            ...normalizePhoneAppOptionsMap(index.phone_app_options),
            [appId]: normalizedOptions,
        };
        setComposerIndex(root, index);
    }

    function removeComposerReaderCommunity(root, communityId) {
        if (!root) {
            return;
        }

        const index = getComposerIndex(root);
        index.reader_communities = (index.reader_communities || []).filter(item => item.id !== communityId);
        setComposerIndex(root, index);
    }

    function normalizeNpcTopic(topic) {
        if (!topic || typeof topic !== 'object') {
            return null;
        }
        const title = String(topic.title || '').trim();
        const site = String(topic.site || '').trim();
        const prompt = String(topic.prompt || '').trim();
        if (!title || !NPC_SITE_KEYS.includes(site) || !prompt) {
            return null;
        }
        const normalized = {
            id: sanitizeId(topic.id || createId('topic'), 'topic'),
            title,
            site,
            prompt,
            preserve_profile_identity: site === 'twitter' && coerceBoolean(topic.preserve_profile_identity),
            created_at: topic.created_at || new Date().toISOString(),
            updated_at: topic.updated_at || new Date().toISOString(),
        };
        const generationOptions = normalizeGenerationOptions(topic.generation_options, site, 'npc');
        if (generationOptions) {
            normalized.generation_options = generationOptions;
        }
        if (topic.is_default) {
            normalized.is_default = true;
        }
        return normalized;
    }

    async function addNpcTopic(chatPk, topicInput) {
        const index = await loadIndex(chatPk);
        const topic = normalizeNpcTopic(topicInput);
        if (!topic) {
            throw new Error('NPC 반응 카테고리 제목, 대상 게시판, 프롬프트를 모두 입력하세요.');
        }
        index.npc_topics = [...(index.npc_topics || []), topic];
        await saveIndex(index);
        return topic;
    }

    async function updateNpcTopic(chatPk, topicId, updates) {
        const index = await loadIndex(chatPk);
        const topicIndex = (index.npc_topics || []).findIndex(topic => topic.id === topicId);
        if (topicIndex < 0) {
            return null;
        }

        const topic = normalizeNpcTopic({
            ...index.npc_topics[topicIndex],
            ...updates,
            id: index.npc_topics[topicIndex].id,
            updated_at: new Date().toISOString(),
        });
        if (!topic) {
            throw new Error('NPC 반응 카테고리 제목, 대상 게시판, 프롬프트를 모두 입력하세요.');
        }

        index.npc_topics[topicIndex] = topic;
        await saveIndex(index);
        return topic;
    }

    async function deleteNpcTopic(chatPk, topicId) {
        const index = await loadIndex(chatPk);
        const topic = getNpcTopic(index, topicId);
        if (!topic) {
            throw new Error('삭제할 카테고리를 찾을 수 없습니다.');
        }

        const viewKey = `npc:${topicId}`;
        const targetItems = index.items.filter(item => getItemViewKey(item) === viewKey);
        for (const item of targetItems) {
            await deleteFile(item.path);
        }

        index.items = index.items.filter(item => getItemViewKey(item) !== viewKey);
        index.npc_topics = (index.npc_topics || []).filter(item => item.id !== topicId);
        await saveIndex(index);
        return { topic, deletedCount: targetItems.length };
    }

    function getNpcTopic(index, topicId) {
        return (index?.npc_topics || []).find(topic => topic.id === topicId) || null;
    }

    function upsertComposerNpcTopic(root, topic) {
        if (!root || !topic) {
            return;
        }

        const index = getComposerIndex(root);
        const topics = Array.isArray(index.npc_topics) ? index.npc_topics : [];
        const existingIndex = topics.findIndex(item => item.id === topic.id);
        index.npc_topics = existingIndex >= 0
            ? topics.map(item => item.id === topic.id ? topic : item)
            : [...topics, topic];
        setComposerIndex(root, index);
    }

    function removeComposerNpcTopic(root, topicId) {
        if (!root) {
            return;
        }

        const index = getComposerIndex(root);
        index.npc_topics = (index.npc_topics || []).filter(item => item.id !== topicId);
        setComposerIndex(root, index);
    }

    async function saveResult(result) {
        await storage.saveResult(result);
    }

    async function updateResult(result) {
        await storage.updateResult(result);
    }

    async function saveFailedGeneration(chatPk, input, raw, error, phase) {
        return storage.saveFailedGeneration(chatPk, input, raw, error, phase);
    }

    function createModal(html, extraClass = '') {
        const modal = document.createElement('div');
        modal.className = ['crx-modal', extraClass].filter(Boolean).join(' ');
        modal.innerHTML = `<div class="crx-modal-backdrop"></div>${html}`;
        document.body.appendChild(modal);
        return modal;
    }

    function closeComposer() {
        hideActiveHelpTooltip();
        state.composerModal?.remove();
        state.composerModal = null;
    }

    function closePostEditor() {
        state.postEditorModal?.remove();
        state.postEditorModal = null;
    }
    function closeViewer(options = {}) {
        closePostEditor();
        const modal = state.viewerModal;
        const shouldAnimatePhone = Boolean(options.animatePhone && modal?.classList?.contains('crx-phone-viewer-modal'));
        state.viewerModal = null;
        state.activeResult = null;
        state.activeIndex = null;
        state.activeCommunity = '';
        state.activeViewKey = '';
        state.communityItems = [];
        state.communityItemCursor = 0;
        state.communityResults = new Map();
        state.communityPosts = [];
        state.isLoadingCommunity = false;
        state.hasMoreCommunityItems = false;
        state.renderedCount = 0;
        state.deleteMode = false;
        state.boardDetailPostKey = null;
        state.boardListScrollTop = 0;
        state.boardListRenderedCount = 0;
        if (shouldAnimatePhone) {
            animatePhoneViewerClose(modal);
            return;
        }
        modal?.remove();
    }

    function animatePhoneViewerClose(modal) {
        const popup = modal?.querySelector?.('.crx-popup.is-phone-mode');
        if (!modal || !popup) {
            modal?.remove();
            return;
        }

        popup.style.animation = 'none';
        void popup.offsetWidth;
        popup.style.animation = '';
        modal.classList.add('is-phone-closing');
        popup.classList.add('is-phone-closing');
        const removeModal = () => modal.remove();
        const fallbackTimer = window.setTimeout(removeModal, 620);
        popup.addEventListener('animationend', () => {
            window.clearTimeout(fallbackTimer);
            removeModal();
        }, { once: true });
    }

    function getDefaultRange(context) {
        const count = context?.chat?.length || 0;
        return {
            start: Math.max(1, count - 9),
            end: Math.max(1, count),
            max: Math.max(1, count),
        };
    }

    function buildProfileOptions(context) {
        const options = ['<option value="main">현재 Main API</option>'];
        for (const profile of getProfiles(context)) {
            const id = getProfileId(profile);
            if (!id) {
                continue;
            }
            options.push(`<option value="profile:${escapeHtml(id)}">${escapeHtml(getProfileName(profile))}</option>`);
        }
        return options.join('');
    }

    function cssEscape(value) {
        return globalThis.CSS?.escape ? CSS.escape(value) : String(value).replace(/["\\]/g, '\\$&');
    }

    function createTemplateDeps() {
        return {
            ADD_OPTION_VALUE,
            COUNTRY_PRESETS,
            DEFAULT_MAX_TOKENS,
            LANGUAGE_PRESETS,
            MEDIA_TYPES,
            NPC_SITE_KEYS,
            PHONE_APP_KEYS,
            PHONE_APP_PRESETS,
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
        };
    }

    async function initializeTemplates() {
        if (templates && communityRenderers) {
            return;
        }

        await loadExtensionScript(`templates.js?v=${TEMPLATE_SCRIPT_VERSION}`);
        const factory = globalThis.CommunityReactionsTemplates?.create;
        if (typeof factory !== 'function') {
            throw new Error('CommunityReactionsTemplates.create is not available.');
        }

        templates = factory(createTemplateDeps());
        communityRenderers = Object.freeze({
            twitter: {
                viewType: 'feed',
                renderPost: templates.renderTwitterPost,
            },
            webNovelReview: {
                viewType: 'feed',
                renderPost: templates.renderWebNovelReviewPost,
            },
            daumCafe: {
                viewType: 'board',
                renderListItem: (entry, referenceDate) => templates.renderDaumListItem(entry.post, entry.key, entry.result?.id === state.latestCommunityResultId, entry.result, referenceDate),
                renderDetail: (entry, referenceDate) => templates.renderDaumPost(entry.post, entry.result, entry.key, referenceDate),
            },
            everytime: {
                viewType: 'board',
                renderListItem: (entry, referenceDate) => templates.renderEverytimeListItem(entry.post, entry.result, entry.key, referenceDate),
                renderDetail: (entry, referenceDate) => templates.renderEverytimePost(entry.post, entry.result, entry.key, referenceDate),
            },
        });
    }

    function createPromptDeps() {
        return {
            COUNTRY_PRESETS,
            LANGUAGE_PRESETS,
            SITE_PRESETS,
            getCountryContext,
            isBoardSite,
        };
    }

    async function initializePrompts() {
        if (prompts) {
            return;
        }

        await loadExtensionScript(`prompts.js?v=${PROMPT_SCRIPT_VERSION}`);
        const factory = globalThis.CommunityReactionsPrompts?.create;
        if (typeof factory !== 'function') {
            throw new Error('CommunityReactionsPrompts.create is not available.');
        }

        prompts = factory(createPromptDeps());
    }

    function createPhoneDeps() {
        return {
            COUNTRY_PRESETS,
            LANGUAGE_PRESETS,
            PHONE_APP_PRESETS,
            createId,
            escapeHtml,
            getCountryContext,
            sanitizeId,
        };
    }

    async function initializePhone() {
        if (phone) {
            return;
        }

        loadExtensionStyle(`phone.css?v=${PHONE_STYLE_VERSION}`);
        loadExtensionStyle(`phone-payments.css?v=${PHONE_PAYMENT_STYLE_VERSION}`);
        for (const scriptGroup of PHONE_MODULE_SCRIPT_GROUPS) {
            await Promise.all(scriptGroup.map(scriptName => loadExtensionScript(`${scriptName}?v=${PHONE_SCRIPT_VERSION}`)));
        }
        await loadExtensionScript(`phone.js?v=${PHONE_SCRIPT_VERSION}`);
        const factory = globalThis.CommunityReactionsPhone?.create;
        if (typeof factory !== 'function') {
            throw new Error('CommunityReactionsPhone.create is not available.');
        }

        phone = factory(createPhoneDeps());
    }

    function createStorageDeps() {
        return {
            DEFAULT_MAX_TOKENS,
            FILE_PREFIX,
            JSON_INDENT,
            createId,
            getContextSafe,
            getDateOrNull,
        };
    }

    async function initializeStorage() {
        if (storage) {
            return;
        }

        await loadExtensionScript(`storage.js?v=${STORAGE_SCRIPT_VERSION}`);
        const factory = globalThis.CommunityReactionsStorage?.create;
        if (typeof factory !== 'function') {
            throw new Error('CommunityReactionsStorage.create is not available.');
        }

        storage = factory(createStorageDeps());
    }

    function positionHelpTooltip(button, helpText) {
        const buttonRect = button.getBoundingClientRect();
        const modalRect = state.composerModal?.querySelector('.crx-popup')?.getBoundingClientRect();
        const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
        const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
        const margin = 8;
        const minLeft = Math.max(margin, modalRect?.left ?? margin);
        const maxRight = Math.min(viewportWidth - margin, modalRect?.right ?? viewportWidth - margin);
        const tooltipWidth = Math.min(280, maxRight - minLeft);

        helpText.style.maxWidth = `${tooltipWidth}px`;
        helpText.style.left = '0px';
        helpText.style.top = '0px';
        helpText.classList.add('crx-help-visible');

        const tooltipRect = helpText.getBoundingClientRect();
        let left = Math.max(minLeft, Math.min(buttonRect.left, maxRight - tooltipRect.width));
        let top = buttonRect.bottom + margin;
        if (top + tooltipRect.height > viewportHeight - margin) {
            top = buttonRect.top - tooltipRect.height - margin;
        }
        top = Math.max(margin, top);

        helpText.style.left = `${left}px`;
        helpText.style.top = `${top}px`;
    }

    function hideActiveHelpTooltip() {
        if (!state.activeHelpButton || !state.composerModal) {
            state.activeHelpButton = null;
            return;
        }

        const key = state.activeHelpButton.dataset.crxHelp;
        const selector = `[data-crx-help-text="${cssEscape(key)}"]`;
        const helpText = state.activeHelpButton.closest('label')?.querySelector(selector) ?? state.composerModal.querySelector(selector);
        helpText?.classList.remove('crx-help-visible');
        state.activeHelpButton.setAttribute('aria-expanded', 'false');
        state.activeHelpButton = null;
    }

    function getGenerationOptionsSourceKey({ mode, site, readerCommunityId = '', topicId = '' }) {
        if (mode === 'npc') {
            return `npc:${topicId || ADD_OPTION_VALUE}:${site}`;
        }
        if (mode === 'phone') {
            return `phone:${site}`;
        }

        return readerCommunityId
            ? `reader-custom:${readerCommunityId}:${site}`
            : `reader-site:${site}`;
    }

    function getSavedGenerationOptionsForSelection(root, { mode, site, selectedReaderCommunity = null, selectedTopic = null }) {
        if (mode === 'npc') {
            return normalizeGenerationOptions(selectedTopic?.generation_options, site, 'npc');
        }
        if (mode === 'phone') {
            return normalizeGenerationOptions(getComposerIndex(root).phone_app_options?.[site], site, 'phone');
        }

        if (selectedReaderCommunity) {
            return normalizeGenerationOptions(selectedReaderCommunity.generation_options, site, 'reader');
        }

        const index = getComposerIndex(root);
        return normalizeGenerationOptions(index.reader_site_options?.[site], site, 'reader');
    }

    function applyGenerationOptions(root, options, site, reactionMode) {
        const normalized = normalizeGenerationOptions(options, site, reactionMode)
            || getDefaultGenerationOptions(site, reactionMode);
        const preset = SITE_PRESETS[site] || SITE_PRESETS.twitter;
        const country = root.querySelector('#crx-country');
        const customCountry = root.querySelector('#crx-custom-country');
        const language = root.querySelector('#crx-language');
        const mediaType = root.querySelector('#crx-media-type');
        const apiSource = root.querySelector('#crx-api-source');
        const maxTokens = root.querySelector('#crx-max-tokens');
        const count = root.querySelector('#crx-post-count');

        setSelectValue(country, preset.supportsCountry ? normalized.site_country : preset.fixedCountry, preset.fixedCountry || 'korea');
        if (customCountry) {
            customCountry.value = normalized.site_country === CUSTOM_COUNTRY_KEY ? normalized.custom_site_country || '' : '';
        }
        setSelectValue(language, normalized.output_language, 'ko');
        if (reactionMode === 'reader') {
            setSelectValue(mediaType, normalized.media_type, 'novel');
        }
        setSelectValue(apiSource, normalized.api_source, 'main');

        if (maxTokens) {
            maxTokens.value = clampInteger(normalized.max_tokens, 1000, 64000, DEFAULT_MAX_TOKENS);
        }
        if (count) {
            count.value = clampInteger(normalized.post_count, preset.minPosts, preset.maxPosts, preset.defaultPosts);
        }

        const checkboxMap = {
            '#crx-include-hidden': normalized.include_hidden_messages,
            '#crx-include-world-info': normalized.include_world_info,
            '#crx-include-character-card': normalized.include_character_card,
            '#crx-has-anti': normalized.has_anti,
            '#crx-preserve-original': normalized.preserve_original,
        };
        Object.entries(checkboxMap).forEach(([selector, checked]) => {
            const checkbox = root.querySelector(selector);
            if (checkbox) {
                checkbox.checked = Boolean(checked);
            }
        });
    }

    function syncComposerControls(root) {
        const mode = root.querySelector('#crx-reaction-mode')?.value || 'reader';
        const readerSelect = root.querySelector('#crx-reader-community');
        const selectedReaderOption = readerSelect?.selectedOptions?.[0] || null;
        const isAddingReaderCommunity = readerSelect?.value === ADD_OPTION_VALUE;
        const readerCommunityId = selectedReaderOption?.dataset?.id || '';
        const hasSelectedReaderCommunity = Boolean(readerCommunityId);
        const topicSelect = root.querySelector('#crx-topic');
        const selectedTopicOption = topicSelect?.selectedOptions?.[0] || null;
        const isAddingTopic = topicSelect?.value === ADD_OPTION_VALUE;
        const hasSelectedTopic = Boolean(selectedTopicOption?.value && selectedTopicOption.value !== ADD_OPTION_VALUE);
        const isDefaultTopic = selectedTopicOption?.dataset?.default === 'true';
        const isNpc = mode === 'npc';
        const isPhone = mode === 'phone';
        const phoneAppSelect = root.querySelector('#crx-phone-app');
        const phoneAppId = getPhoneAppOrDefault(phoneAppSelect?.value);
        const composerIndex = getComposerIndex(root);
        const selectedReaderCommunity = readerCommunityId ? getReaderCommunity(composerIndex, readerCommunityId) : null;
        const selectedTopic = hasSelectedTopic ? getNpcTopic(composerIndex, selectedTopicOption.value) : null;
        const readerForm = root.querySelector('#crx-reader-community-form');
        const readerFormMatchesSelection = hasSelectedReaderCommunity && readerForm?.dataset.communityId === readerCommunityId && !readerForm.classList.contains('is-hidden');
        const topicForm = root.querySelector('#crx-topic-form');
        const topicFormMatchesSelection = hasSelectedTopic && topicForm?.dataset.topicId === selectedTopicOption.value && !topicForm.classList.contains('is-hidden');
        const readerSite = readerFormMatchesSelection
            ? getReaderSiteOrDefault(root.querySelector('#crx-reader-community-site')?.value)
            : selectedReaderCommunity?.site ? getReaderSiteOrDefault(selectedReaderCommunity.site)
                : selectedReaderOption?.dataset?.site ? getReaderSiteOrDefault(selectedReaderOption.dataset.site)
                    : getReaderSiteOrDefault(String(readerSelect?.value || '').replace(/^site:/, ''));
        const topicSite = topicFormMatchesSelection
            ? getNpcSiteOrDefault(root.querySelector('#crx-topic-site')?.value)
            : selectedTopic?.site ? getNpcSiteOrDefault(selectedTopic.site)
                : selectedTopicOption?.dataset?.site ? getNpcSiteOrDefault(selectedTopicOption.dataset.site)
                    : '';
        const customPrompt = root.querySelector('#crx-custom-prompt');
        const site = isPhone ? phoneAppId : isNpc ? topicSite || NPC_SITE_KEYS[0] : readerSite;
        const preset = SITE_PRESETS[site];
        const country = root.querySelector('#crx-country');
        const customCountry = root.querySelector('#crx-custom-country');
        const customCountryRow = root.querySelector('#crx-custom-country-row');
        const count = root.querySelector('#crx-post-count');
        const countValue = root.querySelector('#crx-post-count-value');
        const optionsSourceKey = getGenerationOptionsSourceKey({
            mode,
            site,
            readerCommunityId,
            topicId: hasSelectedTopic ? selectedTopicOption.value : '',
        });

        root.classList.toggle('is-phone-mode', isPhone);
        root.querySelector('#crx-reader-community-section')?.classList.toggle('is-hidden', isNpc || isPhone);
        root.querySelector('#crx-phone-app-section')?.classList.toggle('is-hidden', !isPhone);
        root.querySelector('#crx-media-row')?.classList.toggle('is-hidden', isNpc || isPhone);
        root.querySelector('#crx-topic-section')?.classList.toggle('is-hidden', !isNpc);
        root.querySelector('#crx-custom-prompt-section')?.classList.toggle('is-hidden', isNpc || (!isPhone && (hasSelectedReaderCommunity || isAddingReaderCommunity)));
        readerForm?.classList.toggle('is-hidden', isNpc || isPhone || !(isAddingReaderCommunity || hasSelectedReaderCommunity));
        root.querySelector('#crx-delete-reader-community')?.classList.toggle('is-hidden', isNpc || isPhone || !hasSelectedReaderCommunity);
        root.querySelector('#crx-message-range-label').textContent = isPhone ? '내용을 확인할 메시지는' : '반응을 확인할 메시지는';
        root.querySelector('#crx-country-label').textContent = isPhone ? '국적' : '국가';
        root.querySelector('#crx-post-count-label').textContent = isPhone
            ? PHONE_APP_PRESETS[phoneAppId]?.countLabel || '항목 수'
            : '게시글 수';
        root.querySelector('#crx-open-library').textContent = isPhone ? '휴대폰 열기' : '커뮤니티 보기';
        const countryHelp = root.querySelector('[data-crx-help-text="국가"]');
        if (countryHelp) {
            countryHelp.textContent = isPhone
                ? '해당 캐릭터의 국적. 화폐 단위, 시간, 말투, 맥락 등이 모두 국적에 맞게 생성됩니다.'
                : '해당 커뮤니티 유저들의 국적. 반응은 국가에 맞는 말투와 분위기로 생성됩니다.';
        }
        const saveReaderCommunityButton = root.querySelector('#crx-save-reader-community');
        if (saveReaderCommunityButton) {
            saveReaderCommunityButton.textContent = hasSelectedReaderCommunity ? '수정하기' : '커뮤니티 추가';
        }
        topicForm?.classList.toggle('is-hidden', !(isNpc && (isAddingTopic || hasSelectedTopic)));
        root.querySelector('#crx-delete-topic')?.classList.toggle('is-hidden', !(isNpc && hasSelectedTopic) || isDefaultTopic);
        const saveTopicButton = root.querySelector('#crx-save-topic');
        if (saveTopicButton) {
            saveTopicButton.textContent = hasSelectedTopic ? '수정하기' : '카테고리 추가';
        }
        if (!isNpc && isAddingReaderCommunity && readerForm?.dataset.communityId !== ADD_OPTION_VALUE) {
            readerForm.dataset.communityId = ADD_OPTION_VALUE;
            root.querySelector('#crx-reader-community-title').value = '';
            root.querySelector('#crx-reader-community-site').value = getReaderSiteOrDefault(String(readerSelect?.value || '').replace(/^site:/, ''));
            root.querySelector('#crx-reader-community-prompt').value = '';
        } else if (!isNpc && hasSelectedReaderCommunity && readerForm?.dataset.communityId !== readerCommunityId) {
            readerForm.dataset.communityId = readerCommunityId;
            root.querySelector('#crx-reader-community-title').value = selectedReaderCommunity?.title || selectedReaderOption.textContent.trim();
            root.querySelector('#crx-reader-community-site').value = getReaderSiteOrDefault(selectedReaderCommunity?.site || selectedReaderOption.dataset.site || 'twitter');
            root.querySelector('#crx-reader-community-prompt').value = selectedReaderCommunity?.prompt || '';
        } else if ((isNpc || isPhone) && readerForm) {
            readerForm.dataset.communityId = '';
        }
        if (isNpc && isAddingTopic && topicForm?.dataset.topicId !== ADD_OPTION_VALUE) {
            topicForm.dataset.topicId = ADD_OPTION_VALUE;
            root.querySelector('#crx-topic-title').value = '';
            root.querySelector('#crx-topic-site').value = getNpcSiteOrDefault(topicSite || 'twitter');
            root.querySelector('#crx-preserve-profile-identity').checked = false;
            root.querySelector('#crx-topic-prompt').value = '';
        } else if (isNpc && hasSelectedTopic && topicForm?.dataset.topicId !== selectedTopicOption.value) {
            topicForm.dataset.topicId = selectedTopicOption.value;
            root.querySelector('#crx-topic-title').value = selectedTopic?.title || selectedTopicOption.textContent.trim();
            root.querySelector('#crx-topic-site').value = getNpcSiteOrDefault(selectedTopic?.site || selectedTopicOption.dataset.site || 'twitter');
            root.querySelector('#crx-preserve-profile-identity').checked = Boolean(selectedTopic?.preserve_profile_identity);
            root.querySelector('#crx-topic-prompt').value = selectedTopic?.prompt || '';
        } else if (!isNpc && topicForm) {
            topicForm.dataset.topicId = '';
            root.querySelector('#crx-preserve-profile-identity').checked = false;
        }
        const topicProfileIdentityRow = root.querySelector('#crx-preserve-profile-identity-row');
        const topicProfileIdentity = root.querySelector('#crx-preserve-profile-identity');
        const activeTopicSite = getNpcSiteOrDefault(root.querySelector('#crx-topic-site')?.value || topicSite || 'twitter');
        const showProfileIdentity = isNpc && !topicForm?.classList.contains('is-hidden') && activeTopicSite === 'twitter';
        topicProfileIdentityRow?.classList.toggle('is-hidden', !showProfileIdentity);
        if (!showProfileIdentity && topicProfileIdentity) {
            topicProfileIdentity.checked = false;
        }
        if (isNpc && (!selectedTopicOption?.value || isAddingTopic) && customPrompt) {
            customPrompt.value = '';
            customPrompt.dataset.topicId = '';
        } else if (isNpc && selectedTopicOption?.value && selectedTopicOption.value !== ADD_OPTION_VALUE && customPrompt?.dataset.topicId !== selectedTopicOption.value) {
            customPrompt.value = selectedTopic?.prompt || '';
            customPrompt.dataset.topicId = selectedTopicOption.value;
        } else if (!isNpc && customPrompt?.dataset.topicId) {
            customPrompt.value = '';
            customPrompt.dataset.topicId = '';
        }
        if (!isNpc && customPrompt) {
            if (hasSelectedReaderCommunity || isAddingReaderCommunity) {
                customPrompt.value = '';
                customPrompt.dataset.readerCommunityId = readerCommunityId;
            } else if (customPrompt.dataset.readerCommunityId) {
                customPrompt.value = '';
                customPrompt.dataset.readerCommunityId = '';
            }
        }

        country.disabled = !preset.supportsCountry;
        if (!preset.supportsCountry) {
            country.value = preset.fixedCountry;
        }
        customCountryRow?.classList.toggle('is-hidden', !preset.supportsCountry || country.value !== CUSTOM_COUNTRY_KEY);

        count.min = preset.minPosts;
        count.max = preset.maxPosts;
        if (count.dataset.site !== site) {
            count.value = preset.defaultPosts;
            count.dataset.site = site;
        } else if (!count.value || Number(count.value) < preset.minPosts || Number(count.value) > preset.maxPosts) {
            count.value = preset.defaultPosts;
        }
        if (root._crxGenerationOptionsSourceKey !== optionsSourceKey) {
            applyGenerationOptions(
                root,
                getSavedGenerationOptionsForSelection(root, { mode, site, selectedReaderCommunity, selectedTopic }),
                site,
                isPhone ? 'phone' : isNpc ? 'npc' : 'reader',
            );
            root._crxGenerationOptionsSourceKey = optionsSourceKey;
        }
        countValue.textContent = `${count.value}개`;

        const outputLanguage = root.querySelector('#crx-language').value;
        const countryContext = getCountryContext(country.value, customCountry?.value || '');
        const showPreserve = shouldShowPreserveOriginal(countryContext, outputLanguage, isPhone);
        root.querySelector('#crx-preserve-row').classList.toggle('is-hidden', !showPreserve);
        if (!showPreserve) {
            root.querySelector('#crx-preserve-original').checked = false;
        }
    }

    function getMessagePreviewText(context, index) {
        const chat = context?.chat || [];
        const message = chat[index - 1];
        if (!message) {
            return `[${index}] 메시지 없음`;
        }

        const name = message.name || (message.is_user ? 'User' : 'Character');
        const text = String(message.mes || '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        const preview = text ? text.slice(0, 86) : '(내용 없음)';
        return `[${index}] ${name}: ${preview}${text.length > preview.length ? '...' : ''}`;
    }

    function syncMessagePreviews(root, context) {
        const max = Math.max(1, context?.chat?.length || 0);
        const start = Math.max(1, Math.min(max, Number(root.querySelector('#crx-range-start').value || 1)));
        const end = Math.max(1, Math.min(max, Number(root.querySelector('#crx-range-end').value || max)));
        root.querySelector('#crx-range-start-preview').textContent = getMessagePreviewText(context, start);
        root.querySelector('#crx-range-end-preview').textContent = getMessagePreviewText(context, end);
    }

    function getMaxTokensInput(root) {
        const value = Number(root.querySelector('#crx-max-tokens')?.value || DEFAULT_MAX_TOKENS);
        if (!Number.isFinite(value)) {
            return DEFAULT_MAX_TOKENS;
        }
        return Math.max(1000, Math.min(64000, Math.round(value)));
    }

    function getComposerInput(root, context) {
        const max = Math.max(1, context?.chat?.length || 0);
        const start = Math.max(1, Math.min(max, Number(root.querySelector('#crx-range-start').value || 1)));
        const end = Math.max(1, Math.min(max, Number(root.querySelector('#crx-range-end').value || max)));
        const reactionMode = root.querySelector('#crx-reaction-mode')?.value || 'reader';
        const isPhone = reactionMode === 'phone';
        const readerSelect = root.querySelector('#crx-reader-community');
        const readerOption = readerSelect?.selectedOptions?.[0] || null;
        const readerSelection = String(readerSelect?.value || '');
        const readerCommunityId = reactionMode === 'reader' ? String(readerOption?.dataset?.id || '') : '';
        const composerIndex = getComposerIndex(root);
        const selectedReaderCommunity = readerCommunityId ? getReaderCommunity(composerIndex, readerCommunityId) : null;
        const isEditingReaderCommunity = reactionMode === 'reader'
            && readerCommunityId
            && !root.querySelector('#crx-reader-community-form')?.classList.contains('is-hidden');
        const readerCommunityTitle = reactionMode === 'reader' && readerCommunityId
            ? String(isEditingReaderCommunity ? root.querySelector('#crx-reader-community-title')?.value : selectedReaderCommunity?.title || readerOption?.textContent || '').trim()
            : '';
        const readerCommunityPrompt = reactionMode === 'reader' && readerCommunityId
            ? String(isEditingReaderCommunity ? root.querySelector('#crx-reader-community-prompt')?.value : selectedReaderCommunity?.prompt || '').trim()
            : '';
        const topicSelect = root.querySelector('#crx-topic');
        const topicOption = topicSelect?.selectedOptions?.[0] || null;
        const topicId = reactionMode === 'npc' ? String(topicSelect?.value || '') : '';
        const selectedTopic = topicId && topicId !== ADD_OPTION_VALUE ? getNpcTopic(composerIndex, topicId) : null;
        const isEditingTopic = reactionMode === 'npc' && topicId && topicId !== ADD_OPTION_VALUE && !root.querySelector('#crx-topic-form')?.classList.contains('is-hidden');
        const topicTitle = reactionMode === 'npc'
            ? String(isEditingTopic ? root.querySelector('#crx-topic-title')?.value : selectedTopic?.title || topicOption?.textContent || '').trim()
            : '';
        const topicPrompt = reactionMode === 'npc'
            ? String(isEditingTopic ? root.querySelector('#crx-topic-prompt')?.value : selectedTopic?.prompt || '').trim()
            : '';
        const phoneAppId = isPhone ? getPhoneAppOrDefault(root.querySelector('#crx-phone-app')?.value) : '';
        const site = isPhone
            ? phoneAppId
            : reactionMode === 'npc' && isEditingTopic
            ? getNpcSiteOrDefault(root.querySelector('#crx-topic-site').value)
            : reactionMode === 'npc' && topicOption?.dataset?.site
                ? getNpcSiteOrDefault(selectedTopic?.site || topicOption.dataset.site)
                : reactionMode === 'reader' && isEditingReaderCommunity
                    ? getReaderSiteOrDefault(root.querySelector('#crx-reader-community-site').value)
                    : reactionMode === 'reader' && readerOption?.dataset?.site
                        ? getReaderSiteOrDefault(selectedReaderCommunity?.site || readerOption.dataset.site)
                        : getReaderSiteOrDefault(readerSelection.replace(/^site:/, ''));
        const sitePreset = SITE_PRESETS[site];
        const selectedCountry = sitePreset.supportsCountry ? root.querySelector('#crx-country').value : sitePreset.fixedCountry;
        const customCountry = sitePreset.supportsCountry ? normalizeCustomCountry(root.querySelector('#crx-custom-country')?.value) : '';
        if (sitePreset.supportsCountry && selectedCountry === CUSTOM_COUNTRY_KEY && !customCountry) {
            throw new Error('직접 입력할 국적을 적어주세요.');
        }
        const country = sitePreset.supportsCountry ? resolveSiteCountryForGeneration(selectedCountry, customCountry) : sitePreset.fixedCountry;
        const outputLanguage = root.querySelector('#crx-language').value;
        const countryContext = getCountryContext(country, country === CUSTOM_COUNTRY_KEY ? customCountry : '');
        const showPreserve = shouldShowPreserveOriginal(countryContext, outputLanguage, isPhone);
        const preserveProfileIdentity = reactionMode === 'npc'
            && site === 'twitter'
            && Boolean(root.querySelector('#crx-preserve-profile-identity')?.checked);

        if (start > end) {
            throw new Error('시작 메시지는 끝 메시지보다 클 수 없습니다.');
        }
        const effectiveTopicPrompt = reactionMode === 'npc' ? topicPrompt || String(root.querySelector('#crx-custom-prompt')?.value || '').trim() : topicPrompt;
        if (reactionMode === 'npc' && (topicId === ADD_OPTION_VALUE || !topicId || !effectiveTopicPrompt)) {
            throw new Error('NPC 반응 카테고리를 먼저 추가하거나 선택하세요.');
        }
        if (reactionMode === 'reader' && readerSelection === ADD_OPTION_VALUE) {
            throw new Error('커뮤니티를 먼저 추가하거나 기본 커뮤니티를 선택하세요.');
        }
        if (reactionMode === 'reader' && readerCommunityId && !readerCommunityPrompt) {
            throw new Error('커스텀 커뮤니티 프롬프트를 입력하세요.');
        }

        return {
            start,
            end,
            reaction_mode: reactionMode,
            phone_app_id: phoneAppId,
            phone_app_label: isPhone ? PHONE_APP_PRESETS[phoneAppId]?.label || '어플리케이션' : '',
            character_name: getActiveCharacterName(context),
            topic_id: topicId,
            topic_title: topicTitle,
            topic_prompt: effectiveTopicPrompt,
            preserve_profile_identity: preserveProfileIdentity,
            reader_community_id: readerCommunityId,
            reader_community_title: readerCommunityTitle,
            reader_community_prompt: readerCommunityPrompt,
            site,
            selected_site_country: selectedCountry,
            site_country: country,
            custom_site_country: country === CUSTOM_COUNTRY_KEY ? customCountry : '',
            site_country_label: countryContext.label,
            site_country_language: countryContext.language,
            site_country_language_label: countryContext.languageLabel,
            is_american_country: countryContext.isAmerican,
            output_language: outputLanguage,
            media_type: reactionMode === 'npc' || isPhone ? '' : root.querySelector('#crx-media-type').value,
            apiSource: root.querySelector('#crx-api-source').value,
            max_tokens: getMaxTokensInput(root),
            post_count: Number(root.querySelector('#crx-post-count').value || sitePreset.defaultPosts),
            include_hidden_messages: root.querySelector('#crx-include-hidden')?.checked || false,
            include_world_info: root.querySelector('#crx-include-world-info')?.checked || false,
            include_character_card: root.querySelector('#crx-include-character-card')?.checked || false,
            has_anti: root.querySelector('#crx-has-anti').checked,
            preserve_original: showPreserve && root.querySelector('#crx-preserve-original').checked,
            custom_prompt: reactionMode === 'npc'
                ? ''
                : readerCommunityId ? readerCommunityPrompt : String(root.querySelector('#crx-custom-prompt')?.value || '').trim(),
        };
    }

    function getActiveCharacterName(context) {
        const character = getCurrentCharacters(context)[0] || context?.characters?.[context?.characterId] || null;
        return String(character?.name || context?.name2 || context?.character?.name || '').trim();
    }

    function getPhoneAppOrDefault(value) {
        return PHONE_APP_KEYS.includes(value) ? value : PHONE_APP_KEYS[0];
    }

    function getNpcSiteOrDefault(value) {
        return NPC_SITE_KEYS.includes(value) ? value : NPC_SITE_KEYS[0];
    }

    function getReaderSiteOrDefault(value) {
        return READER_SITE_KEYS.includes(value) ? value : READER_SITE_KEYS[0];
    }

    function getMessageText(message, fallbackIndex) {
        const name = message?.name || (message?.is_user ? 'User' : 'Character');
        const text = stripOocPrefixedCommands(String(message?.mes || '').replace(/<[^>]+>/g, '')).trim();
        if (!text) {
            return '';
        }
        return `[${fallbackIndex}] ${name}: ${text}`;
    }

    function stripOocPrefixedCommands(value) {
        return String(value || '')
            .split(/\r?\n/)
            .filter(line => !/^\s*(?:[\[(]\s*)?ooc\s*(?:[\])]\s*)?(?::|：|\-|--|\s)/i.test(line))
            .join('\n')
            .trim();
    }

    function buildTranscript(context, input) {
        return context.chat
            .slice(input.start - 1, input.end)
            .map((message, offset) => {
                if (!input.include_hidden_messages && message?.is_system) {
                    return '';
                }
                return getMessageText(message, input.start + offset);
            })
            .filter(Boolean)
            .join('\n\n');
    }

    function stripPromptText(value) {
        return String(value || '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function clampPromptBlock(value, maxChars = 60000) {
        const text = String(value || '').trim();
        if (text.length <= maxChars) {
            return text;
        }
        return `${text.slice(0, maxChars)}\n\n[Truncated by Community Reactions: source context was too long.]`;
    }

    function formatCharacterCardContext(context) {
        const fields = context?.getCharacterCardFields?.();
        if (!fields) {
            return '';
        }

        const sections = [
            ['Description', fields.description],
            ['Personality', fields.personality],
            ['Scenario', fields.scenario],
            ['First Message', fields.firstMessage],
            ['Example Dialogues', fields.mesExamples],
            ['System Prompt', fields.system],
            ['Post-History Instructions', fields.jailbreak],
            ['Depth Prompt', fields.charDepthPrompt],
            ['Creator Notes', fields.creatorNotes],
        ]
            .map(([label, value]) => {
                const text = Array.isArray(value) ? value.filter(Boolean).join('\n\n') : stripPromptText(value);
                return text ? `### ${label}\n${text}` : '';
            })
            .filter(Boolean);

        return sections.join('\n\n');
    }

    function getCurrentCharacters(context) {
        if (context?.groupId) {
            const group = context.groups?.find?.(item => String(item.id) === String(context.groupId));
            const members = Array.isArray(group?.members) ? group.members : [];
            return members
                .map(member => context.characters?.find?.(character => character?.avatar === member || character?.name === member))
                .filter(Boolean);
        }

        const character = context?.characters?.[context?.characterId];
        return character ? [character] : [];
    }

    function getLinkedWorldNames(context) {
        const names = new Set();
        const chatWorld = context?.chatMetadata?.world_info;
        if (chatWorld) {
            names.add(chatWorld);
        }

        for (const character of getCurrentCharacters(context)) {
            const worldName = character?.data?.extensions?.world;
            if (worldName) {
                names.add(worldName);
            }
        }

        return Array.from(names);
    }

    function getWorldEntriesArray(data) {
        if (!data?.entries || typeof data.entries !== 'object') {
            return [];
        }
        return Object.values(data.entries).filter(entry => entry && typeof entry === 'object');
    }

    function formatWorldEntry(entry, index) {
        const content = stripPromptText(entry.content);
        if (!content) {
            return '';
        }

        const label = stripPromptText(entry.comment || entry.memo || entry.name || `entry ${index + 1}`);
        const keys = Array.isArray(entry.key) ? entry.key.filter(Boolean).join(', ') : '';
        const header = [label, keys ? `keys: ${keys}` : ''].filter(Boolean).join(' | ');
        return header ? `### ${header}\n${content}` : content;
    }

    function formatEmbeddedCharacterBooks(context) {
        const blocks = [];
        for (const character of getCurrentCharacters(context)) {
            if (!character?.data?.character_book) {
                continue;
            }
            const converted = context?.convertCharacterBook
                ? context.convertCharacterBook(character.data.character_book)
                : character.data.character_book;
            const entries = getWorldEntriesArray(converted)
                .map((entry, index) => formatWorldEntry(entry, index))
                .filter(Boolean);
            if (entries.length) {
                blocks.push(`## Embedded Character Lorebook: ${stripPromptText(character.name)}\n${entries.join('\n\n')}`);
            }
        }
        return blocks.join('\n\n');
    }

    async function formatLinkedWorldInfoContext(context) {
        const blocks = [];
        const worldNames = getLinkedWorldNames(context);
        for (const worldName of worldNames) {
            const data = await context?.loadWorldInfo?.(worldName);
            const entries = getWorldEntriesArray(data)
                .filter(entry => !entry.disable && !entry.disabled)
                .map((entry, index) => formatWorldEntry(entry, index))
                .filter(Boolean);
            if (entries.length) {
                blocks.push(`## Linked World Info: ${stripPromptText(worldName)}\n${entries.join('\n\n')}`);
            }
        }

        const embedded = formatEmbeddedCharacterBooks(context);
        if (embedded) {
            blocks.push(embedded);
        }

        return blocks.join('\n\n');
    }

    async function formatWorldInfoContext(context, transcript, input) {
        if (!context?.getWorldInfoPrompt) {
            return formatLinkedWorldInfoContext(context);
        }

        const chatForWorldInfo = transcript
            .split(/\n{2,}/)
            .map(text => text.replace(/^\[\d+\]\s*[^:]+:\s*/, '').trim())
            .filter(Boolean)
            .reverse();
        const cardFields = input.include_character_card ? context.getCharacterCardFields?.() || {} : {};
        try {
            const result = await context.getWorldInfoPrompt(chatForWorldInfo, context.maxContext || 8192, true, {
                characterDescription: cardFields.description || '',
                characterPersonality: cardFields.personality || '',
                characterDepthPrompt: cardFields.charDepthPrompt || '',
                scenario: cardFields.scenario || '',
                creatorNotes: cardFields.creatorNotes || '',
                trigger: 'normal',
            });

            const activated = stripPromptText([
                result?.worldInfoBefore,
                result?.worldInfoAfter,
                result?.worldInfoString && !result.worldInfoBefore && !result.worldInfoAfter ? result.worldInfoString : '',
            ].filter(Boolean).join('\n\n'));

            if (activated) {
                return activated;
            }
        } catch (error) {
            console.warn('[Community Reactions] Failed to collect activated world info. Falling back to linked lorebooks.', error);
        }

        return formatLinkedWorldInfoContext(context);
    }

    async function buildSupplementalContext(context, input, transcript) {
        const sections = [];

        if (input.include_character_card) {
            const characterCard = formatCharacterCardContext(context);
            if (characterCard) {
                sections.push(`## Character Card\n${characterCard}`);
            }
        }

        if (input.include_world_info) {
            const worldInfo = await formatWorldInfoContext(context, transcript, input);
            if (worldInfo) {
                sections.push(`## Activated World Info\n${worldInfo}`);
            }
        }

        return clampPromptBlock(sections.join('\n\n'));
    }

    function normalizeTwitterProfileKey(author, handle) {
        const authorKey = String(author || '').trim().toLowerCase();
        if (authorKey && !['익명', 'anonymous'].includes(authorKey)) {
            return `author:${authorKey}`;
        }

        const handleKey = String(handle || '').trim().toLowerCase();
        return handleKey ? `handle:${handleKey}` : '';
    }

    function collectTwitterProfileFromValue(value, profiles) {
        if (!value || typeof value !== 'object') {
            return;
        }

        const author = String(value.author || '').trim();
        const handle = String(value.handle || '').trim();
        const key = normalizeTwitterProfileKey(author, handle);
        if (!key || profiles.has(key)) {
            return;
        }

        profiles.set(key, {
            author: author || '익명',
            handle,
            is_private: coerceBoolean(value.is_private ?? value.private ?? value.protected),
        });
    }

    function collectTwitterProfilesFromResult(result, profiles) {
        if (result?.generation?.reaction_mode !== 'npc' || result?.generation?.site !== 'twitter') {
            return;
        }

        for (const post of Array.isArray(result.posts) ? result.posts : []) {
            collectTwitterProfileFromValue(post, profiles);
            collectTwitterProfileFromValue(post?.quoted_post, profiles);
            for (const reply of Array.isArray(post?.replies) ? post.replies : []) {
                collectTwitterProfileFromValue(reply, profiles);
            }
        }
    }

    async function collectNpcTwitterProfileMemory(chatPk, input, maxResults = 8, maxProfiles = 24) {
        if (!input.preserve_profile_identity || input.reaction_mode !== 'npc' || input.site !== 'twitter' || !input.topic_id) {
            return [];
        }

        const index = await loadIndex(chatPk);
        const viewKey = `npc:${input.topic_id}`;
        const targetItems = (index.items || [])
            .filter(item => getItemViewKey(item) === viewKey && item.site === 'twitter')
            .slice(0, maxResults);
        const profiles = new Map();

        for (const item of targetItems) {
            if (profiles.size >= maxProfiles) {
                break;
            }

            try {
                collectTwitterProfilesFromResult(await readJson(item.path), profiles);
            } catch (error) {
                console.warn('[Community Reactions] Failed to read profile memory item.', item.path, error);
            }
        }

        return Array.from(profiles.values()).slice(0, maxProfiles);
    }

    function stripJsonCodeFence(raw) {
        const text = String(raw || '').trim();
        const fenced = text.match(/^```(?:json|JSON)?\s*([\s\S]*?)\s*```$/);
        return fenced ? fenced[1].trim() : text;
    }

    async function sendProfileRequest(context, profileId, prompt, maxTokens = DEFAULT_MAX_TOKENS) {
        const service = context.ConnectionManagerRequestService;
        if (!service) {
            throw new Error('Connection Manager를 사용할 수 없습니다.');
        }

        const messages = [{ role: 'user', content: prompt }];
        const response = await service.sendRequest(profileId, messages, maxTokens, {
            stream: false,
            extractData: true,
            includePreset: true,
            includeInstruct: true,
        });

        if (typeof response === 'string') {
            return response;
        }
        return response?.content || response?.message || response?.choices?.[0]?.message?.content || '';
    }

    async function generateReaction(input) {
        const context = getContextSafe();
        const chatPk = ensureChatPk(context);
        const transcript = buildTranscript(context, input);
        if (!transcript) {
            throw new Error('선택한 범위에 생성할 대화 내용이 없습니다.');
        }

        const supplementalContext = await buildSupplementalContext(context, input, transcript);
        const profileMemory = await collectNpcTwitterProfileMemory(chatPk, input);
        const promptInput = profileMemory.length
            ? { ...input, npc_twitter_profiles: profileMemory }
            : input;
        const prompt = input.reaction_mode === 'phone'
            ? phone.buildPhoneGenerationPrompt(input, transcript, supplementalContext)
            : prompts.buildGenerationPrompt(promptInput, transcript, supplementalContext);
        let raw = '';
        if (input.apiSource === 'main') {
            if (!context.generateRaw) {
                throw new Error('generateRaw를 사용할 수 없습니다.');
            }
            raw = await context.generateRaw({
                systemPrompt: 'You are a JSON-only community reaction generator.',
                prompt,
                streaming: false,
                responseLength: input.max_tokens || DEFAULT_MAX_TOKENS,
            });
        } else {
            raw = await sendProfileRequest(context, input.apiSource.replace('profile:', ''), prompt, input.max_tokens || DEFAULT_MAX_TOKENS);
        }

        let parsed;
        try {
            parsed = JSON.parse(stripJsonCodeFence(raw));
        } catch (error) {
            const fileName = await saveFailedGeneration(chatPk, input, raw, error, 'json_parse');
            const parseError = new SyntaxError(`생성된 데이터에 문제가 있습니다. 실패 응답 저장: ${fileName}`);
            parseError.crxFailedFile = fileName;
            throw parseError;
        }

        const phonePayload = input.reaction_mode === 'phone'
            ? phone.normalizePhonePayload(parsed, input)
            : null;
        const posts = input.reaction_mode === 'phone' ? [] : normalizePosts(parsed.posts, input);
        if (input.reaction_mode === 'phone' && !phone.hasPhoneAppContent(phonePayload)) {
            const schemaError = new Error('생성된 휴대폰 데이터가 없습니다.');
            const fileName = await saveFailedGeneration(chatPk, input, raw, schemaError, 'schema_validation');
            schemaError.crxFailedFile = fileName;
            throw schemaError;
        }
        if (input.reaction_mode !== 'phone' && !posts.length) {
            const schemaError = new Error('생성된 데이터에 게시글이 없습니다.');
            const fileName = await saveFailedGeneration(chatPk, input, raw, schemaError, 'schema_validation');
            schemaError.crxFailedFile = fileName;
            throw schemaError;
        }

        return {
            version: 1,
            id: createId('crx'),
            chat_pk: chatPk,
            created_at: new Date().toISOString(),
            generation: {
                reaction_mode: input.reaction_mode || 'reader',
                phone_app_id: input.phone_app_id || '',
                phone_app_label: input.phone_app_label || '',
                character_name: input.character_name || '',
                topic_id: input.topic_id || '',
                topic_title: input.topic_title || '',
                topic_prompt: input.topic_prompt || '',
                preserve_profile_identity: Boolean(input.preserve_profile_identity),
                reader_community_id: input.reader_community_id || '',
                reader_community_title: input.reader_community_title || '',
                reader_community_prompt: input.reader_community_prompt || '',
                site: input.site,
                selected_site_country: input.selected_site_country || input.site_country,
                site_country: input.site_country,
                custom_site_country: input.custom_site_country || '',
                site_country_label: input.site_country_label || '',
                site_country_language: input.site_country_language || '',
                site_country_language_label: input.site_country_language_label || '',
                is_american_country: Boolean(input.is_american_country),
                output_language: input.output_language,
                preserve_original: input.preserve_original,
                has_anti: input.has_anti,
                media_type: input.media_type,
                max_tokens: input.max_tokens || DEFAULT_MAX_TOKENS,
                include_hidden_messages: input.include_hidden_messages,
                include_world_info: input.include_world_info,
                include_character_card: input.include_character_card,
            },
            phone: phonePayload,
            posts,
        };
    }

    function normalizePosts(posts, input) {
        if (!Array.isArray(posts)) {
            return [];
        }

        const shouldGeneratePostDates = input.reaction_mode !== 'npc';
        const generatedPostDates = shouldGeneratePostDates ? createRandomRecentDateSeries(posts.length, 3) : [];
        return posts
            .map((post, index) => normalizePost(post, index, input, generatedPostDates[index] || null))
            .filter(Boolean)
            .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    }

    function normalizePost(post, index, input, generatedCreatedAt = null) {
        if (!post || typeof post !== 'object') {
            return null;
        }

        const id = String(post.id || `post_${String(index + 1).padStart(3, '0')}`);
        const createdAt = generatedCreatedAt || coerceCreatedAtIso(post.created_at);
        const postCreatedMs = Date.parse(createdAt);
        const rawReplies = Array.isArray(post.replies) ? post.replies : [];
        const shouldGenerateReplyDates = input.reaction_mode !== 'npc';
        const replyDates = shouldGenerateReplyDates ? createAscendingDateSeriesAfter(rawReplies.length, postCreatedMs) : [];
        const normalizedReplies = rawReplies.length
            ? rawReplies.map((reply, replyIndex) => normalizeReply(reply, id, replyIndex, input, postCreatedMs, replyDates[replyIndex] || null)).filter(Boolean)
            : [];
        const replies = isBoardSite(input.site) ? normalizedReplies.slice(0, input.site === 'everytime' ? 12 : 9) : normalizedReplies;
        const explicitReplyCount = Number(post.replies_count);
        const replyCount = isBoardSite(input.site)
            ? replies.length
            : Number.isFinite(explicitReplyCount) ? explicitReplyCount : replies.length;
        const normalized = isBoardSite(input.site) ? {
            id,
            category: String(post.category || (input.site === 'everytime' ? '자유게시판' : input.reaction_mode === 'npc' ? '자유게시판' : 'BL 달글')),
            title: String(post.title || ''),
            created_at: createdAt,
            likes: Number(post.likes || 0),
            views: Number(post.views || 0),
            replies_count: replyCount,
            replies,
        } : input.site === 'webNovelReview' ? {
            id,
            reviewer_id: createMaskedReviewerId(`${id}|${post.content || post.translation?.content || post.original?.content || index}`),
            created_at: createdAt,
            rating: Math.max(1, Math.min(5, Math.round(Number(post.rating || post.stars || 5)))),
            likes: Number(post.likes || 0),
            replies,
        } : {
            id,
            author: String(post.author || '익명'),
            handle: post.handle ? String(post.handle) : '',
            is_private: coerceBoolean(post.is_private ?? post.private ?? post.protected),
            created_at: createdAt,
            likes: Number(post.likes || 0),
            reposts: Number(post.reposts || 0),
            views: Number(post.views || 0),
            replies_count: replyCount,
            replies,
            quoted_post: normalizeQuotedTweet(post.quoted_post, input, postCreatedMs),
        };

        if (input.preserve_original) {
            normalized.original = normalizeLocalized(post.original);
            normalized.translation = normalizeLocalized(post.translation);
            if (!normalized.original?.content || !normalized.translation?.content) {
                return null;
            }
        } else {
            normalized.content = String(post.content || '');
            if (!normalized.content) {
                return null;
            }
        }

        return normalized;
    }

    function normalizeQuotedTweet(quotedPost, input, postCreatedMs = null) {
        if (input.site !== 'twitter' || !quotedPost || typeof quotedPost !== 'object') {
            return null;
        }

        const normalized = {
            author: String(quotedPost.author || '익명'),
            handle: quotedPost.handle ? String(quotedPost.handle) : '',
            is_private: coerceBoolean(quotedPost.is_private ?? quotedPost.private ?? quotedPost.protected),
            created_at: createQuoteDateNearPostIso(postCreatedMs, quotedPost.created_at),
        };

        if (input.preserve_original) {
            normalized.original = normalizeLocalized(quotedPost.original);
            normalized.translation = normalizeLocalized(quotedPost.translation);
            if (!normalized.original?.content || !normalized.translation?.content) {
                return null;
            }
        } else {
            normalized.content = String(quotedPost.content || '');
            if (!normalized.content) {
                return null;
            }
        }

        return normalized;
    }

    function normalizeReply(reply, postId, index, input = {}, postCreatedMs = null, generatedCreatedAt = null) {
        if (!reply || typeof reply !== 'object') {
            return null;
        }

        const createdAt = generatedCreatedAt || coerceCreatedAtIso(reply.created_at, postCreatedMs);
        const normalized = isBoardSite(input.site) ? {
            id: String(reply.id || `${postId}_reply_${String(index + 1).padStart(3, '0')}`),
            is_reply: Boolean(reply.is_reply || reply.reply_to),
            created_at: createdAt,
        } : input.site === 'webNovelReview' ? {
            id: String(reply.id || `${postId}_reply_${String(index + 1).padStart(3, '0')}`),
            reviewer_id: createMaskedReviewerId(`${postId}|reply|${index}|${reply.content || reply.translation?.content || reply.original?.content || ''}`),
            likes: Number(reply.likes || 0),
            created_at: createdAt,
        } : {
            id: String(reply.id || `${postId}_reply_${String(index + 1).padStart(3, '0')}`),
            author: String(reply.author || '익명'),
            handle: reply.handle ? String(reply.handle) : '',
            is_private: coerceBoolean(reply.is_private ?? reply.private ?? reply.protected),
            is_reply: Boolean(reply.is_reply || reply.reply_to),
            likes: Number(reply.likes || 0),
            created_at: createdAt,
        };

        if (input.preserve_original) {
            normalized.original = normalizeLocalized(reply.original);
            normalized.translation = normalizeLocalized(reply.translation);
            if (!normalized.original?.content || !normalized.translation?.content) {
                return null;
            }
        } else {
            normalized.content = String(reply.content || '');
            if (!normalized.content) {
                return null;
            }
        }

        return normalized;
    }

    function normalizeLocalized(value) {
        if (!value || typeof value !== 'object') {
            return null;
        }
        return {
            language: String(value.language || ''),
            content: String(value.content || ''),
        };
    }

    async function openComposer() {
        await initializeStorage();
        await initializeTemplates();
        await initializePrompts();
        await initializePhone();

        const context = getContextSafe();
        if (!context?.chat?.length) {
            toastr.warning('대화 내역이 없습니다.');
            return;
        }

        const chatPk = ensureChatPk(context);
        const index = await loadIndex(chatPk);
        closeComposer();
        const modal = createModal(templates.buildComposerHtml(context, index), 'crx-composer-modal');
        state.composerModal = modal;
        const root = modal.querySelector('.crx-popup');
        setComposerIndex(root, index);

        root.querySelector('#crx-close-composer').addEventListener('click', closeComposer);
        modal.querySelector('.crx-modal-backdrop').addEventListener('click', closeComposer);
        root.querySelector('#crx-reaction-mode').addEventListener('change', () => syncComposerControls(root));
        root.querySelector('#crx-reader-community').addEventListener('change', () => syncComposerControls(root));
        root.querySelector('#crx-reader-community-site').addEventListener('change', () => syncComposerControls(root));
        root.querySelector('#crx-phone-app').addEventListener('change', () => syncComposerControls(root));
        root.querySelector('#crx-topic').addEventListener('change', () => syncComposerControls(root));
        root.querySelector('#crx-topic-site').addEventListener('change', () => syncComposerControls(root));
        root.querySelector('#crx-country').addEventListener('change', () => syncComposerControls(root));
        root.querySelector('#crx-custom-country').addEventListener('input', () => syncComposerControls(root));
        root.querySelector('#crx-language').addEventListener('change', () => syncComposerControls(root));
        root.querySelector('#crx-post-count').addEventListener('input', () => syncComposerControls(root));
        root.querySelector('#crx-topic-prompt').addEventListener('input', () => {
            if (root.querySelector('#crx-reaction-mode')?.value === 'npc') {
                const customPrompt = root.querySelector('#crx-custom-prompt');
                if (customPrompt) {
                    customPrompt.value = root.querySelector('#crx-topic-prompt').value;
                }
            }
        });
        root.querySelector('#crx-custom-prompt').addEventListener('input', () => {
            if (root.querySelector('#crx-reaction-mode')?.value === 'npc') {
                const topicPrompt = root.querySelector('#crx-topic-prompt');
                if (topicPrompt && !root.querySelector('#crx-topic-form')?.classList.contains('is-hidden')) {
                    topicPrompt.value = root.querySelector('#crx-custom-prompt').value;
                }
            }
        });
        root.querySelector('#crx-range-start').addEventListener('input', () => syncMessagePreviews(root, context));
        root.querySelector('#crx-range-end').addEventListener('input', () => syncMessagePreviews(root, context));
        root.querySelectorAll('[data-crx-help]').forEach(button => {
            button.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                const key = button.dataset.crxHelp;
                const selector = `[data-crx-help-text="${cssEscape(key)}"]`;
                const helpText = button.closest('label')?.querySelector(selector) ?? root.querySelector(selector);
                if (!helpText) {
                    return;
                }

                if (state.activeHelpButton === button && helpText.classList.contains('crx-help-visible')) {
                    hideActiveHelpTooltip();
                    return;
                }

                hideActiveHelpTooltip();
                state.activeHelpButton = button;
                button.setAttribute('aria-expanded', 'true');
                positionHelpTooltip(button, helpText);
            });
        });
        root.querySelector('.crx-sheet')?.addEventListener('scroll', hideActiveHelpTooltip, { passive: true });
        root.addEventListener('click', event => {
            if (!event.target.closest('[data-crx-help]')) {
                hideActiveHelpTooltip();
            }
        });
        window.addEventListener('resize', hideActiveHelpTooltip, { once: true });
        root.querySelector('#crx-save-reader-community').addEventListener('click', () => void handleSaveReaderCommunity(root, chatPk));
        root.querySelector('#crx-delete-reader-community').addEventListener('click', () => void handleDeleteReaderCommunity(root, chatPk));
        root.querySelector('#crx-save-topic').addEventListener('click', () => void handleSaveNpcTopic(root, chatPk));
        root.querySelector('#crx-delete-topic').addEventListener('click', () => void handleDeleteNpcTopic(root, chatPk));
        root.querySelector('#crx-open-library').addEventListener('click', () => {
            const mode = root.querySelector('#crx-reaction-mode')?.value || 'reader';
            void (mode === 'phone' ? openPhoneLibrary() : openLibrary());
        });
        root.querySelector('#crx-generate').addEventListener('click', () => void handleGenerate(root));
        syncComposerControls(root);
        syncMessagePreviews(root, context);
    }

    async function handleSaveReaderCommunity(root, chatPk) {
        const button = root.querySelector('#crx-save-reader-community');
        try {
            button.disabled = true;
            const communitySelect = root.querySelector('#crx-reader-community');
            const selectedCommunityId = communitySelect?.selectedOptions?.[0]?.dataset?.id || '';
            const communityInput = {
                title: root.querySelector('#crx-reader-community-title').value,
                site: getReaderSiteOrDefault(root.querySelector('#crx-reader-community-site').value),
                prompt: root.querySelector('#crx-reader-community-prompt').value,
            };
            const isEdit = Boolean(selectedCommunityId);
            const community = isEdit
                ? await updateReaderCommunity(chatPk, selectedCommunityId, communityInput)
                : await addReaderCommunity(chatPk, communityInput);
            if (!community) {
                throw new Error('수정할 커뮤니티를 찾을 수 없습니다.');
            }

            let option = communitySelect.querySelector(`option[data-id="${cssEscape(community.id)}"]`);
            if (!option) {
                option = document.createElement('option');
                const addOption = communitySelect.querySelector(`option[value="${ADD_OPTION_VALUE}"]`);
                communitySelect.insertBefore(option, addOption);
            }
            option.value = `custom:${community.id}`;
            option.textContent = community.title;
            option.dataset.id = community.id;
            option.dataset.site = community.site;
            delete option.dataset.prompt;
            upsertComposerReaderCommunity(root, community);
            communitySelect.value = `custom:${community.id}`;
            root.querySelector('#crx-reader-community-form').dataset.communityId = community.id;
            syncComposerControls(root);
            toastr.success(isEdit ? '독자 반응 커뮤니티를 수정했습니다.' : '독자 반응 커뮤니티를 추가했습니다.');
        } catch (error) {
            toastr.error(error?.message || '독자 반응 커뮤니티 저장에 실패했습니다.');
        } finally {
            button.disabled = false;
        }
    }

    async function handleDeleteReaderCommunity(root, chatPk) {
        const communitySelect = root.querySelector('#crx-reader-community');
        const communityId = communitySelect?.selectedOptions?.[0]?.dataset?.id || '';
        if (!communityId) {
            toastr.info('삭제할 커뮤니티를 선택하세요.');
            return;
        }

        const ok = await globalThis.SillyTavern?.getContext?.().Popup?.show?.confirm?.('커뮤니티를 삭제하면 해당 커뮤니티의 반응도 전부 삭제됩니다. 삭제하시겠습니까?');
        if (!ok) {
            return;
        }

        const button = root.querySelector('#crx-delete-reader-community');
        try {
            button.disabled = true;
            await deleteReaderCommunity(chatPk, communityId);
            removeComposerReaderCommunity(root, communityId);
            communitySelect.querySelector(`option[data-id="${cssEscape(communityId)}"]`)?.remove();
            communitySelect.value = `site:${READER_SITE_KEYS[0]}`;
            root.querySelector('#crx-reader-community-form').dataset.communityId = '';
            syncComposerControls(root);
            toastr.success('독자 반응 커뮤니티를 삭제했습니다.');
        } catch (error) {
            toastr.error(error?.message || '독자 반응 커뮤니티 삭제에 실패했습니다.');
        } finally {
            button.disabled = false;
        }
    }

    async function handleSaveNpcTopic(root, chatPk) {
        const button = root.querySelector('#crx-save-topic');
        try {
            button.disabled = true;
            const topicSelect = root.querySelector('#crx-topic');
            const selectedTopicId = topicSelect?.value || '';
            const topicSite = getNpcSiteOrDefault(root.querySelector('#crx-topic-site').value);
            const topicInput = {
                title: root.querySelector('#crx-topic-title').value,
                site: topicSite,
                prompt: root.querySelector('#crx-topic-prompt').value,
                preserve_profile_identity: topicSite === 'twitter' && Boolean(root.querySelector('#crx-preserve-profile-identity')?.checked),
            };
            const isEdit = selectedTopicId && selectedTopicId !== ADD_OPTION_VALUE;
            const topic = isEdit
                ? await updateNpcTopic(chatPk, selectedTopicId, topicInput)
                : await addNpcTopic(chatPk, topicInput);
            if (!topic) {
                throw new Error('수정할 카테고리를 찾을 수 없습니다.');
            }

            topicSelect.querySelector('option[value=""]')?.remove();
            let option = topicSelect.querySelector(`option[value="${cssEscape(topic.id)}"]`);
            if (!option) {
                option = document.createElement('option');
                const addOption = topicSelect.querySelector(`option[value="${ADD_OPTION_VALUE}"]`);
                topicSelect.insertBefore(option, addOption);
            }
            option.value = topic.id;
            option.textContent = topic.title;
            option.dataset.site = topic.site;
            option.dataset.preserveProfile = topic.preserve_profile_identity ? 'true' : 'false';
            if (topic.is_default) {
                option.dataset.default = 'true';
            } else {
                delete option.dataset.default;
            }
            delete option.dataset.prompt;
            upsertComposerNpcTopic(root, topic);
            topicSelect.value = topic.id;
            root.querySelector('#crx-topic-form').dataset.topicId = topic.id;
            root.querySelector('#crx-custom-prompt').value = topic.prompt;
            root.querySelector('#crx-custom-prompt').dataset.topicId = topic.id;
            syncComposerControls(root);
            toastr.success(isEdit ? 'NPC 반응 카테고리를 수정했습니다.' : 'NPC 반응 카테고리를 추가했습니다.');
        } catch (error) {
            toastr.error(error?.message || 'NPC 반응 카테고리 저장에 실패했습니다.');
        } finally {
            button.disabled = false;
        }
    }

    async function handleDeleteNpcTopic(root, chatPk) {
        const topicSelect = root.querySelector('#crx-topic');
        const topicId = topicSelect?.value || '';
        if (!topicId || topicId === ADD_OPTION_VALUE) {
            toastr.info('삭제할 카테고리를 선택하세요.');
            return;
        }
        if (topicSelect?.selectedOptions?.[0]?.dataset?.default === 'true') {
            toastr.info('기본 카테고리는 삭제할 수 없습니다.');
            return;
        }

        const ok = await globalThis.SillyTavern?.getContext?.().Popup?.show?.confirm?.('카테고리를 삭제하면 해당 카테고리의 반응도 전부 삭제됩니다. 삭제하시겠습니까?');
        if (!ok) {
            return;
        }

        const button = root.querySelector('#crx-delete-topic');
        try {
            button.disabled = true;
            await deleteNpcTopic(chatPk, topicId);
            removeComposerNpcTopic(root, topicId);
            topicSelect.querySelector(`option[value="${cssEscape(topicId)}"]`)?.remove();
            const firstRealOption = Array.from(topicSelect.options).find(option => option.value && option.value !== ADD_OPTION_VALUE);
            topicSelect.value = firstRealOption?.value || ADD_OPTION_VALUE;
            root.querySelector('#crx-topic-form').dataset.topicId = '';
            root.querySelector('#crx-custom-prompt').value = '';
            root.querySelector('#crx-custom-prompt').dataset.topicId = '';
            syncComposerControls(root);
            toastr.success('NPC 반응 카테고리를 삭제했습니다.');
        } catch (error) {
            toastr.error(error?.message || 'NPC 반응 카테고리 삭제에 실패했습니다.');
        } finally {
            button.disabled = false;
        }
    }

    async function handleGenerate(root) {
        const button = root.querySelector('#crx-generate');
        let loadingInterval = null;
        try {
            const input = getComposerInput(root, getContextSafe());
            await persistEditedNpcTopicPrompt(root, input);
            await persistEditedReaderCommunityPrompt(root, input);
            await persistReaderSiteGenerationOptions(root, input);
            await persistPhoneAppGenerationOptions(root, input);
            button.disabled = true;
            const loadingText = '반응 서치 중입니다';
            let loadingDotCount = 1;
            const updateLoadingText = () => {
                button.textContent = loadingText + '.'.repeat(loadingDotCount);
                loadingDotCount = loadingDotCount === 3 ? 1 : loadingDotCount + 1;
            };
            updateLoadingText();
            loadingInterval = setInterval(updateLoadingText, 600);
            const result = await generateReaction(input);
            await saveResult(result);
            closeComposer();
            if (input.reaction_mode === 'phone') {
                await openPhoneViewer(result);
            } else {
                await openViewer(result);
            }
        } catch (error) {
            const message = error?.crxFailedFile
                ? `${error instanceof SyntaxError ? '생성된 데이터에 문제가 있습니다.' : (error?.message || '생성에 실패했습니다.')} (${error.crxFailedFile})`
                : (error instanceof SyntaxError ? '생성된 데이터에 문제가 있습니다.' : (error?.message || '생성에 실패했습니다.'));
            toastr.error(message);
            button.disabled = false;
            button.textContent = '생성하기';
        } finally {
            if (loadingInterval) {
                clearInterval(loadingInterval);
            }
        }
    }

    async function persistEditedReaderCommunityPrompt(root, input) {
        if (input.reaction_mode !== 'reader' || !input.reader_community_id) {
            return;
        }

        const generationOptions = getGenerationOptionsFromInput(input);
        const communitySelect = root.querySelector('#crx-reader-community');
        const option = communitySelect?.querySelector(`option[data-id="${cssEscape(input.reader_community_id)}"]`);
        const previousCommunity = getReaderCommunity(getComposerIndex(root), input.reader_community_id);
        const previousPrompt = String(previousCommunity?.prompt || '').trim();
        const previousTitle = String(previousCommunity?.title || option?.textContent || '').trim();
        const previousSite = String(previousCommunity?.site || option?.dataset?.site || '').trim();
        const previousOptions = previousCommunity?.generation_options || null;
        if (!option || (
            previousPrompt === input.reader_community_prompt
            && previousTitle === input.reader_community_title
            && previousSite === input.site
            && areGenerationOptionsEqual(previousOptions, generationOptions, input.site, 'reader')
        )) {
            return;
        }

        const chatPk = ensureChatPk(getContextSafe());
        const community = await updateReaderCommunity(chatPk, input.reader_community_id, {
            title: input.reader_community_title,
            site: input.site,
            prompt: input.reader_community_prompt,
            generation_options: generationOptions,
        });
        if (community) {
            option.dataset.site = community.site;
            option.textContent = community.title;
            upsertComposerReaderCommunity(root, community);
        }
    }

    async function persistReaderSiteGenerationOptions(root, input) {
        if (input.reaction_mode !== 'reader' || input.reader_community_id) {
            return;
        }

        const generationOptions = getGenerationOptionsFromInput(input);
        const previousOptions = getComposerIndex(root).reader_site_options?.[input.site] || null;
        if (areGenerationOptionsEqual(previousOptions, generationOptions, input.site, 'reader')) {
            return;
        }

        const chatPk = ensureChatPk(getContextSafe());
        const savedOptions = await updateReaderSiteOptions(chatPk, input.site, generationOptions);
        if (savedOptions) {
            upsertComposerReaderSiteOptions(root, input.site, savedOptions);
        }
    }

    async function persistPhoneAppGenerationOptions(root, input) {
        if (input.reaction_mode !== 'phone' || !input.phone_app_id) {
            return;
        }

        const generationOptions = getGenerationOptionsFromInput(input);
        const previousOptions = getComposerIndex(root).phone_app_options?.[input.phone_app_id] || null;
        if (areGenerationOptionsEqual(previousOptions, generationOptions, input.phone_app_id, 'phone')) {
            return;
        }

        const chatPk = ensureChatPk(getContextSafe());
        const savedOptions = await updatePhoneAppOptions(chatPk, input.phone_app_id, generationOptions);
        if (savedOptions) {
            upsertComposerPhoneAppOptions(root, input.phone_app_id, savedOptions);
        }
    }

    async function persistEditedNpcTopicPrompt(root, input) {
        if (input.reaction_mode !== 'npc' || !input.topic_id) {
            return;
        }

        const generationOptions = getGenerationOptionsFromInput(input);
        const topicSelect = root.querySelector('#crx-topic');
        const option = topicSelect?.querySelector(`option[value="${cssEscape(input.topic_id)}"]`);
        const previousTopic = getNpcTopic(getComposerIndex(root), input.topic_id);
        const previousPrompt = String(previousTopic?.prompt || '').trim();
        const previousTitle = String(previousTopic?.title || option?.textContent || '').trim();
        const previousSite = String(previousTopic?.site || option?.dataset?.site || '').trim();
        const previousProfileIdentity = Boolean(previousTopic?.preserve_profile_identity);
        const profileIdentity = input.site === 'twitter' && Boolean(input.preserve_profile_identity);
        const previousOptions = previousTopic?.generation_options || null;
        if (!option || (
            previousPrompt === input.topic_prompt
            && previousTitle === input.topic_title
            && previousSite === input.site
            && previousProfileIdentity === profileIdentity
            && areGenerationOptionsEqual(previousOptions, generationOptions, input.site, 'npc')
        )) {
            return;
        }

        const chatPk = ensureChatPk(getContextSafe());
        const topic = await updateNpcTopic(chatPk, input.topic_id, {
            title: input.topic_title,
            site: input.site,
            prompt: input.topic_prompt,
            preserve_profile_identity: profileIdentity,
            generation_options: generationOptions,
        });
        if (topic) {
            option.dataset.site = topic.site;
            option.dataset.preserveProfile = topic.preserve_profile_identity ? 'true' : 'false';
            option.textContent = topic.title;
            if (topic.is_default) {
                option.dataset.default = 'true';
            } else {
                delete option.dataset.default;
            }
            upsertComposerNpcTopic(root, topic);
        }
    }

    async function openLibrary() {
        const context = getContextSafe();
        const chatPk = ensureChatPk(context);
        const index = await loadIndex(chatPk);

        const firstItem = index.items.find(item => getItemReactionMode(item) !== 'phone');
        if (!firstItem) {
            toastr.info('저장된 커뮤니티 반응이 없습니다.');
            return;
        }

        openViewerFromItem(firstItem, index, getItemViewKey(firstItem));
    }

    function openViewerFromItem(item, index = null, viewKey = null) {
        if (!item) {
            return;
        }
        if (getItemReactionMode(item) === 'phone') {
            void openPhoneViewerFromItem(item, index, viewKey);
            return;
        }

        closeViewer();
        const actualIndex = index || { items: [item] };
        const activeViewKey = viewKey || getItemViewKey(item);
        state.activeResult = null;
        state.activeIndex = actualIndex;
        state.activeViewKey = activeViewKey;
        resetCommunityState(actualIndex, activeViewKey, item.id);
        state.activeCommunity = item.site || state.communityItems[0]?.site || '';
        state.renderedCount = 0;
        state.deleteMode = false;
        state.boardDetailPostKey = null;
        state.boardListScrollTop = 0;
        state.boardListRenderedCount = 0;

        const modal = createModal(templates.buildViewerHtml(null, actualIndex), 'crx-viewer-modal');
        state.viewerModal = modal;
        bindViewer(modal, actualIndex);
        void renderMorePosts().catch(error => {
            console.warn('[Community Reactions] Failed to render community viewer.', error);
            toastr.error('커뮤니티 보기를 불러오지 못했습니다.');
        });
    }

    async function openViewer(result, index = null, viewKey = null) {
        if (result?.generation?.reaction_mode === 'phone') {
            await openPhoneViewer(result, index, viewKey);
            return;
        }
        closeViewer();
        const context = getContextSafe();
        const chatPk = result.chat_pk || ensureChatPk(context);
        const actualIndex = index || await loadIndex(chatPk);
        state.activeResult = result;
        state.activeIndex = actualIndex;
        state.activeViewKey = viewKey || getResultViewKey(result) || getItemViewKey(actualIndex.items[0]) || '';
        resetCommunityState(actualIndex, state.activeViewKey, result.id);
        state.activeCommunity = state.communityItems[0]?.site || result.generation?.site || '';
        state.renderedCount = 0;
        state.deleteMode = false;
        state.boardDetailPostKey = null;
        state.boardListScrollTop = 0;
        state.boardListRenderedCount = 0;
        if (result?.id) {
            state.communityResults.set(result.id, result);
        }

        const modal = createModal(templates.buildViewerHtml(result, actualIndex), 'crx-viewer-modal');
        state.viewerModal = modal;
        bindViewer(modal, actualIndex);
        await renderMorePosts();
    }

    async function openPhoneLibrary() {
        await initializePhone();
        const context = getContextSafe();
        const chatPk = ensureChatPk(context);
        const index = await loadIndex(chatPk);
        const firstItem = index.items.find(item => getItemReactionMode(item) === 'phone');
        if (!firstItem) {
            toastr.info('저장된 휴대폰 결과가 없습니다.');
            return;
        }

        await openPhoneViewerFromItem(firstItem, index, getItemViewKey(firstItem));
    }

    async function openPhoneViewerFromItem(item, index = null, viewKey = null) {
        await initializePhone();
        if (!item) {
            return;
        }
        const context = getContextSafe();
        const actualIndex = index || await loadIndex(ensureChatPk(context));
        const activeAppId = getPhoneAppOrDefault(String(viewKey || getItemViewKey(item)).replace(/^phone:/, '') || item.phone_app_id || item.site);
        await openPhoneViewer(null, actualIndex, `phone:${activeAppId}`);
    }

    async function openPhoneViewer(result, index = null, viewKey = null) {
        await initializePhone();
        closeViewer();
        const context = getContextSafe();
        const chatPk = result?.chat_pk || ensureChatPk(context);
        const actualIndex = index || await loadIndex(chatPk);
        const activeAppId = getPhoneAppOrDefault(String(viewKey || getResultViewKey(result)).replace(/^phone:/, '') || result?.generation?.phone_app_id || result?.generation?.site);

        state.activeResult = result;
        state.activeIndex = actualIndex;
        state.activeViewKey = `phone:${activeAppId}`;
        state.activeCommunity = activeAppId;
        const initialApps = getInitialPhoneViewerApps(result, activeAppId);
        const modal = createModal(phone.buildPhoneViewerHtml({ apps: initialApps, activeAppId }), 'crx-phone-viewer-modal');
        state.viewerModal = modal;
        bindPhoneViewerFrame(modal);
        bindPhoneViewerDynamicContent(modal);
        void hydratePhoneViewerApps(modal, actualIndex, result, activeAppId);
    }

    function getInitialPhoneViewerApps(result, activeAppId) {
        if (result?.generation?.reaction_mode === 'phone') {
            const activeApp = phone.mergePhoneResults([result], activeAppId);
            if (phone.hasPhoneAppContent(activeApp)) {
                return [activeApp];
            }
        }
        return [phone.createEmptyPhoneAppData(activeAppId)];
    }

    async function hydratePhoneViewerApps(modal, index, preferredResult = null, activeAppId = 'googleSearch') {
        const apps = await collectPhoneViewerApps(index, preferredResult, activeAppId);
        if (state.viewerModal !== modal) {
            return;
        }
        if (!apps.some(app => phone.hasPhoneAppContent(app))) {
            toastr.info('표시할 휴대폰 결과가 없습니다.');
            return;
        }

        replacePhoneViewerPopupContent(modal, phone.buildPhoneViewerHtml({ apps, activeAppId }));
        bindPhoneViewerDynamicContent(modal);
    }

    function replacePhoneViewerPopupContent(modal, html) {
        const currentPopup = modal.querySelector('.crx-popup.is-phone-mode');
        if (!currentPopup) {
            return;
        }
        const currentDevice = currentPopup.querySelector('.crx-phone-device');
        const activeAppId = currentDevice?.dataset.activeApp || '';
        const keepAppOpen = Boolean(activeAppId && currentDevice?.classList.contains('is-app-open'));

        const template = document.createElement('template');
        template.innerHTML = html.trim();
        const nextPopup = template.content.querySelector('.crx-popup.is-phone-mode');
        if (!nextPopup) {
            return;
        }

        currentPopup.replaceChildren(...Array.from(nextPopup.childNodes));
        if (keepAppOpen) {
            openPhoneAppById(modal, activeAppId);
        }
    }

    async function collectPhoneViewerApps(index, preferredResult = null, preferredAppId = 'googleSearch') {
        const apps = await Promise.all(PHONE_APP_KEYS.map(async appId => {
            const items = (index.items || [])
                .filter(item => getItemReactionMode(item) === 'phone' && getItemViewKey(item) === `phone:${appId}`)
                .slice(0, PHONE_VIEWER_ITEMS_PER_APP);
            const results = [];
            if (preferredResult?.generation?.reaction_mode === 'phone' && getPhoneAppOrDefault(preferredResult.generation.phone_app_id || preferredResult.generation.site) === appId) {
                results.push(preferredResult);
            }

            const itemResults = await Promise.all(items
                .filter(item => !results.some(result => result.id === item.id))
                .map(item => readResultWithIndexMetadata(item)));
            for (const itemResult of itemResults) {
                if (!itemResult) {
                    continue;
                }
                results.push(itemResult);
            }
            if (results.length || appId === preferredAppId) {
                return phone.mergePhoneResults(results, appId);
            }
            return null;
        }));
        return apps.filter(app => phone.hasPhoneAppContent(app));
    }

    async function readResultWithIndexMetadata(item) {
        try {
            const result = await readJson(item.path);
            return {
                ...result,
                _source_item_id: item.id,
                _source_item_path: item.path,
                _source_item_created_at: item.created_at,
            };
        } catch (error) {
            console.warn('[Community Reactions] Failed to read result item.', item.path, error);
            return null;
        }
    }

    function bindPhoneViewerFrame(modal) {
        modal.querySelector('.crx-modal-backdrop')?.addEventListener('click', () => closeViewer({ animatePhone: true }));

        modal.addEventListener('click', event => {
            const target = event.target;
            const appIcon = closestInModal(target, '.crx-phone-app-icon', modal);
            if (appIcon) {
                if (appIcon.dataset.phoneAction === 'close') {
                    closeViewer({ animatePhone: true });
                    return;
                }
                openPhoneAppFromIcon(modal, appIcon);
                return;
            }

            const homebar = closestInModal(target, '#crx-phone-homebar', modal);
            if (homebar) {
                showPhoneHome(modal);
                return;
            }

            const historyItem = closestInModal(target, '.crx-phone-google-history-item', modal);
            if (historyItem) {
                openPhoneGoogleSearch(historyItem);
                return;
            }

            const querybar = closestInModal(target, '.crx-phone-google-querybar', modal);
            if (querybar) {
                querybar.closest('.crx-phone-google-app')?.classList.remove('is-search-open');
                return;
            }

            const translateButton = closestInModal(target, '.crx-phone-payment-translate', modal);
            if (translateButton) {
                togglePhonePaymentTranslation(translateButton);
                return;
            }

            const editButton = closestInModal(target, '.crx-phone-payment-edit', modal);
            if (editButton) {
                event.preventDefault();
                event.stopPropagation();
                void openPhonePaymentTransactionEditor(editButton);
            }
        });
    }

    function closestInModal(target, selector, modal) {
        const element = typeof target?.closest === 'function' ? target : target?.parentElement;
        const match = element?.closest?.(selector);
        return match && modal.contains(match) ? match : null;
    }

    function bindPhoneViewerDynamicContent(modal) {
        bindPhonePaymentScrollAreas(modal);
    }

    function openPhoneAppFromIcon(modal, button) {
        openPhoneAppById(modal, button.dataset.phoneApp || 'googleSearch');
    }

    function openPhoneAppById(modal, appId) {
        const device = modal.querySelector('.crx-phone-device');
        if (!device) {
            return;
        }
        device.dataset.activeApp = appId;
        device.classList.add('is-app-open');
        modal.querySelectorAll('.crx-phone-app').forEach(app => {
            const active = app.dataset.phoneApp === appId;
            app.classList.toggle('is-active', active);
            if (active) {
                app.classList.remove('is-search-open');
            }
        });
    }

    function showPhoneHome(modal) {
        const device = modal.querySelector('.crx-phone-device');
        device?.classList.remove('is-app-open');
        modal.querySelectorAll('.crx-phone-app').forEach(app => {
            app.classList.remove('is-active', 'is-search-open');
        });
    }

    function openPhoneGoogleSearch(button) {
        const app = button.closest('.crx-phone-google-app');
        const searchId = button.dataset.searchId || '';
        app?.querySelectorAll('.crx-phone-google-page').forEach(page => {
            page.classList.toggle('is-active', page.dataset.searchId === searchId);
        });
        app?.classList.add('is-search-open');
    }

    function togglePhonePaymentTranslation(button) {
        const app = button.closest('.crx-phone-payment-app');
        const active = app?.classList.toggle('is-translation-visible') || false;
        button.setAttribute('aria-pressed', String(active));
        button.textContent = active ? '원문 보기' : '번역 보기';
    }

    function bindPhonePaymentScrollAreas(modal) {
        modal.querySelectorAll('.crx-phone-payment-scroll').forEach(scrollArea => {
            const list = scrollArea.querySelector('.crx-phone-payment-list');
            if (!list) {
                return;
            }
            scrollArea.addEventListener('scroll', () => {
                if (scrollArea.scrollTop + scrollArea.clientHeight < scrollArea.scrollHeight - 80) {
                    return;
                }
                appendNextPhonePayments(list);
            }, { passive: true });
        });
    }


    async function openPhonePaymentTransactionEditor(button) {
        const row = button.closest('.crx-phone-payment-transaction');
        const resultId = button.dataset.resultId || row?.dataset.resultId || '';
        const transactionId = button.dataset.transactionId || row?.dataset.transactionId || '';
        const target = await getPhonePaymentTransactionEditorTarget(resultId, transactionId);
        if (!target) {
            toastr.error('수정할 결제 내역을 찾을 수 없습니다.');
            return;
        }

        closePostEditor();
        const modal = createModal(templates.buildPaymentTransactionEditorHtml(target.transaction, target.result), 'crx-post-editor-modal');
        state.postEditorModal = modal;
        const root = modal.querySelector('.crx-post-editor');
        modal.querySelector('.crx-modal-backdrop').addEventListener('click', closePostEditor);
        root.querySelector('#crx-cancel-post-edit').addEventListener('click', closePostEditor);
        root.querySelector('#crx-save-post-edit').addEventListener('click', () => void handleSavePhonePaymentTransactionEditor(root, target));
    }

    async function getPhonePaymentTransactionEditorTarget(resultId, transactionId) {
        const direct = await getPhonePaymentTransactionTargetFromResultId(resultId, transactionId);
        if (direct) {
            return direct;
        }

        const items = (state.activeIndex?.items || [])
            .filter(item => getItemReactionMode(item) === 'phone' && getItemViewKey(item) === 'phone:paymentHistory');
        for (const item of items) {
            const target = await getPhonePaymentTransactionTargetFromResultId(item.id, transactionId);
            if (target) {
                return target;
            }
        }
        return null;
    }

    async function getPhonePaymentTransactionTargetFromResultId(resultId, transactionId) {
        if (!resultId || !transactionId) {
            return null;
        }
        let result = state.activeResult?.id === resultId ? state.activeResult : null;
        if (!result) {
            const item = (state.activeIndex?.items || []).find(entry => entry.id === resultId);
            if (!item?.path) {
                return null;
            }
            result = await readJson(item.path);
        }
        const transactions = Array.isArray(result?.phone?.payment?.transactions) ? result.phone.payment.transactions : [];
        const transactionIndex = transactions.findIndex(transaction => String(transaction.id || '') === String(transactionId));
        if (transactionIndex < 0) {
            return null;
        }
        return { result, transaction: transactions[transactionIndex], transactionIndex };
    }

    function applyPhonePaymentTransactionEditorValues(root, transaction) {
        transaction.description = readPostEditorString(root, 'crx-edit-payment-description') || transaction.description || '';
        transaction.detail_note = readPostEditorText(root, 'crx-edit-payment-detail-note').trim();
        transaction.amount = readPhonePaymentEditorAmount(root, 'crx-edit-payment-amount', transaction.amount);
        transaction.display_amount = readPostEditorString(root, 'crx-edit-payment-display-amount') || String(transaction.amount || '');
        transaction.time_label = readPostEditorString(root, 'crx-edit-payment-time-label');
        const occurredAt = readPostEditorString(root, 'crx-edit-payment-occurred-at');
        if (occurredAt) {
            transaction.occurred_at = occurredAt;
        }
        transaction.description_translation = readPostEditorString(root, 'crx-edit-payment-description-translation');
        transaction.detail_note_translation = readPostEditorText(root, 'crx-edit-payment-detail-translation').trim();
    }

    function readPhonePaymentEditorAmount(root, id, fallback = 0) {
        const text = readPostEditorString(root, id).replace(/[^0-9.-]/g, '');
        const amount = Number(text);
        return Number.isFinite(amount) ? amount : Number(fallback) || 0;
    }

    async function handleSavePhonePaymentTransactionEditor(root, target) {
        const button = root.querySelector('#crx-save-post-edit');
        try {
            button.disabled = true;
            applyPhonePaymentTransactionEditorValues(root, target.transaction);
            if (target.result?.phone?.payment) {
                const transactions = Array.isArray(target.result.phone.payment.transactions) ? target.result.phone.payment.transactions : [];
                target.result.phone.payment.has_translation = transactions.some(transaction => Boolean(transaction.description_translation || transaction.detail_note_translation));
            }
            target.result.updated_at = new Date().toISOString();
            await updateResult(target.result);
            const refreshedIndex = await loadIndex(target.result.chat_pk);
            closePostEditor();
            await openPhoneViewer(target.result, refreshedIndex, 'phone:paymentHistory');
            toastr.success('저장했습니다.');
        } catch (error) {
            toastr.error(error?.message || '결제 내역 저장에 실패했습니다.');
        } finally {
            button.disabled = false;
        }
    }

    function appendNextPhonePayments(list) {
        let transactions = [];
        try {
            transactions = JSON.parse(decodeURIComponent(list.dataset.transactions || '%5B%5D'));
        } catch {
            transactions = [];
        }

        const pageSize = clampInteger(list.dataset.pageSize, 1, 50, 10);
        const rendered = clampInteger(list.dataset.rendered, 0, transactions.length, 0);
        const nextItems = transactions.slice(rendered, rendered + pageSize);
        const showWonUnit = list.dataset.showWonUnit === 'true';
        const bankTheme = list.dataset.bankTheme || (showWonUnit ? 'kbKookmin' : 'bankOfAmerica');
        if (!nextItems.length) {
            list.closest('.crx-phone-payment-card')?.querySelector('.crx-phone-payment-more')?.classList.add('is-hidden');
            return;
        }

        list.insertAdjacentHTML('beforeend', phone.renderPaymentTransactionBatch(nextItems, showWonUnit, bankTheme));
        const nextRendered = rendered + nextItems.length;
        list.dataset.rendered = String(nextRendered);
        list.closest('.crx-phone-payment-card')?.querySelector('.crx-phone-payment-more')?.classList.toggle('is-hidden', nextRendered >= transactions.length);
    }

    function bindViewer(modal, index) {
        modal.querySelector('#crx-close-viewer').addEventListener('click', closeViewer);
        modal.querySelector('.crx-modal-backdrop').addEventListener('click', closeViewer);
        modal.querySelector('#crx-post-list').addEventListener('scroll', () => void maybeLoadMoreOnScroll());
        modal.querySelector('#crx-toggle-delete-mode').addEventListener('click', () => toggleDeleteMode());
        modal.querySelector('#crx-community-select').addEventListener('change', async function () {
            const firstItem = index.items.find(x => getItemViewKey(x) === this.value);
            if (!firstItem) {
                return;
            }
            const result = await readJson(firstItem.path);
            await openViewer(result, index, this.value);
        });
        modal.querySelector('#crx-delete-selected-posts').addEventListener('click', () => void deleteSelectedPosts());
        modal.querySelector('#crx-delete-category').addEventListener('click', () => void deleteCurrentCategoryFiles(index));
        modal.querySelector('#crx-post-list').addEventListener('click', event => {
            const boardEdit = event.target.closest?.('#crx-daum-edit, #crx-everytime-edit, #crx-webnovel-edit');
            if (boardEdit) {
                event.preventDefault();
                event.stopPropagation();
                if (!state.deleteMode) {
                    const postElement = boardEdit.closest('.crx-post');
                    void openPostEditor(postElement?.dataset?.postKey || '', 'post');
                }
                return;
            }
            const twitterMore = event.target.closest?.('.crx-twitter-more');
            if (twitterMore) {
                event.preventDefault();
                event.stopPropagation();
                if (!state.deleteMode) {
                    const postElement = twitterMore.closest('.crx-twitter-post');
                    const postKey = twitterMore.dataset.postKey || postElement?.dataset?.postKey || '';
                    void openPostEditor(postKey, twitterMore.dataset.crxEditTarget || 'post', twitterMore.dataset.replyId || '');
                }
                return;
            }
            const toggle = event.target.closest?.('.crx-translation-toggle');
            if (toggle) {
                const post = toggle.closest('.crx-post');
                const showingOriginal = post.classList.toggle('is-original');
                toggle.textContent = showingOriginal ? '번역 보기' : '원본 보기';
                return;
            }

            const commentToggle = event.target.closest?.('.crx-webnovel-comment-toggle');
            if (commentToggle) {
                const replies = commentToggle.closest('.crx-webnovel-review')?.querySelector(`#${cssEscape(commentToggle.getAttribute('aria-controls'))}`);
                const isOpen = commentToggle.getAttribute('aria-expanded') === 'true';
                commentToggle.setAttribute('aria-expanded', String(!isOpen));
                commentToggle.classList.toggle('is-open', !isOpen);
                if (replies) {
                    replies.hidden = isOpen;
                }
                return;
            }

            const back = event.target.closest?.('.crx-daum-back, .crx-daum-return-to-list');
            if (back) {
                state.boardDetailPostKey = null;
                renderBoardList(true);
                return;
            }

            const listItem = event.target.closest?.('.crx-daum-list-item');
            if (listItem && !event.target.closest('.crx-post-check') && !state.deleteMode) {
                const list = state.viewerModal.querySelector('#crx-post-list');
                state.boardListScrollTop = list?.scrollTop || 0;
                state.boardListRenderedCount = state.renderedCount;
                state.boardDetailPostKey = listItem.dataset.postKey;
                renderBoardDetail();
            }
        });
        modal.querySelector('#crx-post-list').addEventListener('keydown', event => {
            if (!['Enter', ' '].includes(event.key) || state.deleteMode) {
                return;
            }
            const listItem = event.target.closest?.('.crx-daum-list-item');
            if (!listItem) {
                return;
            }
            event.preventDefault();
            const list = state.viewerModal.querySelector('#crx-post-list');
            state.boardListScrollTop = list?.scrollTop || 0;
            state.boardListRenderedCount = state.renderedCount;
            state.boardDetailPostKey = listItem.dataset.postKey;
            renderBoardDetail();
        });
    }

    function getPostEditorTarget(postKey, targetType = 'post', replyId = '') {
        const entry = state.communityPosts.find(item => item.key === postKey);
        if (!entry) {
            return null;
        }

        if (targetType === 'reply') {
            const reply = Array.isArray(entry.post?.replies)
                ? entry.post.replies.find(item => item.id === replyId)
                : null;
            if (!reply) {
                return null;
            }
            return { entry, result: entry.result, item: reply, targetType, replyId };
        }

        return { entry, result: entry.result, item: entry.post, targetType: 'post', replyId: '' };
    }

    function openPostEditor(postKey, targetType = 'post', replyId = '') {
        const target = getPostEditorTarget(postKey, targetType, replyId);
        if (!target) {
            toastr.error('수정할 게시글을 찾을 수 없습니다.');
            return;
        }

        closePostEditor();
        const modal = createModal(templates.buildPostEditorHtml(target.item, target.result, { targetType }), 'crx-post-editor-modal');
        state.postEditorModal = modal;
        const root = modal.querySelector('.crx-post-editor');
        modal.querySelector('.crx-modal-backdrop').addEventListener('click', closePostEditor);
        root.querySelector('#crx-cancel-post-edit').addEventListener('click', closePostEditor);
        root.querySelector('#crx-save-post-edit').addEventListener('click', () => void handleSavePostEditor(root, target));
    }

    function getPostEditorInput(root, id) {
        return root.querySelector(`#${id}`);
    }

    function readPostEditorString(root, id) {
        return String(getPostEditorInput(root, id)?.value || '').trim();
    }

    function readPostEditorText(root, id) {
        return String(getPostEditorInput(root, id)?.value || '');
    }

    function readPostEditorNumber(root, id) {
        const number = Number(getPostEditorInput(root, id)?.value || 0);
        return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
    }

    function applyPostEditorContentValues(root, item, result, prefix) {
        if (result?.generation?.preserve_original) {
            item.translation = item.translation && typeof item.translation === 'object' ? item.translation : {};
            item.original = item.original && typeof item.original === 'object' ? item.original : {};
            item.translation.language = readPostEditorString(root, `${prefix}-translation-language`);
            item.translation.content = readPostEditorText(root, `${prefix}-translation-content`);
            item.original.language = readPostEditorString(root, `${prefix}-original-language`);
            item.original.content = readPostEditorText(root, `${prefix}-original-content`);
            return;
        }

        item.content = readPostEditorText(root, `${prefix}-content`);
    }

    function setPostEditorNumberValue(root, item, key, id) {
        if (!getPostEditorInput(root, id)) {
            return;
        }
        item[key] = readPostEditorNumber(root, id);
    }

    function applyTwitterPostEditorValues(root, item, result, prefix = 'crx-edit') {
        const author = readPostEditorString(root, `${prefix}-author`);
        item.author = author || item.author || '';
        item.handle = readPostEditorString(root, `${prefix}-handle`);
        const createdAt = readPostEditorString(root, `${prefix}-created-at`);
        if (createdAt) {
            item.created_at = createdAt;
        }
        const privateInput = getPostEditorInput(root, `${prefix}-is-private`);
        if (privateInput) {
            item.is_private = Boolean(privateInput.checked);
        }
        setPostEditorNumberValue(root, item, 'likes', `${prefix}-likes`);
        setPostEditorNumberValue(root, item, 'reposts', `${prefix}-reposts`);
        setPostEditorNumberValue(root, item, 'views', `${prefix}-views`);
        setPostEditorNumberValue(root, item, 'replies_count', `${prefix}-replies-count`);
        applyPostEditorContentValues(root, item, result, prefix);
    }

    function applyCommonPostEditorValues(root, item, result, prefix = 'crx-edit') {
        const createdAt = readPostEditorString(root, `${prefix}-created-at`);
        if (createdAt) {
            item.created_at = createdAt;
        }
        setPostEditorNumberValue(root, item, 'likes', `${prefix}-likes`);
        setPostEditorNumberValue(root, item, 'views', `${prefix}-views`);
        setPostEditorNumberValue(root, item, 'replies_count', `${prefix}-replies-count`);
        applyPostEditorContentValues(root, item, result, prefix);
    }

    function applyBoardPostEditorValues(root, item, result) {
        item.category = readPostEditorString(root, 'crx-edit-category') || item.category || '';
        item.title = readPostEditorString(root, 'crx-edit-title') || item.title || '';
        applyCommonPostEditorValues(root, item, result);
    }

    function applyWebNovelPostEditorValues(root, item, result) {
        item.reviewer_id = readPostEditorString(root, 'crx-edit-reviewer-id') || item.reviewer_id || '';
        const rating = readPostEditorNumber(root, 'crx-edit-rating');
        item.rating = Math.max(1, Math.min(5, rating || 1));
        applyCommonPostEditorValues(root, item, result);
    }

    function applyPostEditorValues(root, target) {
        const site = target.result?.generation?.site || '';
        if (site === 'daumCafe' || site === 'everytime') {
            applyBoardPostEditorValues(root, target.item, target.result);
            return;
        }
        if (site === 'webNovelReview') {
            applyWebNovelPostEditorValues(root, target.item, target.result);
            return;
        }

        applyTwitterPostEditorValues(root, target.item, target.result);
        if (target.item?.quoted_post) {
            applyTwitterPostEditorValues(root, target.item.quoted_post, target.result, 'crx-edit-quote');
        }
    }
    function rerenderEditedCommunityPost(entry) {
        const renderer = getCommunityRenderer(entry.result?.generation?.site || state.activeCommunity);
        if (renderer?.viewType === 'board') {
            if (state.boardDetailPostKey === entry.key) {
                renderBoardDetail();
            } else {
                renderBoardList(true);
            }
            return;
        }

        const postElement = state.viewerModal?.querySelector(`.crx-post[data-post-key="${cssEscape(entry.key)}"]`);
        if (!postElement || !renderer?.renderPost) {
            return;
        }
        postElement.outerHTML = renderer.renderPost(entry.post, entry.result, entry.key);
    }

    async function handleSavePostEditor(root, target) {
        const button = root.querySelector('#crx-save-post-edit');
        try {
            button.disabled = true;
            applyPostEditorValues(root, target);
            target.result.updated_at = new Date().toISOString();
            await updateResult(target.result);
            state.communityResults.set(target.result.id, target.result);
            if (state.activeResult?.id === target.result.id) {
                state.activeResult = target.result;
            }
            rerenderEditedCommunityPost(target.entry);
            closePostEditor();
            toastr.success('저장했습니다.');
        } catch (error) {
            toastr.error(error?.message || '게시글 저장에 실패했습니다.');
        } finally {
            button.disabled = false;
        }
    }
    function toggleDeleteMode(force = null) {
        if (!state.viewerModal) {
            return;
        }

        state.deleteMode = force == null ? !state.deleteMode : Boolean(force);
        const viewer = state.viewerModal.querySelector('.crx-viewer');
        const button = state.viewerModal.querySelector('#crx-toggle-delete-mode');
        viewer?.classList.toggle('is-delete-mode', state.deleteMode);
        button?.classList.toggle('is-active', state.deleteMode);
        button?.setAttribute('aria-pressed', String(state.deleteMode));

        if (!state.deleteMode) {
            state.viewerModal.querySelectorAll('.crx-post-check input:checked').forEach(input => {
                input.checked = false;
            });
        }
    }

    function getItemReactionMode(item) {
        if (item?.reaction_mode === 'phone' || item?.phone_app_id) {
            return 'phone';
        }
        return item?.reaction_mode === 'npc' || (item?.topic_id && !item?.reader_community_id) ? 'npc' : 'reader';
    }

    function getItemViewKey(item) {
        if (!item) {
            return '';
        }
        const mode = getItemReactionMode(item);
        if (mode === 'phone') {
            return `phone:${getPhoneAppOrDefault(item.phone_app_id || item.site)}`;
        }
        if (mode === 'npc' && item.topic_id) {
            return `npc:${item.topic_id}`;
        }
        if (item.reader_community_id) {
            return `reader-custom:${item.reader_community_id}`;
        }
        return `reader:${item.site || ''}`;
    }

    function getResultViewKey(result) {
        if (!result) {
            return '';
        }
        const generation = result.generation || {};
        if (generation.reaction_mode === 'phone' || generation.phone_app_id) {
            return `phone:${getPhoneAppOrDefault(generation.phone_app_id || generation.site)}`;
        }
        if ((generation.reaction_mode === 'npc' || generation.topic_id) && generation.topic_id) {
            return `npc:${generation.topic_id}`;
        }
        if (generation.reader_community_id) {
            return `reader-custom:${generation.reader_community_id}`;
        }
        return `reader:${generation.site || ''}`;
    }

    function getViewLabel(index, key) {
        if (String(key || '').startsWith('phone:')) {
            const appId = String(key).slice('phone:'.length);
            return PHONE_APP_PRESETS[appId]?.label || '어플리케이션';
        }
        if (String(key || '').startsWith('npc:')) {
            const topicId = String(key).slice(4);
            const topic = getNpcTopic(index, topicId);
            if (topic?.title) {
                return topic.title;
            }
            const item = index?.items?.find(entry => getItemViewKey(entry) === key);
            return item?.topic_title || 'NPC 반응';
        }
        if (String(key || '').startsWith('reader-custom:')) {
            const communityId = String(key).slice('reader-custom:'.length);
            const community = getReaderCommunity(index, communityId);
            if (community?.title) {
                return community.title;
            }
            const item = index?.items?.find(entry => getItemViewKey(entry) === key);
            return item?.reader_community_title || '독자 반응';
        }
        const site = String(key || '').replace(/^reader:/, '');
        return SITE_PRESETS[site]?.label || site;
    }

    function getCommunityOptions(index) {
        const seen = new Set();
        const options = [];
        for (const item of index.items) {
            if (getItemReactionMode(item) === 'phone') {
                continue;
            }
            const key = getItemViewKey(item);
            if (!key || seen.has(key)) {
                continue;
            }
            seen.add(key);
            options.push({
                key,
                label: getViewLabel(index, key),
            });
        }
        return options;
    }

    function resetCommunityState(index, viewKey, preferredResultId = '') {
        const items = index.items.filter(item => getItemViewKey(item) === viewKey);
        state.latestCommunityResultId = items[0]?.id || '';
        const preferredIndex = Math.max(0, items.findIndex(item => item.id === preferredResultId));
        state.communityItems = preferredIndex > 0
            ? [items[preferredIndex], ...items.slice(0, preferredIndex), ...items.slice(preferredIndex + 1)]
            : items;
        state.communityItemCursor = 0;
        state.communityResults = new Map();
        state.communityPosts = [];
        state.communityReferenceDate = null;
        state.hasMoreCommunityItems = state.communityItems.length > 0;
    }

    function getPostKey(resultId, postId) {
        return `${resultId}::${postId}`;
    }

    function parsePostKey(value) {
        const [resultId, ...postParts] = String(value || '').split('::');
        return {
            resultId,
            postId: postParts.join('::'),
        };
    }

    function getCommunityReferenceDate() {
        const newestTime = state.communityPosts
            .map(entry => getDateOrNull(entry.post?.created_at)?.getTime())
            .filter(Number.isFinite)
            .reduce((newest, time) => Math.max(newest, time), -Infinity);

        return Number.isFinite(newestTime) ? new Date(newestTime) : null;
    }

    async function loadNextCommunityResult() {
        if (!state.communityItems.length || state.communityItemCursor >= state.communityItems.length) {
            state.hasMoreCommunityItems = false;
            return false;
        }

        const item = state.communityItems[state.communityItemCursor];
        state.communityItemCursor += 1;

        const result = state.communityResults.get(item.id) || await readJson(item.path);
        state.communityResults.set(result.id, result);
        state.activeResult = result;
        state.activeCommunity = result.generation?.site || item.site || state.activeCommunity;
        state.communityPosts.push(...result.posts.map(post => ({
            key: getPostKey(result.id, post.id),
            post,
            result,
        })));
        state.communityReferenceDate = getCommunityReferenceDate();
        state.hasMoreCommunityItems = state.communityItemCursor < state.communityItems.length;
        return true;
    }

    async function ensureCommunityPosts(targetCount) {
        while (state.communityPosts.length < targetCount && state.hasMoreCommunityItems) {
            await loadNextCommunityResult();
        }
    }

    async function maybeLoadMoreOnScroll() {
        const list = state.viewerModal?.querySelector('#crx-post-list');
        if (!list || state.boardDetailPostKey || state.isLoadingCommunity) {
            return;
        }

        const threshold = 80;
        if (list.scrollTop + list.clientHeight < list.scrollHeight - threshold) {
            return;
        }

        await renderMorePosts();
    }

    async function renderMorePosts() {
        if (!state.viewerModal || !state.activeCommunity || state.isLoadingCommunity) {
            return;
        }

        state.isLoadingCommunity = true;
        try {
            await ensureCommunityPosts(state.renderedCount + VIEW_PAGE_SIZE);
        } finally {
            state.isLoadingCommunity = false;
        }

        if (!state.viewerModal || !state.activeCommunity) {
            return;
        }
        const list = state.viewerModal.querySelector('#crx-post-list');
        if (!list) {
            return;
        }
        const renderer = getCommunityRenderer();
        if (renderer.viewType === 'board') {
            renderBoardList();
            queueViewportFill();
            return;
        }

        const posts = state.communityPosts.slice(state.renderedCount, state.renderedCount + VIEW_PAGE_SIZE);
        const html = posts.map(entry => renderer.renderPost(entry.post, entry.result, entry.key)).join('');
        list.insertAdjacentHTML('beforeend', html);
        state.renderedCount += posts.length;
        queueViewportFill();
    }

    function queueViewportFill() {
        requestAnimationFrame(() => {
            const list = state.viewerModal?.querySelector('#crx-post-list');
            if (!list || state.boardDetailPostKey || state.isLoadingCommunity) {
                return;
            }
            if (state.renderedCount >= state.communityPosts.length && !state.hasMoreCommunityItems) {
                return;
            }
            if (list.scrollHeight <= list.clientHeight + 8) {
                void renderMorePosts();
            }
        });
    }

    function renderBoardList(reset = false) {
        if (!state.viewerModal || !state.activeCommunity) {
            return;
        }

        const list = state.viewerModal.querySelector('#crx-post-list');
        if (reset) {
            list.innerHTML = '';
            state.renderedCount = 0;
        }

        const targetCount = reset && state.boardListRenderedCount
            ? state.boardListRenderedCount
            : state.renderedCount + VIEW_PAGE_SIZE;
        const posts = state.communityPosts.slice(state.renderedCount, targetCount);
        const renderer = getCommunityRenderer();
        const html = posts.map(entry => renderer.renderListItem(entry, state.communityReferenceDate)).join('');
        list.insertAdjacentHTML('beforeend', html);
        state.renderedCount += posts.length;
        if (reset) {
            requestAnimationFrame(() => {
                list.scrollTop = state.boardListScrollTop;
            });
        }
    }

    function renderBoardDetail() {
        if (!state.viewerModal || !state.activeCommunity) {
            return;
        }

        const entry = state.communityPosts.find(item => item.key === state.boardDetailPostKey);
        if (!entry) {
            state.boardDetailPostKey = null;
            renderBoardList(true);
            return;
        }

        state.viewerModal.querySelector('#crx-post-list').innerHTML = getCommunityRenderer().renderDetail(entry, state.communityReferenceDate);
    }

    async function deleteSelectedPosts() {
        if (!state.viewerModal) {
            return;
        }

        const selected = [...state.viewerModal.querySelectorAll('.crx-post-check input:checked')].map(input => parsePostKey(input.value));
        if (!selected.length) {
            toastr.warning('삭제할 게시글을 선택하세요.');
            return;
        }

        const selectedByResult = selected.reduce((map, item) => {
            if (!item.resultId || !item.postId) {
                return map;
            }
            if (!map.has(item.resultId)) {
                map.set(item.resultId, new Set());
            }
            map.get(item.resultId).add(item.postId);
            return map;
        }, new Map());

        for (const [resultId, postIds] of selectedByResult) {
            let result = state.communityResults.get(resultId);
            if (!result) {
                const item = state.activeIndex?.items.find(x => x.id === resultId);
                if (!item) {
                    continue;
                }
                result = await readJson(item.path);
            }
            result.posts = result.posts.filter(post => !postIds.has(post.id));
            await updateResult(result);
        }

        toastr.success('선택한 게시글을 삭제했습니다.');
        const chatPk = state.activeResult?.chat_pk || ensureChatPk(getContextSafe());
        const index = await loadIndex(chatPk);
        const firstItem = index.items.find(item => getItemViewKey(item) === state.activeViewKey) || index.items[0];
        if (!firstItem) {
            closeViewer();
            return;
        }
        const result = await readJson(firstItem.path);
        await openViewer(result, index, getItemViewKey(firstItem));
    }

    async function deleteCurrentCategoryFiles(index) {
        if (!state.activeResult && !state.activeIndex) {
            return;
        }

        const viewKey = state.activeViewKey;
        const targetItems = index.items.filter(item => getItemViewKey(item) === viewKey);
        if (!targetItems.length) {
            toastr.info('삭제할 항목이 없습니다.');
            return;
        }

        const label = getViewLabel(index, viewKey) || '현재 카테고리';
        const ok = await globalThis.SillyTavern?.getContext?.().Popup?.show?.confirm?.(`"${label}" 카테고리의 커뮤니티 반응을 모두 삭제할까요?`, '되돌릴 수 없습니다.');
        if (!ok) {
            return;
        }

        for (const item of targetItems) {
            await deleteFile(item.path);
        }
        const chatPk = state.activeResult?.chat_pk || state.activeIndex?.chat_pk;
        const latestIndex = await loadIndex(chatPk);
        latestIndex.items = latestIndex.items.filter(item => getItemViewKey(item) !== viewKey);
        await saveIndex(latestIndex);

        const nextItem = latestIndex.items[0];
        if (!nextItem) {
            closeViewer();
            toastr.success('현재 카테고리의 커뮤니티 반응을 모두 삭제했습니다.');
            return;
        }

        const result = await readJson(nextItem.path);
        toastr.success('현재 카테고리의 커뮤니티 반응을 모두 삭제했습니다.');
        await openViewer(result, latestIndex, getItemViewKey(nextItem));
    }

    function addWandMenuButton() {
        const menu = document.getElementById('extensionsMenu');
        if (!menu || document.getElementById('crx_wand_button')) {
            return Boolean(document.getElementById('crx_wand_button'));
        }

        let container = document.getElementById('crx_wand_container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'crx_wand_container';
            container.className = 'extension_container';
            menu.appendChild(container);
        }

        const button = document.createElement('div');
        button.id = 'crx_wand_button';
        button.className = 'list-group-item flex-container flexGap5';
        button.innerHTML = `
            <div class="fa-solid fa-comments extensionsMenuExtensionButton"></div>
            <span>커뮤니티 보기</span>
        `;
        button.addEventListener('click', () => void openComposer());
        container.appendChild(button);
        return true;
    }

    function waitForAppReady() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 120;

            const tick = () => {
                const context = getContextSafe();
                const hasMenu = Boolean(document.getElementById('extensionsMenu'));

                if (context && hasMenu) {
                    resolve(context);
                    return;
                }

                attempts += 1;
                if (attempts >= maxAttempts) {
                    console.warn(`[${MODULE_NAME}] SillyTavern context/menu was not ready before timeout.`);
                    resolve(null);
                    return;
                }

                setTimeout(tick, 500);
            };

            tick();
        });
    }

    async function boot() {
        await waitForAppReady();
        addWandMenuButton();
        try {
            await initializeStorage();
            await initializeTemplates();
            await initializePrompts();
            await initializePhone();
        } catch (error) {
            console.error(`[${MODULE_NAME}] Failed to initialize split modules. The menu button will retry on click.`, error);
        }
    }

    void boot();

    return {
        openComposer,
    };
})();
