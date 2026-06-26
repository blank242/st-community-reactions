(() => {
    'use strict';

    const registry = globalThis.CommunityReactionsPhoneModules;
    if (!registry?.registerApp) {
        throw new Error('CommunityReactionsPhoneModules registry is not available.');
    }

    registry.registerApp(function createSafariPhoneApp(context) {
        const {
            createDefaultHomeData,
            createId,
            escapeHtml,
            getPhoneAppPreset,
            getPhoneResultTime,
            normalizeHome,
            normalizeUrl,
            sanitizeId,
            sortPhoneResultsNewest,
        } = context;
        const normalizePhoneHome = normalizeHome;
        const createDefaultPhoneHomeData = createDefaultHomeData;
        const GOOGLE_RESULT_EDIT_ARIA_LABEL = "검색 결과 수정";
        const GOOGLE_RESULT_SELECT_ARIA_LABEL = "검색 결과 선택";
        const GOOGLE_HISTORY_DELETE_ARIA_LABEL = "검색 기록 삭제";
        const GOOGLE_DELETE_SELECTED_LABEL = "선택 삭제";
        const GOOGLE_DELETE_ALL_LABEL = "전체 삭제";

        function buildGoogleSearchPrompt(input, context) {
            const {
                app,
                countryLabel,
                languageLabel,
                supplementalRule,
                customPromptRule,
                homePromptRule,
                transcript,
            } = context;

            return `
You generate an in-universe iPhone application snapshot for a fictional character.

The selected chat excerpt is canon context from the character's world:
${transcript}

Application to generate: ${app.promptName}.
Character nationality/culture: ${countryLabel}.
Output language: ${languageLabel}.
Search query count: exactly ${input.post_count}, maximum 4.
${customPromptRule}
${supplementalRule}
${homePromptRule}

Google search history rules:
- Generate search queries that this character could realistically have typed on their phone based on the selected excerpt and surrounding context.
- A query can reveal private worries, practical needs, suspicions, health concerns, money concerns, relationship concerns, or mundane curiosity.
- Keep each query short enough to look like a real mobile Google search history item.
- For each query, generate 5 to 7 realistic Google search results.
- Search result titles, URLs, and snippets must feel like actual web results for the character's nationality and context.
- Do not include community posts, tweets, comments, reactions, markdown, icons, emoji, HTML, or CSS.

Rules:
- Return raw valid JSON only. Start with "{" and end with "}". Do not wrap the JSON in markdown code fences.
- Do not add any explanation before or after the JSON.
- Return compact minified JSON without pretty-print indentation.
- The top-level JSON must match this shape:
{
  "home": {
    "weather": {
      "city": "San Francisco",
      "temperature": 53,
      "high": 56,
      "low": 50,
      "unit": "F",
      "condition": "Partly Cloudy",
      "details": "Partly Cloudy",
      "temperature_details": "H:56° L:50°",
      "emoji": "🌤️"
    }
  },
  "searches": [
    {
      "id": "search_001",
      "query": "mobile search query",
      "results": [
        {
          "id": "result_001_001",
          "title": "search result title",
          "url": "https://example.com/path",
          "snippet": "search result snippet"
        }
      ]
    }
  ]
}
- Use stable unique ids: search_001, result_001_001.
- Do not include real usernames of private individuals.
`.trim();
        }

        function normalizeGooglePayload(parsed, input, app) {
            const rawSearches = Array.isArray(parsed?.searches)
                ? parsed.searches
                : Array.isArray(parsed?.phone?.searches) ? parsed.phone.searches : [];
            const searches = rawSearches
                .slice(0, app.maxSearches)
                .map((search, index) => normalizeGoogleSearch(search, index, app))
                .filter(Boolean);

            return {
                app_id: app.id,
                app_label: app.label,
                app_home_label: app.homeLabel,
                home: normalizePhoneHome(parsed, input),
                searches,
            };
        }

        function normalizeGoogleSearch(search, index, app) {
            if (!search || typeof search !== 'object') {
                return null;
            }

            const query = String(search.query || search.term || search.keyword || '').trim();
            if (!query) {
                return null;
            }

            const searchId = sanitizeId(search.id || `search_${String(index + 1).padStart(3, '0')}`, 'search');
            const rawResults = Array.isArray(search.results) ? search.results : [];
            const results = rawResults
                .slice(0, app.maxResults)
                .map((result, resultIndex) => normalizeGoogleResult(result, searchId, resultIndex, query))
                .filter(Boolean);

            if (!results.length) {
                return null;
            }

            return {
                id: searchId,
                query,
                results,
            };
        }

        function normalizeGoogleResult(result, searchId, index, query) {
            if (!result || typeof result !== 'object') {
                return null;
            }

            const title = String(result.title || result.name || '').trim();
            const snippet = String(result.snippet || result.description || result.content || '').trim();
            if (!title || !snippet) {
                return null;
            }

            const fallbackUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            return {
                id: sanitizeId(result.id || `${searchId}_result_${String(index + 1).padStart(3, '0')}`, 'result'),
                title,
                url: normalizeUrl(result.url || result.link || fallbackUrl),
                snippet,
            };
        }

        function renderGoogleSearchApp(app) {
            const searches = Array.isArray(app.searches) ? app.searches : [];
            return `
        <section class="crx-phone-app crx-phone-google-app" data-phone-app="googleSearch">
            <div class="crx-phone-google-history">
                <div class="crx-phone-google-historybar">
                    <button class="crx-phone-google-back" type="button" aria-label="검색 기록 닫기"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i></button>
                    <span class="crx-phone-google-cursor" aria-hidden="true"></span>
                </div>
                <div class="crx-phone-google-history-list">
                    ${searches.map(search => renderGoogleHistoryItem(search)).join('') || '<div class="crx-phone-empty">검색 기록이 없습니다.</div>'}
                </div>
            </div>
            <div class="crx-phone-google-results">
                ${searches.map((search, index) => renderGoogleResultsPage(search, index === 0)).join('')}
            </div>
        </section>
    `;
        }

        function renderGoogleHistoryItem(search) {
            const sourceResultId = search._source_result_id || '';
            const sourceSearchId = search._source_search_id || search.id || '';
            const sourceSearchIndex = search._source_search_index ?? '';
            return `
        <div class="crx-phone-google-history-item" data-search-id="${escapeHtml(search.id)}" data-source-result-id="${escapeHtml(sourceResultId)}" data-source-search-id="${escapeHtml(sourceSearchId)}" data-search-index="${escapeHtml(sourceSearchIndex)}">
            <button class="crx-phone-google-history-open" type="button" data-search-id="${escapeHtml(search.id)}">
                <i class="fa-regular fa-clock" aria-hidden="true"></i>
                <span>${escapeHtml(search.query)}</span>
            </button>
            <button class="crx-phone-google-history-delete" type="button" data-source-result-id="${escapeHtml(sourceResultId)}" data-search-id="${escapeHtml(sourceSearchId)}" data-search-index="${escapeHtml(sourceSearchIndex)}" aria-label="${escapeHtml(GOOGLE_HISTORY_DELETE_ARIA_LABEL)}">
                <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
        </div>
    `;
        }

        function renderGoogleResultsPage(search, isActive = false) {
            const sourceResultId = search._source_result_id || '';
            const sourceSearchId = search._source_search_id || search.id || '';
            const sourceSearchIndex = search._source_search_index ?? '';
            return `
        <article class="crx-phone-google-page${isActive ? ' is-active' : ''}" data-search-id="${escapeHtml(search.id)}" data-source-result-id="${escapeHtml(sourceResultId)}" data-source-search-id="${escapeHtml(sourceSearchId)}" data-search-index="${escapeHtml(sourceSearchIndex)}">
            <div class="crx-phone-google-top">
                <div class="crx-phone-google-logo" role="img" aria-label="Google"></div>
                <button class="crx-phone-google-menu" type="button" aria-label="메뉴" aria-pressed="false">
                    <i class="fa-solid fa-bars" id="crx-google-edit"></i>
                </button>
            </div>
            <button class="crx-phone-google-querybar" type="button" aria-label="검색 기록으로 돌아가기">
                <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                <span>${escapeHtml(search.query)}</span>
                <i class="fa-solid fa-microphone" aria-hidden="true"></i>
            </button>
            <div class="crx-phone-google-deletebar">
                <button class="crx-phone-google-delete-selected" type="button"><i class="fa-solid fa-trash" aria-hidden="true"></i><span>${escapeHtml(GOOGLE_DELETE_SELECTED_LABEL)}</span></button>
                <button class="crx-phone-google-delete-all" type="button" data-source-result-id="${escapeHtml(sourceResultId)}" data-search-id="${escapeHtml(sourceSearchId)}" data-search-index="${escapeHtml(sourceSearchIndex)}"><i class="fa-solid fa-folder-minus" aria-hidden="true"></i><span>${escapeHtml(GOOGLE_DELETE_ALL_LABEL)}</span></button>
            </div>
            <div class="crx-phone-google-tabs" aria-hidden="true">
                <span class="is-active">전체</span><span>이미지</span><span>동영상</span><span>뉴스</span><span>지도</span>
            </div>
            <div class="crx-phone-google-result-list">
                ${search.results.map((result, resultIndex) => renderGoogleResult(result, search, resultIndex)).join('')}
            </div>
        </article>
    `;
        }

        function renderGoogleResult(result, search = {}, resultIndex = 0) {
            const host = getDisplayHost(result.url);
            const sourceResultId = result._source_result_id || search._source_result_id || '';
            const sourceSearchId = result._source_search_id || search._source_search_id || search.id || '';
            const sourceSearchIndex = result._source_search_index ?? search._source_search_index ?? '';
            const sourceGoogleResultId = result._source_google_result_id || result.id || '';
            const sourceGoogleResultIndex = result._source_google_result_index ?? resultIndex;
            return `
        <div class="crx-phone-google-result" rel="noreferrer" data-source-result-id="${escapeHtml(sourceResultId)}" data-search-id="${escapeHtml(sourceSearchId)}" data-google-result-id="${escapeHtml(sourceGoogleResultId)}" data-search-index="${escapeHtml(sourceSearchIndex)}" data-google-result-index="${escapeHtml(sourceGoogleResultIndex)}">
            <label class="crx-phone-google-result-check"><input type="checkbox" data-source-result-id="${escapeHtml(sourceResultId)}" data-search-id="${escapeHtml(sourceSearchId)}" data-google-result-id="${escapeHtml(sourceGoogleResultId)}" data-search-index="${escapeHtml(sourceSearchIndex)}" data-google-result-index="${escapeHtml(sourceGoogleResultIndex)}" aria-label="${escapeHtml(GOOGLE_RESULT_SELECT_ARIA_LABEL)}"></label>
            <button class="crx-phone-google-result-edit" type="button" data-source-result-id="${escapeHtml(sourceResultId)}" data-search-id="${escapeHtml(sourceSearchId)}" data-google-result-id="${escapeHtml(sourceGoogleResultId)}" data-search-index="${escapeHtml(sourceSearchIndex)}" data-google-result-index="${escapeHtml(sourceGoogleResultIndex)}" aria-label="${escapeHtml(GOOGLE_RESULT_EDIT_ARIA_LABEL)}"><i class="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i></button>
            <span class="crx-phone-google-result-host">${escapeHtml(host)}</span>
            <span class="crx-phone-google-result-title">${escapeHtml(result.title)}</span>
            <span class="crx-phone-google-result-snippet">${escapeHtml(result.snippet)}</span>
        </div>
    `;
        }

        function getDisplayHost(url) {
            try {
                const parsed = new URL(url);
                return parsed.hostname.replace(/^www\./, '');
            } catch {
                return String(url || '').replace(/^https?:\/\//, '').split('/')[0] || 'google.com';
            }
        }

        function createEmptyData(appId = 'googleSearch') {
            const app = getPhoneAppPreset(appId);
            return {
                app_id: app.id,
                app_label: app.label,
                app_home_label: app.homeLabel,
                home: createDefaultPhoneHomeData(),
                searches: [],
            };
        }

        function createEmptyPhoneAppData(appId = 'googleSearch') {
            return createEmptyData(appId);
        }

        function renderHomeIcon(app) {
            return `
            <button class="crx-phone-app-icon" type="button" data-phone-app="${escapeHtml(app.app_id)}"${renderPhoneBadgeAttribute(app.notification_badge)} aria-label="${escapeHtml(app.app_home_label)} 열기">
                <span class="crx-phone-app-icon-pic crx-phone-safari-icon" aria-hidden="true"></span>
                <span>${escapeHtml(app.app_home_label)}</span>
            </button>
        `;
        }

        function renderPhoneBadgeAttribute(value) {
            const count = Math.floor(Number(value || 0));
            return Number.isFinite(count) && count > 0 ? ' data-phone-badge="' + escapeHtml(count) + '"' : '';
        }

        function mergePhoneSearches(results, appId = 'googleSearch', maxSearches = 48) {
            const data = createEmptyPhoneAppData(appId);
            const sortedResults = sortPhoneResultsNewest(results);
            const latestHomeResult = sortedResults.find(result => result?.phone?.home);
            if (latestHomeResult?.phone?.home?.weather) {
                data.home = latestHomeResult.phone.home;
                data.home_updated_at = getPhoneResultTime(latestHomeResult);
            }
            const seen = new Set();
            for (const result of sortedResults) {
                const searches = Array.isArray(result?.phone?.searches) ? result.phone.searches : [];
                const sourceId = getSearchSourceId(result);
                for (const [searchIndex, search] of searches.entries()) {
                    const key = `${sourceId}::${search?.id || searchIndex}`;
                    if (!search?.query || seen.has(key)) {
                        continue;
                    }
                    seen.add(key);
                    data.searches.push(withUniqueSearchIds(search, sourceId, searchIndex, result));
                    if (data.searches.length >= maxSearches) {
                        return data;
                    }
                }
            }
            return data;
        }

        function getSearchSourceId(result) {
            return sanitizeId(
                result?._source_item_id
                    || result?.id
                    || result?.generation?.id
                    || result?._source_item_path
                    || createId('phone_search_file'),
                'phone_search_file',
            );
        }

        function withUniqueSearchIds(search, sourceId, searchIndex, sourceResult = null) {
            const originalSearchId = sanitizeId(search.id || `search_${String(searchIndex + 1).padStart(3, '0')}`, 'search');
            const sourceResultId = sourceResult?.id || sourceResult?._source_item_id || sourceId || '';
            const searchId = sanitizeId(`${sourceId}_${originalSearchId}`, 'search');
            const results = Array.isArray(search.results)
                ? search.results.map((result, resultIndex) => {
                    const originalResultId = sanitizeId(result.id || `result_${String(resultIndex + 1).padStart(3, '0')}`, 'result');
                    return {
                        ...result,
                        id: sanitizeId(`${searchId}_${originalResultId}`, 'result'),
                        _source_result_id: sourceResultId,
                        _source_search_id: originalSearchId,
                        _source_search_index: searchIndex,
                        _source_google_result_id: originalResultId,
                        _source_google_result_index: resultIndex,
                    };
                })
                : [];

            return {
                ...search,
                id: searchId,
                _source_result_id: sourceResultId,
                _source_search_id: originalSearchId,
                _source_search_index: searchIndex,
                results,
            };
        }

        function hasContent(app) {
            return Array.isArray(app?.searches) && app.searches.length > 0;
        }

        return {
            id: 'googleSearch',
            label: 'Safari',
            homeLabel: 'Safari',
            promptName: 'Google search history and search results',
            buildPrompt: buildGoogleSearchPrompt,
            createEmptyData,
            hasContent,
            mergeResults: mergePhoneSearches,
            normalizePayload(parsed, input) {
                return normalizeGooglePayload(parsed, input, getPhoneAppPreset(input.phone_app_id || input.site || 'googleSearch'));
            },
            renderApp: renderGoogleSearchApp,
            renderHomeIcon,
        };
    });
})();
