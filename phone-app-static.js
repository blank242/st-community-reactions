(() => {
    'use strict';

    const registry = globalThis.CommunityReactionsPhoneModules;
    if (!registry?.registerApp) {
        throw new Error('CommunityReactionsPhoneModules registry is not available.');
    }

    const STATIC_APPS = Object.freeze([
        Object.freeze({ id: 'phoneCall', label: 'Phone', homeLabel: 'Phone' }),
        Object.freeze({ id: 'iMessage', label: 'iMessage', homeLabel: 'iMessage' }),
        Object.freeze({ id: 'appleMusic', label: 'Apple Music', homeLabel: 'Music' }),
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

            function renderApp(app) {
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
            };
        });
    }
})();
