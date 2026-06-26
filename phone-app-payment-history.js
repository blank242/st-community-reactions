(() => {
    'use strict';

    const registry = globalThis.CommunityReactionsPhoneModules;
    const paymentFactory = globalThis.CommunityReactionsPhonePayment?.create;
    if (!registry?.registerApp) {
        throw new Error('CommunityReactionsPhoneModules registry is not available.');
    }
    if (typeof paymentFactory !== 'function') {
        throw new Error('CommunityReactionsPhonePayment.create is not available.');
    }

    registry.registerApp(function createPaymentHistoryPhoneApp(context) {
        const {
            escapeHtml,
            getPhoneAppPreset,
            getPhoneResultTime,
            sortPhoneResultsNewest,
        } = context;
        const payment = paymentFactory(context);
        const {
            PAYMENT_BANKS,
            PAYMENT_PAGE_SIZE,
            createEmptyPaymentData,
            formatMoney,
            getPaymentBankTheme,
            getPaymentCurrency,
            normalizePaymentPayload,
        } = payment;

        const PAYMENT_EDIT_ARIA_LABEL = '결제 내역 수정';
        const PAYMENT_TRANSACTION_SELECT_ARIA_LABEL = '결제 내역 선택';
        const PAYMENT_DELETE_SELECTED_LABEL = "선택 삭제";
        const PAYMENT_DELETE_ALL_LABEL = "전체 삭제";
        const BOFA_MONTHS = Object.freeze(['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']);
        const PAYMENT_BANK_ORDER = Object.freeze(['bankOfAmerica', 'kbKookmin']);
        const PAYMENT_TEXT = Object.freeze({
            translate: "번역 보기",
            loadMore: "아래로 스크롤하면 다음 내역을 불러옵니다.",
            kbOwnerSuffix: " 님",
            kbTotalAssets: "총 자산",
            kbSpentBalance: "이번 달 결제 예정 금액",
            kbTransactions: "최근 결제",
            kbCountSuffix: " 건",
            openSuffix: " 열기",
        });

        function buildPaymentHistoryPrompt(input, context) {
            const {
                countryLabel,
                selectedCountryLabel,
                languageLabel,
                needsTranslation,
                supplementalRule,
                customPromptRule,
                homePromptRule,
                transcript,
            } = context;
            const theme = getPaymentBankTheme(input);
            const bank = PAYMENT_BANKS[theme];
            const currency = getPaymentCurrency(input);
            const zeroDisplay = formatMoney(0, currency);
            const examplePayment = formatMoney(currency.fractionDigits ? -12.34 : -12000, currency);
            const amountDisplayRule = currency.code === 'KRW' && theme === 'kbKookmin'
                ? '- For KB/KRW, every transaction display_amount field must be signed numeric text only, such as "+12,000" for income or "-12,000" for expenses. Do not include currency symbols, backslashes, or unit words.'
                : '- Transaction display_amount fields should use the natural local currency format with an explicit leading + for income and - for expenses.';
            const translationRule = needsTranslation
                ? `- "description" and "detail_note" must be written in the natural local language for ${countryLabel}; "description_translation" and "detail_note_translation" must translate the same content into ${languageLabel}.`
                : '- "description" and "detail_note" must be written in the output language; set "description_translation" and "detail_note_translation" to empty strings.';

            return `
You generate an in-universe iPhone banking/payment application snapshot for a fictional character.

The selected chat excerpt is canon context from the character's world:
${transcript}

Application to generate: Payment history.
Character nationality/culture: ${countryLabel}.
User selected country option: ${selectedCountryLabel}.
Output language: ${languageLabel}.
Current real timestamp for fallback only: ${new Date().toISOString()}.
Bank design motif: ${bank.label}.
Currency: ${currency.code === 'LOCAL' ? `the natural local currency for ${countryLabel}` : `${currency.code} (${currency.symbol || 'local symbol'})`}. If the character is American, all money must be in US dollars.
${customPromptRule}
${supplementalRule}
${homePromptRule}

Payment history rules:
- Generate the character's plausible current total assets.
- Generate the character's plausible current card or payment total for this month.
- Generate exactly 10 recent banking/payment transactions.
- Each transaction needs a payment description, a short character-written detail note, signed amount, and time.
- Include expenses, income, deposits, refunds, transfers, bills, subscriptions, or other realistic entries as appropriate for the character and context.
- The prefix for the "amount" and "display_amount" values depends on the transaction type. Use "-" for expenses/outgoing money and "+" for income/incoming money. Do not force every transaction to be an expense.
- "description" should be a concise merchant/payee label such as a store, service, subscription, person, or bill.
- "detail_note" is a brief memo written by the character that explains what the transaction was for. Keep it concrete, personal, and one short sentence fragment.
- Transactions must reflect the selected chat excerpt, the character's lifestyle, and ordinary phone payment history.
- If the in-story current date/time is clear, transaction times must be recent relative to that in-story time. If it is not clear, use the current real timestamp as the fallback reference.
- Use realistic merchants, payroll, deposits, refunds, subscriptions, transport, food, supplies, medical, hobby, work, bills, or story-specific payments when appropriate.
- Amounts, time format, wording, and context must match the character nationality/culture.
- For Bank of America, "time_label" must use "DD MMM hh:mm:ss", such as "23 MAR 13:02:44".
- For KB Kookmin, "time_label" must use "MM.DD hh:mm:ss", such as "03.23 13:02:44".
${translationRule}
- Use ${theme === 'bankOfAmerica' ? '"bankOfAmerica"' : '"kbKookmin"'} as "bank_theme".
- Set "currency_code" and "currency_symbol" to the correct local currency for ${countryLabel}; for American characters, use "USD" and "$".
${amountDisplayRule}
- Do not include markdown, icons, emoji, HTML, CSS, comments, or extra keys outside the schema.

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
  "payment": {
    "bank_theme": "${theme}",
    "currency_code": "${currency.code}",
    "currency_symbol": "${currency.symbol}",
    "total_assets": { "amount": 0, "display": "${zeroDisplay}" },
    "monthly_card_total": { "amount": 0, "display": "${zeroDisplay}" },
    "transactions": [
      {
        "id": "payment_001",
        "description": "local payment description",
        "description_translation": "translated payment description or empty string",
        "detail_note": "short character-written transaction memo",
        "detail_note_translation": "translated transaction memo or empty string",
        "amount": "+12.34 or -12.34",
        "display_amount": "${formatMoney(currency.fractionDigits ? 12.34 : 12000, currency, { signedPositive: true })} or ${examplePayment}",
        "occurred_at": "ISO-8601 date time",
        "time_label": "localized short time"
      }
    ]
  }
}
- Use stable ids payment_001 through payment_010.
`.trim();
        }

        function renderPaymentHistoryApp(app) {
            const bankPayments = getRenderablePaymentBanks(app);
            return `
        <section class="crx-phone-app crx-phone-payment-app" data-phone-app="paymentHistory">
            ${bankPayments.map((bankPayment, index) => renderPaymentBankScreen(bankPayment, index === 0)).join('')}
        </section>
    `;
        }

        function getRenderablePaymentBanks(app) {
            const banks = Array.isArray(app?.payment_banks)
                ? app.payment_banks.map(normalizePaymentBankData).filter(hasPaymentTransactions)
                : [];
            if (banks.length) {
                return banks;
            }
            const payment = app?.payment || createEmptyPaymentData().payment;
            return hasPaymentTransactions(payment) ? [normalizePaymentBankData(payment)] : [];
        }

        function renderPaymentBankScreen(payment, isActive) {
            const bankTheme = normalizePaymentBankTheme(payment.bank_theme);
            const themeClass = bankTheme === 'bankOfAmerica' ? 'is-bofa' : 'is-kb';
            const showWonUnit = bankTheme === 'kbKookmin';
            const transactions = Array.isArray(payment.transactions) ? payment.transactions : [];
            const initialTransactions = transactions.slice(0, PAYMENT_PAGE_SIZE);
            const hasTranslation = Boolean(payment.has_translation || transactions.some(transaction => transaction.description_translation || transaction.detail_note_translation));
            const encodedTransactions = escapeHtml(encodeURIComponent(JSON.stringify(transactions)));
            const ownerName = String(payment.character_name || '{{char}}').trim();
            const copy = getPaymentCopy(bankTheme, ownerName, transactions.length);

            return `
            <div class="crx-phone-payment-bank-screen ${themeClass}${isActive ? ' is-active-bank' : ''}" data-payment-bank="${escapeHtml(bankTheme)}">
                <div class="crx-phone-payment-scroll">
                    ${renderPaymentBankHeader(payment, bankTheme, copy, hasTranslation)}
                    ${renderPaymentBankSummary(payment, bankTheme, showWonUnit)}
                    ${renderPaymentDeleteBar(bankTheme)}
                    <section class="crx-phone-payment-card">
                        <div class="crx-phone-payment-list-head">
                            <span>${escapeHtml(copy.transactions)}</span>
                            <span>${escapeHtml(copy.transactionCount)}</span>
                        </div>
                        <ul class="crx-phone-payment-list" data-transactions="${encodedTransactions}" data-rendered="${initialTransactions.length}" data-page-size="${PAYMENT_PAGE_SIZE}" data-show-won-unit="${showWonUnit ? 'true' : 'false'}" data-bank-theme="${escapeHtml(bankTheme)}">
                            ${renderPaymentTransactionBatch(initialTransactions, showWonUnit, bankTheme)}
                        </ul>
                        <div class="crx-phone-payment-more${transactions.length > initialTransactions.length ? '' : ' is-hidden'}">${escapeHtml(PAYMENT_TEXT.loadMore)}</div>
                    </section>
                </div>
            </div>
        `;
        }

        function renderPaymentDeleteBar(bankTheme) {
            return `
                <div class="crx-phone-payment-deletebar" data-bank-theme="${escapeHtml(bankTheme)}">
                    <button class="crx-phone-payment-delete-selected" type="button"><i class="fa-solid fa-trash" aria-hidden="true"></i><span>${escapeHtml(PAYMENT_DELETE_SELECTED_LABEL)}</span></button>
                    <button class="crx-phone-payment-delete-all" type="button" data-bank-theme="${escapeHtml(bankTheme)}"><i class="fa-solid fa-folder-minus" aria-hidden="true"></i><span>${escapeHtml(PAYMENT_DELETE_ALL_LABEL)}</span></button>
                </div>
            `;
        }
        function renderPaymentBankHeader(payment, bankTheme, copy, hasTranslation) {
            return bankTheme === 'bankOfAmerica'
                ? renderBofaPaymentHeader(payment, copy, hasTranslation)
                : renderKbPaymentHeader(payment, copy, hasTranslation);
        }

        function renderBofaPaymentHeader(payment, copy, hasTranslation) {
            return `
                <header class="crx-phone-payment-header crx-phone-payment-header-bofa">
                    <div class="crx-phone-payment-header-copy">
                        <strong>${escapeHtml(copy.owner)}</strong>
                    </div>
                    <div>
                        <button class="crx-phone-payment-menu" type="button" aria-label="메뉴"><i class="fa-solid fa-bars" id="crx-daum-edit"></i></button>
                        <button class="crx-phone-payment-translate is-icon-only" type="button" aria-label="${escapeHtml(PAYMENT_TEXT.translate)}" aria-pressed="false"${hasTranslation ? '' : ' hidden'}><i class="fa-solid fa-language" aria-hidden="true"></i></button>
                    </div>
                </header>
            `;
        }

        function renderKbPaymentHeader(payment, copy, hasTranslation) {
            return `
                <header class="crx-phone-payment-header crx-phone-payment-header-kb">
                    <div class="crx-phone-payment-header-copy">
                        <span>${escapeHtml(payment.bank_label || PAYMENT_BANKS.kbKookmin.label)}</span>
                        <strong>${escapeHtml(copy.owner)}</strong>
                    </div>
                    <button class="crx-phone-payment-menu" type="button" aria-label="메뉴"><i class="fa-solid fa-bars" id="crx-daum-edit"></i></button>
                </header>
            `;
        }

        function renderPaymentBankSummary(payment, bankTheme, showWonUnit) {
            return bankTheme === 'bankOfAmerica'
                ? renderBofaPaymentSummary(payment, showWonUnit)
                : renderKbPaymentSummary(payment, showWonUnit);
        }

        function renderBofaPaymentSummary(payment, showWonUnit) {
            const copy = getPaymentCopy('bankOfAmerica', payment.character_name || '{{char}}', payment.transactions?.length || 0);
            return `
                <div class="crx-phone-payment-summary crx-phone-payment-summary-bofa">
                    ${renderPaymentSummaryCard(copy.totalAssets, payment.total_assets, 'fa-wallet', showWonUnit)}
                    ${renderPaymentSummaryCard(copy.spentBalance, payment.monthly_card_total, 'fa-credit-card', showWonUnit)}
                </div>
            `;
        }

        function renderKbPaymentSummary(payment, showWonUnit) {
            const copy = getPaymentCopy('kbKookmin', payment.character_name || '{{char}}', payment.transactions?.length || 0);
            return `
                <div class="crx-phone-payment-summary crx-phone-payment-summary-kb">
                    ${renderPaymentSummaryCard(copy.totalAssets, payment.total_assets, 'fa-wallet', showWonUnit)}
                    ${renderPaymentSummaryCard(copy.spentBalance, payment.monthly_card_total, 'fa-credit-card', showWonUnit)}
                </div>
            `;
        }

        function getPaymentCopy(bankTheme, ownerName, transactionCount) {
            if (bankTheme === 'bankOfAmerica') {
                return {
                    owner: `Hello, ${ownerName}`,
                    totalAssets: 'Total Balance',
                    spentBalance: 'Spent Balance',
                    transactions: 'Latest Transactions',
                    transactionCount: String(transactionCount),
                };
            }
            return {
                owner: `${ownerName}${PAYMENT_TEXT.kbOwnerSuffix}`,
                totalAssets: PAYMENT_TEXT.kbTotalAssets,
                spentBalance: PAYMENT_TEXT.kbSpentBalance,
                transactions: PAYMENT_TEXT.kbTransactions,
                transactionCount: `${transactionCount}${PAYMENT_TEXT.kbCountSuffix}`,
            };
        }

        function renderPaymentSummaryCard(label, value, icon, showWonUnit) {
            return `
        <div class="crx-phone-payment-summary-card">
            <i class="fa-solid ${escapeHtml(icon)}" aria-hidden="true"></i>
            <span class="crx-phone-payment-ttl">${escapeHtml(label)}</span>
            <span class="crx-phone-payment-summary-amount"><strong>${escapeHtml(value?.display || '')}</strong>${showWonUnit ? ' 원' : ''}</span>
        </div>
    `;
        }

        function renderPaymentTransactionBatch(transactions, showWonUnit = true, bankTheme = showWonUnit ? 'kbKookmin' : 'bankOfAmerica') {
            return (Array.isArray(transactions) ? transactions : [])
                .map(transaction => renderPaymentTransaction(transaction, showWonUnit, bankTheme))
                .join('');
        }

        function renderPaymentTransaction(transaction, showWonUnit, bankTheme) {
            const negative = Number(transaction.amount) < 0;
            const translation = String(transaction.description_translation || '').trim();
            const detailNote = String(transaction.detail_note || '').trim();
            const detailNoteTranslation = String(transaction.detail_note_translation || '').trim();
            const hasTranslation = Boolean(translation || detailNoteTranslation);
            const timeLabel = formatPaymentDisplayTime(transaction, bankTheme);
            const sourceResultId = transaction._source_result_id || '';
            const sourceTransactionId = transaction._source_transaction_id || transaction.id || '';
            return `
        <li class="crx-phone-payment-transaction${hasTranslation ? ' has-translation' : ''}" data-result-id="${escapeHtml(sourceResultId)}" data-transaction-id="${escapeHtml(sourceTransactionId)}">
            <label class="crx-phone-payment-transaction-check"><input type="checkbox" data-result-id="${escapeHtml(sourceResultId)}" data-transaction-id="${escapeHtml(sourceTransactionId)}" aria-label="${escapeHtml(PAYMENT_TRANSACTION_SELECT_ARIA_LABEL)}"></label>
            <button class="crx-phone-payment-edit" type="button" data-result-id="${escapeHtml(sourceResultId)}" data-transaction-id="${escapeHtml(sourceTransactionId)}" aria-label="${escapeHtml(PAYMENT_EDIT_ARIA_LABEL)}">
                <i class="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>
            </button>
            <span class="crx-phone-payment-transaction-main">
                <span class="crx-phone-payment-time">${escapeHtml(timeLabel)}</span>
                <span class="crx-phone-payment-description-original">${escapeHtml(transaction.description)}</span>
                ${translation ? `<span class="crx-phone-payment-description-translation">${escapeHtml(translation)}</span>` : ''}
                ${detailNote ? `<span class="crx-phone-payment-detail-original">${escapeHtml(detailNote)}</span>` : ''}
                ${detailNoteTranslation ? `<span class="crx-phone-payment-detail-translation">${escapeHtml(detailNoteTranslation)}</span>` : ''}
            </span>
            <span class="crx-phone-payment-amount ${negative ? 'is-negative' : 'is-positive'}"><strong>${escapeHtml(transaction.display_amount || '')}</strong>${showWonUnit ? ' 원' : ''}</span>
        </li>
    `;
        }

        function formatPaymentDisplayTime(transaction, bankTheme) {
            const date = new Date(transaction?.occurred_at || '');
            if (Number.isNaN(date.getTime())) {
                return String(transaction?.time_label || '').trim();
            }
            const month = bankTheme === 'bankOfAmerica'
                ? BOFA_MONTHS[date.getMonth()]
                : padDatePart(date.getMonth() + 1);
            const day = padDatePart(date.getDate());
            const time = [
                date.getHours(),
                date.getMinutes(),
                date.getSeconds(),
            ].map(padDatePart).join(':');
            return bankTheme === 'bankOfAmerica'
                ? `${day} ${month} ${time}`
                : `${month}.${day} ${time}`;
        }

        function padDatePart(value) {
            return String(value).padStart(2, '0');
        }

        function createEmptyPhoneAppData(appId = 'paymentHistory') {
            return createEmptyPaymentData(getPhoneAppPreset(appId));
        }

        function renderHomeIcon(app) {
            return getRenderablePaymentBanks(app)
                .map(bankPayment => renderPaymentBankHomeIcon(app, bankPayment))
                .join('');
        }

        function renderPaymentBankHomeIcon(app, payment) {
            const bankTheme = normalizePaymentBankTheme(payment.bank_theme);
            const themeClass = bankTheme === 'bankOfAmerica' ? 'is-bofa' : 'is-kb';
            const bank = PAYMENT_BANKS[bankTheme];
            const badge = getPaymentNotificationBadge(app, payment, bankTheme);
            const badgeAttribute = badge ? ` data-phone-badge="${escapeHtml(badge)}"` : '';
            return `
                <button class="crx-phone-app-icon" type="button" data-phone-app="${escapeHtml(app.app_id)}" data-payment-bank-theme="${escapeHtml(bankTheme)}"${badgeAttribute} aria-label="${escapeHtml(bank.label + PAYMENT_TEXT.openSuffix)}">
                    <span class="crx-phone-bank-icon ${themeClass}" aria-hidden="true"></span>
                    <span>${escapeHtml(bank.label)}</span>
                </button>
            `;
        }

        function getPaymentNotificationBadge(app, payment, bankTheme) {
            const count = Number(payment?.notification_badge ?? (app?.notification_bank_theme === bankTheme ? app?.notification_badge : 0));
            return Number.isFinite(count) && count > 0 ? String(Math.floor(count)) : '';
        }

        function mergePhonePayments(results, appId = 'paymentHistory', maxTransactions = 160) {
            const data = createEmptyPhoneAppData(appId);
            const sortedResults = sortPhoneResultsNewest(results).filter(result => result?.phone?.payment);
            const latestHomeResult = sortedResults.find(result => result?.phone?.home);
            if (latestHomeResult?.phone?.home?.weather) {
                data.home = latestHomeResult.phone.home;
                data.home_updated_at = getPhoneResultTime(latestHomeResult);
            }

            const banksByTheme = new Map();
            const seenByTheme = new Map();
            for (const result of sortedResults) {
                const rawPayment = result.phone.payment;
                const bankTheme = normalizePaymentBankTheme(rawPayment.bank_theme);
                const bankPayment = ensureMergedPaymentBank(banksByTheme, bankTheme, rawPayment, result);
                const seen = getBankSeenSet(seenByTheme, bankTheme);
                const transactions = Array.isArray(rawPayment.transactions) ? rawPayment.transactions : [];
                for (const transaction of transactions) {
                    const key = getTransactionDedupeKey(transaction);
                    if (!transaction?.description || seen.has(key)) {
                        continue;
                    }
                    seen.add(key);
                    bankPayment.transactions.push({
                        ...transaction,
                        bank_theme: bankTheme,
                        _source_result_id: result.id || transaction._source_result_id || '',
                        _source_transaction_id: transaction.id || transaction._source_transaction_id || '',
                    });
                    if (bankPayment.transactions.length >= maxTransactions) {
                        break;
                    }
                }
            }

            data.payment_banks = orderPaymentBanks([...banksByTheme.values()])
                .filter(hasPaymentTransactions)
                .map(bankPayment => ({
                    ...bankPayment,
                    has_translation: bankPayment.transactions.some(transaction => Boolean(transaction.description_translation || transaction.detail_note_translation)),
                }));
            data.payment = data.payment_banks[0] || data.payment;
            return data;
        }

        function ensureMergedPaymentBank(banksByTheme, bankTheme, rawPayment, result) {
            const existing = banksByTheme.get(bankTheme);
            if (existing) {
                return existing;
            }
            const emptyPayment = createEmptyBankPayment(bankTheme);
            const bankPayment = {
                ...emptyPayment,
                ...rawPayment,
                bank_theme: bankTheme,
                bank_label: rawPayment.bank_label || PAYMENT_BANKS[bankTheme].label,
                character_name: rawPayment.character_name || rawPayment.characterName || getPaymentCharacterNameFromResult(result),
                transactions: [],
                _latest_result_time: getPhoneResultTime(result),
            };
            banksByTheme.set(bankTheme, bankPayment);
            return bankPayment;
        }

        function createEmptyBankPayment(bankTheme) {
            const emptyPayment = createEmptyPaymentData(getPhoneAppPreset('paymentHistory')).payment;
            return {
                ...emptyPayment,
                bank_theme: bankTheme,
                bank_label: PAYMENT_BANKS[bankTheme].label,
                currency_code: bankTheme === 'bankOfAmerica' ? 'USD' : emptyPayment.currency_code,
                currency_symbol: bankTheme === 'bankOfAmerica' ? '$' : emptyPayment.currency_symbol,
            };
        }

        function getBankSeenSet(seenByTheme, bankTheme) {
            if (!seenByTheme.has(bankTheme)) {
                seenByTheme.set(bankTheme, new Set());
            }
            return seenByTheme.get(bankTheme);
        }

        function getTransactionDedupeKey(transaction) {
            return [
                String(transaction.description || '').trim().toLowerCase(),
                String(transaction.occurred_at || ''),
                String(transaction.display_amount || transaction.amount || ''),
            ].join('|');
        }

        function orderPaymentBanks(banks) {
            return banks.slice().sort((a, b) => {
                const timeDiff = Number(b._latest_result_time || 0) - Number(a._latest_result_time || 0);
                if (timeDiff) {
                    return timeDiff;
                }
                return PAYMENT_BANK_ORDER.indexOf(normalizePaymentBankTheme(a.bank_theme)) - PAYMENT_BANK_ORDER.indexOf(normalizePaymentBankTheme(b.bank_theme));
            });
        }

        function normalizePaymentBankData(payment) {
            const bankTheme = normalizePaymentBankTheme(payment?.bank_theme);
            return {
                ...payment,
                bank_theme: bankTheme,
                bank_label: payment?.bank_label || PAYMENT_BANKS[bankTheme].label,
                transactions: Array.isArray(payment?.transactions) ? payment.transactions : [],
            };
        }

        function normalizePaymentBankTheme(value) {
            return value === 'bankOfAmerica' ? 'bankOfAmerica' : 'kbKookmin';
        }

        function hasPaymentTransactions(payment) {
            return Array.isArray(payment?.transactions) && payment.transactions.length > 0;
        }

        function getPaymentCharacterNameFromResult(result) {
            return String(
                result?.phone?.payment?.character_name
            || result?.phone?.payment?.characterName
            || result?.generation?.character_name
            || result?.generation?.characterName
            || '',
            ).trim();
        }

        function hasContent(app) {
            return getRenderablePaymentBanks(app).some(hasPaymentTransactions);
        }

        return {
            id: 'paymentHistory',
            label: 'Payment history',
            homeLabel: 'Bank',
            promptName: 'Payment history',
            buildPrompt: buildPaymentHistoryPrompt,
            createEmptyData: createEmptyPaymentData,
            hasContent,
            mergeResults: mergePhonePayments,
            normalizePayload(parsed, input) {
                return normalizePaymentPayload(parsed, input, getPhoneAppPreset(input.phone_app_id || input.site || 'paymentHistory'));
            },
            renderApp: renderPaymentHistoryApp,
            renderHomeIcon,
            renderPaymentTransactionBatch,
        };
    });
})();
