(() => {
    'use strict';

    const registry = globalThis.CommunityReactionsPhoneModules;
    if (!registry?.registerApp) {
        throw new Error('CommunityReactionsPhoneModules registry is not available.');
    }

    const STATIC_APPS = Object.freeze([
        Object.freeze({ id: 'phoneCall', label: 'Phone', homeLabel: 'Phone', iconClass: 'crx-phone-call-icon', action: 'noop' }),
        Object.freeze({ id: 'iMessage', label: 'iMessage', homeLabel: 'iMessage', iconClass: 'crx-phone-message-icon', action: 'noop' }),
        Object.freeze({ id: 'appleMusic', label: 'Apple Music', homeLabel: 'Music', iconClass: 'crx-phone-music-icon', action: 'noop' }),
        Object.freeze({ id: 'setting', label: 'Setting', homeLabel: 'Setting', iconClass: 'crx-phone-setting-icon', action: 'wallpaperSettings' }),
        Object.freeze({ id: 'generate', label: '생성하기', homeLabel: '생성하기', iconClass: 'crx-phone-generate-icon', action: 'openGenerator' }),
    ]);

    for (const meta of STATIC_APPS) {
        registry.registerApp(function createStaticPhoneApp(context) {
            const {
                createDefaultHomeData,
                escapeHtml,
            } = context;

            function createEmptyData() {
                return {
                    app_id: meta.id,
                    app_label: meta.label,
                    app_home_label: meta.homeLabel,
                    home: createDefaultHomeData(),
                    is_static: true,
                };
            }

            function renderHomeIcon(app) {
                const iconClass = meta.iconClass || 'crx-phone-generic-icon';
                const actionAttribute = meta.action
                    ? `data-phone-action="${escapeHtml(meta.action)}"`
                    : `data-phone-app="${escapeHtml(app.app_id)}"`;
                return `
            <button class="crx-phone-app-icon" type="button" ${actionAttribute} aria-label="${escapeHtml(app.app_home_label)} 열기">
                <span class="crx-phone-app-icon-pic ${iconClass}" aria-hidden="true"></span>
                <span>${escapeHtml(app.app_home_label)}</span>
            </button>
        `;
            }

            function renderApp(app) {
                if (meta.action) {
                    return '';
                }
                return `
        <section class="crx-phone-app" data-phone-app="${escapeHtml(app.app_id)}">
            <div class="crx-phone-empty">아직 구현되지 않은 어플리케이션입니다.</div>
        </section>
    `;
            }

            return {
                id: meta.id,
                label: meta.label,
                homeLabel: meta.homeLabel,
                createEmptyData,
                hasContent: () => false,
                renderApp,
                renderHomeIcon,
            };
        });
    }
})();
