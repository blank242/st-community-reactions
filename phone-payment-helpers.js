globalThis.CommunityReactionsPhonePayment = (() => {
    'use strict';

    function create(context) {
        const {
            createDefaultHomeData,
            getPhoneAppPreset,
            normalizeHome,
            sanitizeId,
        } = context;
        const normalizePhoneHome = normalizeHome;
        const createDefaultPhoneHomeData = createDefaultHomeData;

        const PAYMENT_PAGE_SIZE = 10;
        const PAYMENT_CURRENCIES = Object.freeze({
            korea: { code: 'KRW', symbol: '₩', fractionDigits: 0 },
            japan: { code: 'JPY', symbol: '¥', fractionDigits: 0 },
            usa: { code: 'USD', symbol: '$', fractionDigits: 2 },
            china: { code: 'CNY', symbol: '¥', fractionDigits: 2 },
            global: { code: 'USD', symbol: '$', fractionDigits: 2 },
            custom: { code: 'LOCAL', symbol: '', fractionDigits: 0 },
        });
        const PAYMENT_BANKS = Object.freeze({
            bankOfAmerica: { label: 'Bank of America', shortLabel: 'BofA' },
            kbKookmin: { label: 'KB국민은행', shortLabel: 'KB' },
        });

        function normalizePaymentPayload(parsed, input, app) {
            const raw = getRawPaymentPayload(parsed);
            const bankTheme = getPaymentBankTheme(input);
            const currency = getPaymentCurrency(input, raw);
            const transactions = getRawPaymentTransactions(raw)
                .slice(0, app.maxTransactions)
                .map((transaction, index) => normalizePaymentTransaction(transaction, index, input, currency))
                .filter(Boolean)
                .sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)));

            return {
                app_id: app.id,
                app_label: app.label,
                app_home_label: app.homeLabel,
                home: normalizePhoneHome(parsed, input),
                payment: {
                    bank_theme: bankTheme,
                    bank_label: PAYMENT_BANKS[bankTheme].label,
                    character_name: getPaymentCharacterName(input, raw),
                    currency_code: currency.code,
                    currency_symbol: currency.symbol,
                    total_assets: normalizeMoney(raw.total_assets || raw.totalAssets || raw.assets, currency, 0),
                    monthly_card_total: normalizeMoney(raw.monthly_card_total || raw.monthlyCardTotal || raw.card_total || raw.credit_card_total, currency, 0),
                    has_translation: transactions.some(transaction => Boolean(transaction.description_translation || transaction.detail_note_translation)),
                    transactions,
                },
            };
        }

        function getPaymentCharacterName(input, raw = {}) {
            return String(
                raw.character_name
                || raw.characterName
                || raw.owner_name
                || raw.ownerName
                || raw.account_holder
                || raw.accountHolder
                || input?.character_name
                || input?.characterName
                || '',
            ).trim();
        }

        function getRawPaymentPayload(parsed) {
            const raw = parsed?.payment || parsed?.phone?.payment || parsed?.banking || parsed?.payments || parsed;
            return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
        }

        function getRawPaymentTransactions(raw) {
            if (Array.isArray(raw.transactions)) {
                return raw.transactions;
            }
            if (Array.isArray(raw.card_transactions)) {
                return raw.card_transactions;
            }
            if (Array.isArray(raw.credit_card_transactions)) {
                return raw.credit_card_transactions;
            }
            return [];
        }

        function normalizePaymentTransaction(transaction, index, input, currency) {
            if (!transaction || typeof transaction !== 'object') {
                return null;
            }

            const description = String(transaction.description || transaction.merchant || transaction.title || transaction.content || '').trim();
            if (!description) {
                return null;
            }

            const rawAmount = parseMoneyNumber(transaction.amount ?? transaction.value ?? transaction.price ?? transaction.display_amount);
            const amount = Number.isFinite(rawAmount) && rawAmount !== 0 ? (rawAmount > 0 ? -rawAmount : rawAmount) : 0;
            const occurredAt = normalizePaymentDate(transaction.occurred_at || transaction.created_at || transaction.time || transaction.date, index);
            const translation = String(transaction.description_translation || transaction.translation || transaction.translated_description || '').trim();
            const detailNote = String(transaction.detail_note || transaction.detail || transaction.memo || transaction.note || transaction.reason || '').trim();
            const detailNoteTranslation = String(transaction.detail_note_translation || transaction.detail_translation || transaction.memo_translation || transaction.note_translation || '').trim();

            return {
                id: sanitizeId(transaction.id || `payment_${String(index + 1).padStart(3, '0')}`, 'payment'),
                description,
                description_translation: translation,
                detail_note: detailNote,
                detail_note_translation: detailNoteTranslation,
                amount,
                display_amount: normalizeMoneyDisplay(transaction.display_amount || transaction.display, amount, currency),
                occurred_at: occurredAt,
                time_label: String(transaction.time_label || transaction.label || '').trim() || formatPaymentTime(occurredAt, input),
            };
        }

        function normalizePaymentDate(value, index) {
            const date = new Date(value);
            if (!Number.isNaN(date.getTime())) {
                return date.toISOString();
            }
            return new Date(Date.now() - (index + 1) * 60 * 60 * 1000).toISOString();
        }

        function formatPaymentTime(value, input) {
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) {
                return '';
            }
            const time = [
                date.getHours(),
                date.getMinutes(),
                date.getSeconds(),
            ].map(padDatePart).join(':');
            if (isAmericanCountryInput(input)) {
                return `${padDatePart(date.getDate())} ${getEnglishMonth(date)} ${time}`;
            }
            return `${padDatePart(date.getMonth() + 1)}.${padDatePart(date.getDate())} ${time}`;
        }

        function getEnglishMonth(date) {
            return ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][date.getMonth()];
        }

        function padDatePart(value) {
            return String(value).padStart(2, '0');
        }

        function normalizeMoney(value, currency, fallbackAmount = 0) {
            const source = value && typeof value === 'object' && !Array.isArray(value)
                ? value
                : { amount: value };
            const amount = parseMoneyNumber(source.amount ?? source.value ?? source.total ?? source.display);
            const normalizedAmount = Number.isFinite(amount) ? amount : fallbackAmount;
            const display = normalizeMoneyDisplay(source.display || source.text || source.formatted, normalizedAmount, currency);
            return {
                amount: normalizedAmount,
                display,
            };
        }

        function normalizeMoneyDisplay(value, amount, currency) {
            const display = String(value || '').trim();
            if (usesPlainWonDisplay(currency)) {
                return formatMoney(amount, currency);
            }
            return display || formatMoney(amount, currency);
        }

        function usesPlainWonDisplay(currency) {
            return String(currency?.code || '').toUpperCase() === 'KRW';
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

        function formatMoney(amount, currency) {
            const number = Number.isFinite(amount) ? amount : 0;
            const sign = number < 0 ? '-' : '';
            const formatted = Math.abs(number).toLocaleString('en-US', {
                minimumFractionDigits: currency.fractionDigits,
                maximumFractionDigits: currency.fractionDigits,
            });
            return usesPlainWonDisplay(currency) ? `${sign}${formatted}` : `${sign}${currency.symbol}${formatted}`;
        }

        function getPaymentCurrency(input, raw = null) {
            const countryKey = typeof input === 'string' ? input : input?.site_country;
            const rawCurrency = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
            const inferred = inferCustomPaymentCurrency(typeof input === 'string' ? '' : input?.custom_site_country || input?.site_country_label || '');
            const base = countryKey === 'custom'
                ? inferred || PAYMENT_CURRENCIES.custom
                : PAYMENT_CURRENCIES[countryKey] || PAYMENT_CURRENCIES.korea;
            const code = String(rawCurrency.currency_code || rawCurrency.currencyCode || base.code || '').trim() || base.code;
            const symbol = String(rawCurrency.currency_symbol || rawCurrency.currencySymbol || base.symbol || '').trim();
            const fractionDigits = normalizeFractionDigits(rawCurrency.currency_fraction_digits ?? rawCurrency.currencyFractionDigits, base.fractionDigits);
            return { code, symbol, fractionDigits };
        }

        function getPaymentBankTheme(input) {
            return isAmericanCountryInput(input) ? 'bankOfAmerica' : 'kbKookmin';
        }

        function isAmericanCountryInput(input) {
            if (typeof input === 'string') {
                return input === 'usa';
            }
            if (input?.is_american_country || input?.site_country === 'usa') {
                return true;
            }
            return input?.site_country === 'custom' && /(미국|미합중국|usa|u\.s\.a|united states|american)/i.test(String(input.custom_site_country || input.site_country_label || ''));
        }

        function normalizeFractionDigits(value, fallback = 0) {
            const number = Number(value);
            if (!Number.isFinite(number)) {
                return fallback;
            }
            return Math.max(0, Math.min(4, Math.round(number)));
        }

        function inferCustomPaymentCurrency(customCountry) {
            const text = String(customCountry || '').trim().toLowerCase();
            if (!text) {
                return null;
            }
            if (/(미국|미합중국|usa|u\.s\.a|united states|american)/i.test(text)) {
                return PAYMENT_CURRENCIES.usa;
            }
            if (/(한국|대한민국|korea)/i.test(text)) {
                return PAYMENT_CURRENCIES.korea;
            }
            if (/(일본|japan)/i.test(text)) {
                return PAYMENT_CURRENCIES.japan;
            }
            if (/(중국|china)/i.test(text)) {
                return PAYMENT_CURRENCIES.china;
            }
            if (/(프랑스|독일|스페인|이탈리아|네덜란드|아일랜드|포르투갈|벨기에|오스트리아|핀란드|그리스|euro|france|germany|spain|italy|netherlands|ireland|portugal|belgium|austria|finland|greece)/i.test(text)) {
                return { code: 'EUR', symbol: '€', fractionDigits: 2 };
            }
            if (/(영국|uk|u\.k|britain|england|scotland|wales)/i.test(text)) {
                return { code: 'GBP', symbol: '£', fractionDigits: 2 };
            }
            if (/(캐나다|canada)/i.test(text)) {
                return { code: 'CAD', symbol: '$', fractionDigits: 2 };
            }
            if (/(호주|australia)/i.test(text)) {
                return { code: 'AUD', symbol: '$', fractionDigits: 2 };
            }
            if (/(브라질|brazil)/i.test(text)) {
                return { code: 'BRL', symbol: 'R$', fractionDigits: 2 };
            }
            if (/(멕시코|mexico)/i.test(text)) {
                return { code: 'MXN', symbol: '$', fractionDigits: 2 };
            }
            if (/(인도|india)/i.test(text)) {
                return { code: 'INR', symbol: '₹', fractionDigits: 2 };
            }
            if (/(싱가포르|singapore)/i.test(text)) {
                return { code: 'SGD', symbol: '$', fractionDigits: 2 };
            }
            if (/(대만|taiwan)/i.test(text)) {
                return { code: 'TWD', symbol: 'NT$', fractionDigits: 0 };
            }
            if (/(홍콩|hong kong)/i.test(text)) {
                return { code: 'HKD', symbol: 'HK$', fractionDigits: 2 };
            }
            return null;
        }

        function createEmptyPaymentData(app = getPhoneAppPreset('paymentHistory')) {
            return {
                app_id: app.id,
                app_label: app.label,
                app_home_label: app.homeLabel,
                home: createDefaultPhoneHomeData(),
                payment: {
                    bank_theme: 'kbKookmin',
                    bank_label: PAYMENT_BANKS.kbKookmin.label,
                    character_name: '',
                    currency_code: 'KRW',
                    currency_symbol: '₩',
                    total_assets: { amount: 0, display: '0' },
                    monthly_card_total: { amount: 0, display: '0' },
                    has_translation: false,
                    transactions: [],
                },
            };
        }

        return {
            PAYMENT_BANKS,
            PAYMENT_CURRENCIES,
            PAYMENT_PAGE_SIZE,
            createEmptyPaymentData,
            formatMoney,
            getPaymentBankTheme,
            getPaymentCurrency,
            normalizePaymentPayload,
        };
    }

    return { create };
})();
