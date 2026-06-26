globalThis.CommunityReactionsPhoneHome = (() => {
    'use strict';

    function create(deps) {
        const {
            COUNTRY_PRESETS,
            escapeHtml,
            getInputCountryContext,
        } = deps;

        const PHONE_DOCK_APPS = Object.freeze([
            Object.freeze({ app_id: 'phoneCall', app_label: 'Phone', app_home_label: 'Phone' }),
            Object.freeze({ app_id: 'googleSearch', app_label: 'Safari', app_home_label: 'Safari' }),
            Object.freeze({ app_id: 'iMessage', app_label: 'iMessage', app_home_label: 'iMessage' }),
            Object.freeze({ app_id: 'appleMusic', app_label: 'Apple Music', app_home_label: 'Music' }),
        ]);
        const PHONE_DOCK_APP_IDS = Object.freeze(new Set(PHONE_DOCK_APPS.map(app => app.app_id)));
        const WEATHER_DEFAULTS = Object.freeze({
            korea: Object.freeze({ city: 'Seoul', temperature: 22, high: 24, low: 17, unit: 'C', condition: 'Partly Cloudy', weather_emoji: '🌤️' }),
            japan: Object.freeze({ city: 'Tokyo', temperature: 22, high: 25, low: 18, unit: 'C', condition: 'Partly Cloudy', weather_emoji: '🌤️' }),
            usa: Object.freeze({ city: 'San Francisco', temperature: 53, high: 56, low: 50, unit: 'F', condition: 'Partly Cloudy', weather_emoji: '🌤️' }),
            china: Object.freeze({ city: 'Shanghai', temperature: 23, high: 26, low: 19, unit: 'C', condition: 'Cloudy', weather_emoji: '☁️' }),
            global: Object.freeze({ city: 'Cupertino', temperature: 22, high: 24, low: 18, unit: 'C', condition: 'Partly Cloudy', weather_emoji: '🌤️' }),
            custom: Object.freeze({ city: 'Local City', temperature: 22, high: 24, low: 18, unit: 'C', condition: 'Partly Cloudy', weather_emoji: '🌤️' }),
        });

        function buildPhoneHomePromptRule(input, context) {
            const unit = context.countryContext?.isAmerican ? 'Fahrenheit' : 'Celsius';
            return `
Phone home screen structured data rules:
- Every phone-generation response must include a top-level "home" object with a "weather" object.
- Infer weather from the selected chat excerpt, character nationality/culture, setting, season, mood, and supplemental context.
- If the excerpt does not explicitly state city or weather, choose a plausible current city and weather for the character; never omit this object and never use null values.
- Use ${unit} temperatures for this character.
- "city" should be a concise iPhone Weather widget location.
- "temperature", "high", and "low" must be numbers without the degree symbol.
- "condition" and "details" should be short iPhone-style weather text.
- "temperature_details" must be short iPhone high/low text such as "H:24° L:17°".
- "emoji" should be one weather symbol matching the condition.
`.trim();
        }

        function normalizeHome(parsed, input = {}) {
            const rawHome = getRawHomePayload(parsed);
            const rawWeather = rawHome.weather || rawHome.weather_widget || rawHome.weatherWidget || parsed?.weather || parsed?.phone?.weather || {};
            return {
                weather: normalizeWeatherPayload(rawWeather, input),
            };
        }

        function getRawHomePayload(parsed) {
            const raw = parsed?.home || parsed?.phone?.home || parsed?.home_screen || parsed?.homeScreen || {};
            return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
        }

        function normalizeWeatherPayload(rawWeather, input = {}) {
            const source = rawWeather && typeof rawWeather === 'object' && !Array.isArray(rawWeather) ? rawWeather : {};
            const fallback = getDefaultWeather(input);
            const condition = String(source.condition || source.details || source.weather || source.summary || fallback.condition).trim() || fallback.condition;
            const temperature = normalizeTemperature(source.temperature ?? source.temp ?? source.current_temperature ?? source.currentTemperature, fallback.temperature);
            const high = normalizeTemperature(source.high ?? source.high_temperature ?? source.highTemperature, fallback.high);
            const low = normalizeTemperature(source.low ?? source.low_temperature ?? source.lowTemperature, fallback.low);
            const unit = normalizeWeatherUnit(source.unit || source.temperature_unit || source.temperatureUnit, fallback.unit);
            const details = String(source.details || source.condition || source.summary || fallback.condition).trim() || fallback.condition;
            return {
                city: String(source.city || source.location || source.place || fallback.city).trim().slice(0, 40) || fallback.city,
                temperature,
                high,
                low,
                unit,
                condition,
                details,
                weather_emoji: String(source.emoji || source.weather_emoji || source.icon || getWeatherEmoji(condition) || fallback.weather_emoji).trim() || fallback.weather_emoji,
                temperature_details: String(source.temperature_details || source.temperatureDetails || '').trim() || formatWeatherTemperatureDetails(high, low),
            };
        }

        function getDefaultWeather(input = {}) {
            const safeInput = input && typeof input === 'object' ? input : {};
            const countryContext = getInputCountryContext({
                site_country: safeInput.site_country || 'korea',
                custom_site_country: safeInput.custom_site_country || safeInput.site_country_label || '',
            });
            const base = WEATHER_DEFAULTS[countryContext.key] || (countryContext.isAmerican ? WEATHER_DEFAULTS.usa : WEATHER_DEFAULTS.korea);
            const city = countryContext.isCustom && countryContext.label && countryContext.label !== COUNTRY_PRESETS.custom?.label
                ? countryContext.label
                : base.city;
            return {
                ...base,
                city,
                unit: countryContext.isAmerican ? 'F' : base.unit,
            };
        }

        function normalizeTemperature(value, fallback) {
            const parsed = parseMoneyNumber(value);
            return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
        }

        function normalizeWeatherUnit(value, fallback) {
            const unit = String(value || '').trim().toUpperCase();
            if (unit === 'F' || unit === 'FAHRENHEIT') {
                return 'F';
            }
            if (unit === 'C' || unit === 'CELSIUS') {
                return 'C';
            }
            return fallback;
        }

        function formatWeatherTemperatureDetails(high, low) {
            return `H:${Math.round(high)}° L:${Math.round(low)}°`;
        }

        function getWeatherEmoji(condition) {
            const text = String(condition || '').toLowerCase();
            if (/(rain|shower|storm|thunder|비|소나기|폭우|뇌우)/i.test(text)) {
                return '🌧️';
            }
            if (/(snow|sleet|blizzard|눈|폭설)/i.test(text)) {
                return '❄️';
            }
            if (/(cloud|overcast|fog|mist|흐림|구름|안개)/i.test(text)) {
                return '☁️';
            }
            if (/(clear|sun|맑음|화창)/i.test(text)) {
                return '☀️';
            }
            return '🌤️';
        }

        function parseMoneyNumber(value) {
            if (typeof value === 'number') {
                return value;
            }

            const text = String(value ?? '').replace(/[^0-9.-]/g, '');
            if (!text) {
                return NaN;
            }
            return Number(text);
        }

        function renderHome(apps, options = {}) {
            const {
                createStaticAppData,
                renderHomeIcon,
            } = options;
            const home = getPhoneHomeData(apps);
            const weather = normalizeWeatherPayload(home.weather);
            const homeApps = apps.filter(app => !PHONE_DOCK_APP_IDS.has(app.app_id));
            return `
        <div class="crx-phone-home" aria-label="iPhone home screen">
            <div class="crx-phone-home-grid">
                <div class="crx-phone-widget">
                    <div class="crx-weather-widget">
                        <div class="crx-weather-widget-city">${escapeHtml(weather.city)}</div>
                        <div class="crx-weather-widget-temperature">${escapeHtml(weather.temperature)}°</div>
                        <div class="crx-weather-widget-details">${escapeHtml(weather.weather_emoji)}<br>${escapeHtml(weather.details)}<br>${escapeHtml(weather.temperature_details)}</div>
                    </div>
                    <span>Weather</span>
                </div>
                ${homeApps.map(app => renderHomeIcon(app)).join('')}
                ${renderSillyTavernHomeIcon()}
            </div>
            <div class="crx-phone-app-bar">
                ${PHONE_DOCK_APPS.map(dockApp => renderPhoneDockIcon(apps.find(app => app.app_id === dockApp.app_id) || createStaticAppData(dockApp))).join('')}
            </div>
        </div>
    `;
        }

        function getRenderableApps(apps, createStaticAppData) {
            const normalizedApps = (Array.isArray(apps) ? apps : []).filter(app => app?.app_id);
            const byId = new Map(normalizedApps.map(app => [app.app_id, app]));
            const dockApps = PHONE_DOCK_APPS.map(dockApp => byId.get(dockApp.app_id) || createStaticAppData(dockApp));
            const extraApps = normalizedApps.filter(app => !PHONE_DOCK_APP_IDS.has(app.app_id));
            return [...dockApps, ...extraApps];
        }

        function getPhoneHomeData(apps) {
            const list = Array.isArray(apps) ? apps : [];
            const generatedApps = list
                .filter(app => !app?.is_static && app?.home?.weather)
                .sort((a, b) => getHomeUpdatedAt(b) - getHomeUpdatedAt(a));
            if (generatedApps[0]?.home?.weather) {
                return generatedApps[0].home;
            }
            const fallbackHome = list.find(app => app?.home?.weather)?.home;
            return fallbackHome?.weather ? fallbackHome : createDefaultHomeData();
        }

        function getHomeUpdatedAt(app) {
            const candidates = [
                app?.home_updated_at,
                app?._home_updated_at,
                app?.home?.created_at,
                app?.home?.createdAt,
            ];
            for (const value of candidates) {
                if (typeof value === 'number' && Number.isFinite(value)) {
                    return value;
                }
                const parsed = Date.parse(value);
                if (Number.isFinite(parsed)) {
                    return parsed;
                }
            }
            return 0;
        }

        function createDefaultHomeData(input = {}) {
            return { weather: getDefaultWeather(input) };
        }

        function renderSillyTavernHomeIcon() {
            return `
            <button class="crx-phone-app-icon crx-phone-sillytavern-launcher" type="button" data-phone-action="close" aria-label="Return to SillyTavern">
                <span class="crx-phone-app-icon-pic crx-phone-sillytavern-icon" aria-hidden="true"></span>
                <span>SillyTavern</span>
            </button>
        `;
        }

        function renderPhoneDockIcon(app) {
            const iconClass = getPhoneDockIconClass(app.app_id);
            return `
            <button class="crx-phone-app-icon crx-phone-dock-icon" type="button" data-phone-app="${escapeHtml(app.app_id)}" aria-label="Open ${escapeHtml(app.app_home_label)}">
                <span class="crx-phone-app-icon-pic ${iconClass}" aria-hidden="true"></span>
            </button>
        `;
        }

        function getPhoneDockIconClass(appId) {
            if (appId === 'phoneCall') {
                return 'crx-phone-call-icon';
            }
            if (appId === 'googleSearch') {
                return 'crx-phone-safari-icon';
            }
            if (appId === 'iMessage') {
                return 'crx-phone-message-icon';
            }
            if (appId === 'appleMusic') {
                return 'crx-phone-music-icon';
            }
            return 'crx-phone-generic-icon';
        }


        return {
            buildPromptRule: buildPhoneHomePromptRule,
            createDefaultHomeData,
            dockApps: PHONE_DOCK_APPS,
            dockAppIds: PHONE_DOCK_APP_IDS,
            getRenderableApps,
            normalizeHome,
            renderHome,
        };
    }
    return { create };
})();
