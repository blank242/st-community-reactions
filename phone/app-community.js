(() => {
    'use strict';

    const registry = globalThis.CommunityReactionsPhoneModules;
    if (!registry?.registerApp) {
        throw new Error('CommunityReactionsPhoneModules registry is not available.');
    }

    const COMMUNITY_APPS = Object.freeze([
        Object.freeze({
            id: 'communityDaumCafe',
            appKey: 'daumCafe',
            label: '다음카페',
            iconClass: 'is-daum-cafe',
        }),
        Object.freeze({
            id: 'communityTwitter',
            appKey: 'twitter',
            label: 'Twitter',
            iconClass: 'is-twitter',
        }),
        Object.freeze({
            id: 'communityEverytime',
            appKey: 'everytime',
            label: '에브리타임',
            iconClass: 'is-everytime',
        }),
        Object.freeze({
            id: 'communityWebNovelReview',
            appKey: 'webNovelReview',
            label: '리디북스',
            iconClass: 'is-ridibooks',
        }),
    ]);

    for (const meta of COMMUNITY_APPS) {
        registry.registerApp(function createCommunityPhoneApp(context) {
            const {
                createDefaultHomeData,
                escapeHtml,
            } = context;

            function createEmptyData() {
                return {
                    app_id: meta.id,
                    app_label: meta.label,
                    app_home_label: meta.label,
                    community_app_key: meta.appKey,
                    community_category_count: 0,
                    community_post_count: 0,
                    home: createDefaultHomeData(),
                    is_static: true,
                };
            }

            function renderHomeIcon(app) {
                const label = app?.app_home_label || meta.label;
                return `
            <button class="crx-phone-app-icon" type="button" data-phone-app="${escapeHtml(meta.id)}" data-phone-action="openCommunityApp" data-crx-community-app="${escapeHtml(meta.appKey)}" aria-label="${escapeHtml(label)} 열기">
                <span class="crx-phone-app-icon-pic crx-phone-community-icon ${escapeHtml(meta.iconClass)}" aria-hidden="true"></span>
                <span>${escapeHtml(label)}</span>
            </button>
        `;
            }

            function renderApp(app) {
                const label = app?.app_label || meta.label;
                return `
        <section class="crx-phone-app crx-phone-community-app" data-phone-app="${escapeHtml(meta.id)}" data-crx-community-app="${escapeHtml(meta.appKey)}" data-crx-community-label="${escapeHtml(label)}">
            <div class="crx-phone-community-placeholder">
                <span>${escapeHtml(label)}</span>
            </div>
        </section>
    `;
            }

            return {
                id: meta.id,
                label: meta.label,
                homeLabel: meta.label,
                createEmptyData,
                hasContent: () => false,
                renderApp,
                renderHomeIcon,
            };
        });
    }
})();
