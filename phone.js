globalThis.CommunityReactionsPhone = (() => {
    'use strict';

    function create(deps) {
        const {
            COUNTRY_PRESETS,
            LANGUAGE_PRESETS,
            PHONE_APP_PRESETS,
            createId,
            escapeHtml,
            getCountryContext,
            sanitizeId,
        } = deps;

        const registry = globalThis.CommunityReactionsPhoneModules;
        const homeFactory = globalThis.CommunityReactionsPhoneHome?.create;
        if (!registry?.getAppFactories) {
            throw new Error('CommunityReactionsPhoneModules registry is not available.');
        }
        if (typeof homeFactory !== 'function') {
            throw new Error('CommunityReactionsPhoneHome.create is not available.');
        }

        let appModulesById = new Map();
        const home = homeFactory({
            COUNTRY_PRESETS,
            escapeHtml,
            getInputCountryContext,
        });
        const appContext = {
            COUNTRY_PRESETS,
            LANGUAGE_PRESETS,
            PHONE_APP_PRESETS,
            createDefaultHomeData: home.createDefaultHomeData,
            createId,
            escapeHtml,
            getInputCountryContext,
            getPhoneAppPreset,
            normalizeHome: home.normalizeHome,
            normalizeUrl,
            sanitizeId,
            sortPhoneResultsNewest,
        };
        const appModules = registry.getAppFactories()
            .map(factory => factory(appContext))
            .filter(app => app?.id);
        appModulesById = new Map(appModules.map(app => [app.id, app]));

        function getPhoneAppPreset(appId = 'googleSearch') {
            const known = PHONE_APP_PRESETS[appId];
            if (known) {
                return known;
            }
            const app = appModulesById.get(appId);
            if (app) {
                return {
                    id: app.id,
                    label: app.label || app.id,
                    homeLabel: app.homeLabel || app.label || app.id,
                    promptName: app.promptName || app.label || app.id,
                    maxResults: app.maxResults || 0,
                    maxSearches: app.maxSearches || 0,
                    maxTransactions: app.maxTransactions || 0,
                };
            }
            return PHONE_APP_PRESETS.googleSearch;
        }

        function getInputCountryContext(input) {
            if (typeof getCountryContext === 'function') {
                return getCountryContext(input.site_country, input.custom_site_country);
            }

            const country = COUNTRY_PRESETS[input.site_country];
            const customLabel = String(input.custom_site_country || '').trim();
            const label = input.site_country === 'custom'
                ? customLabel || country?.label || '직접 입력'
                : country?.label || input.site_country;
            return {
                key: input.site_country,
                label,
                language: country?.language || '',
                languageLabel: country?.language ? LANGUAGE_PRESETS[country.language] || country.language : '',
                isCustom: input.site_country === 'custom',
                isAmerican: input.site_country === 'usa' || /(미국|미합중국|usa|u\.s\.a|united states|american)/i.test(customLabel),
            };
        }

        function getAppModule(appId, useFallback = true) {
            const app = appModulesById.get(appId);
            if (app || !useFallback) {
                return app || null;
            }
            return appModulesById.get('googleSearch') || null;
        }

        function getPromptContext(input, transcript, supplementalContext = '') {
            const appModule = getAppModule(input.phone_app_id || input.site || 'googleSearch');
            const app = getPhoneAppPreset(appModule?.id || 'googleSearch');
            const countryContext = getInputCountryContext(input);
            const selectedCountry = COUNTRY_PRESETS[input.selected_site_country];
            const countryLabel = input.site_country_label || countryContext.label;
            const selectedCountryLabel = input.selected_site_country === 'custom'
                ? countryLabel
                : selectedCountry?.label || countryLabel;
            const languageLabel = LANGUAGE_PRESETS[input.output_language] || input.output_language;
            const countryLanguage = input.site_country_language || countryContext.language;
            const needsTranslation = countryLanguage
                ? countryLanguage !== input.output_language
                : Boolean(countryContext.isCustom && countryLabel);
            const supplementalRule = supplementalContext
                ? `
Additional context selected by the user:
${supplementalContext}
Use this only as background context. The selected chat excerpt remains the main source.`
                : '';
            const customPromptRule = input.custom_prompt
                ? `
Additional user direction:
${input.custom_prompt}
Follow it when it does not conflict with the JSON schema.`
                : '';

            return {
                app,
                appModule,
                countryLabel,
                countryContext,
                selectedCountryLabel,
                languageLabel,
                needsTranslation,
                supplementalRule,
                customPromptRule,
                homePromptRule: home.buildPromptRule(input, { countryLabel, countryContext, languageLabel }),
                transcript,
            };
        }

        function buildPhoneGenerationPrompt(input, transcript, supplementalContext = '') {
            let context = getPromptContext(input, transcript, supplementalContext);
            if (!context.appModule?.buildPrompt) {
                const fallbackModule = getAppModule('googleSearch');
                context = {
                    ...context,
                    app: getPhoneAppPreset(fallbackModule?.id || 'googleSearch'),
                    appModule: fallbackModule,
                };
            }
            return context.appModule.buildPrompt(input, context);
        }

        function normalizePhonePayload(parsed, input) {
            const appModule = getAppModule(input.phone_app_id || input.site || 'googleSearch');
            const normalizer = appModule?.normalizePayload || getAppModule('googleSearch')?.normalizePayload;
            return normalizer(parsed, input);
        }

        function buildPhoneViewerHtml(viewState) {
            const apps = Array.isArray(viewState?.apps) ? viewState.apps : [];
            const renderApps = home.getRenderableApps(apps, createStaticPhoneAppData);
            const activeAppId = viewState?.activeAppId || renderApps[0]?.app_id || 'googleSearch';
            const clock = formatPhoneStatusTime(new Date());

            return `
        <div class="crx-popup crx-phone-viewer is-phone-mode">
            <div class="crx-phone-device" data-active-app="${escapeHtml(activeAppId)}">
                <div class="crx-phone-status" aria-hidden="true">
                    <span>${escapeHtml(clock)}</span>
                    <span class="crx-phone-dynamic-island"></span>
                    <span><i class="fa-solid fa-signal"></i><i class="fa-solid fa-wifi"></i><i class="fa-solid fa-battery-three-quarters"></i></span>
                </div>
                <div class="crx-phone-screen">
                    ${home.renderHome(renderApps, { createStaticAppData: createStaticPhoneAppData, renderHomeIcon })}
                    <div class="crx-phone-app-stack">
                        ${renderApps.map(app => renderPhoneApp(app)).join('')}
                    </div>
                </div>
                <button id="crx-phone-homebar" class="crx-phone-homebar" type="button" aria-label="홈 화면으로"></button>
            </div>
        </div>
    `;
        }

        function formatPhoneStatusTime(date) {
            return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
        }

        function createStaticPhoneAppData(dockApp) {
            const appId = typeof dockApp === 'string' ? dockApp : dockApp?.app_id;
            const data = createEmptyPhoneAppData(appId);
            return {
                ...data,
                app_id: appId,
                app_label: dockApp?.app_label || data.app_label,
                app_home_label: dockApp?.app_home_label || data.app_home_label,
                home: data.home || home.createDefaultHomeData(),
                is_static: true,
            };
        }

        function renderHomeIcon(app) {
            const appModule = getAppModule(app.app_id, false);
            if (appModule?.renderHomeIcon) {
                return appModule.renderHomeIcon(app);
            }
            return renderGenericHomeIcon(app);
        }

        function renderGenericHomeIcon(app) {
            return `
            <button class="crx-phone-app-icon" type="button" data-phone-app="${escapeHtml(app.app_id)}" aria-label="${escapeHtml(app.app_home_label)} 열기">
                <span class="crx-phone-app-icon-pic crx-phone-generic-icon" aria-hidden="true"><i class="fa-solid fa-mobile-screen"></i></span>
                <span>${escapeHtml(app.app_home_label)}</span>
            </button>
        `;
        }

        function renderPhoneApp(app) {
            const appModule = getAppModule(app.app_id, false);
            return appModule?.renderApp ? appModule.renderApp(app) : renderGenericPhoneApp(app);
        }

        function renderGenericPhoneApp(app) {
            return `
        <section class="crx-phone-app" data-phone-app="${escapeHtml(app.app_id)}">
            <div class="crx-phone-empty">아직 구현되지 않은 어플리케이션입니다.</div>
        </section>
    `;
        }

        function createEmptyPhoneAppData(appId = 'googleSearch') {
            const appModule = getAppModule(appId, false) || getAppModule('googleSearch');
            if (appModule?.createEmptyData) {
                return appModule.createEmptyData(appId);
            }
            const app = getPhoneAppPreset(appId);
            return {
                app_id: app.id,
                app_label: app.label,
                app_home_label: app.homeLabel,
                home: home.createDefaultHomeData(),
            };
        }

        function mergePhoneResults(results, appId = 'googleSearch') {
            const appModule = getAppModule(appId);
            return appModule?.mergeResults ? appModule.mergeResults(results, appId) : createEmptyPhoneAppData(appId);
        }

        function mergePhoneSearches(results, appId = 'googleSearch') {
            return getAppModule('googleSearch')?.mergeResults(results, appId) || createEmptyPhoneAppData(appId);
        }

        function renderPaymentTransactionBatch(transactions) {
            return getAppModule('paymentHistory', false)?.renderPaymentTransactionBatch(transactions) || '';
        }

        function hasPhoneAppContent(app) {
            const appModule = getAppModule(app?.app_id, false);
            return Boolean(appModule?.hasContent?.(app));
        }

        function sortPhoneResultsNewest(results) {
            return (Array.isArray(results) ? results : [])
                .filter(Boolean)
                .slice()
                .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
        }

        function normalizeUrl(value) {
            const text = String(value || '').trim();
            if (/^https?:\/\//i.test(text)) {
                return text;
            }
            if (!text) {
                return 'https://www.google.com/';
            }
            return `https://${text.replace(/^\/+/, '')}`;
        }

        return {
            buildPhoneGenerationPrompt,
            buildPhoneViewerHtml,
            createEmptyPhoneAppData,
            hasPhoneAppContent,
            mergePhoneResults,
            mergePhoneSearches,
            normalizePhonePayload,
            renderPaymentTransactionBatch,
        };
    }

    return { create };
})();
