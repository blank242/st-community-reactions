globalThis.CommunityReactionsPhoneModules = (() => {
    'use strict';

    const appFactories = [];

    function registerApp(factory) {
        if (typeof factory !== 'function') {
            throw new Error('Phone app module factory must be a function.');
        }
        appFactories.push(factory);
    }

    function getAppFactories() {
        return appFactories.slice();
    }

    return {
        registerApp,
        getAppFactories,
    };
})();
