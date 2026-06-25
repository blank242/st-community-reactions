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
                ? '- For KB/KRW, every display amount field must be signed numeric text only, such as "12,000" or "-12,000". Do not include currency symbols, backslashes, or unit words.'
                : '- Display amount fields should use the natural local currency format.';
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
- Generate the character's plausible current total credit-card payment amount for this month.
- Generate exactly 10 recent credit-card payment transactions.
- Each transaction needs a payment description, a short character-written detail note, amount, and time.
- "description" should be a concise merchant/payee label such as a store, service, subscription, person, or bill.
- "detail_note" is a brief memo written by the character that explains what the spending was for or why they bought it. Keep it concrete, personal, and one short sentence fragment.
- Transactions must reflect the selected chat excerpt, the character's lifestyle, and ordinary phone payment history.
- If the in-story current date/time is clear, transaction times must be recent relative to that in-story time. If it is not clear, use the current real timestamp as the fallback reference.
- Use realistic merchants, subscriptions, transport, food, supplies, medical, hobby, work, or story-specific expenses when appropriate.
- Amounts, time format, wording, and context must match the character nationality/culture.
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
        "detail_note": "short character-written spending memo",
        "detail_note_translation": "translated spending memo or empty string",
        "amount": -12.34,
        "display_amount": "${examplePayment}",
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
            const payment = app.payment || createEmptyPaymentData().payment;
            const transactions = Array.isArray(payment.transactions) ? payment.transactions : [];
            const initialTransactions = transactions.slice(0, PAYMENT_PAGE_SIZE);
            const themeClass = payment.bank_theme === 'bankOfAmerica' ? 'is-bofa' : 'is-kb';
            const hasTranslation = Boolean(payment.has_translation || transactions.some(transaction => transaction.description_translation || transaction.detail_note_translation));
            const encodedTransactions = escapeHtml(encodeURIComponent(JSON.stringify(transactions)));
            const ownerName = String(payment.character_name || app.character_name || '{{char}}').trim();

            return `
        <section class="crx-phone-app crx-phone-payment-app ${themeClass}" data-phone-app="paymentHistory">
            <div class="crx-phone-payment-scroll">
                <header class="crx-phone-payment-header">
                    <div>
                        <span>${escapeHtml(payment.bank_label || PAYMENT_BANKS.kbKookmin.label)}</span>
                        <strong>${escapeHtml(ownerName)} 님</strong>
                    </div>
                    <button class="crx-phone-payment-translate" type="button" aria-pressed="false"${hasTranslation ? '' : ' hidden'}>번역 보기</button>
                </header>
                <div class="crx-phone-payment-summary">
                    ${renderPaymentSummaryCard('총 자산', payment.total_assets, 'fa-wallet')}
                    ${renderPaymentSummaryCard('이번 달 결제 예정 금액', payment.monthly_card_total, 'fa-credit-card')}
                </div>
                <section class="crx-phone-payment-card">
                    <div class="crx-phone-payment-list-head">
                        <span>최근 결제</span>
                        <span>${transactions.length} 건</span>
                    </div>
                    <ul class="crx-phone-payment-list" data-transactions="${encodedTransactions}" data-rendered="${initialTransactions.length}" data-page-size="${PAYMENT_PAGE_SIZE}">
                        ${renderPaymentTransactionBatch(initialTransactions)}
                    </ul>
                    <div class="crx-phone-payment-more${transactions.length > initialTransactions.length ? '' : ' is-hidden'}">아래로 스크롤하면 다음 내역을 불러옵니다.</div>
                </section>
            </div>
        </section>
    `;
        }

        function renderPaymentSummaryCard(label, value, icon) {
            return `
        <div class="crx-phone-payment-summary-card">
            <i class="fa-solid ${escapeHtml(icon)}" aria-hidden="true"></i>
            <span class="crx-phone-payment-ttl">${escapeHtml(label)}</span>
            <span class="crx-phone-payment-summary-amount"><strong>${escapeHtml(value?.display || '')}</strong> 원</span>
        </div>
    `;
        }

        function renderPaymentTransactionBatch(transactions) {
            return (Array.isArray(transactions) ? transactions : []).map(renderPaymentTransaction).join('');
        }

        function renderPaymentTransaction(transaction) {
            const negative = Number(transaction.amount) < 0;
            const translation = String(transaction.description_translation || '').trim();
            const detailNote = String(transaction.detail_note || '').trim();
            const detailNoteTranslation = String(transaction.detail_note_translation || '').trim();
            const hasTranslation = Boolean(translation || detailNoteTranslation);
            return `
        <li class="crx-phone-payment-transaction${hasTranslation ? ' has-translation' : ''}" data-result-id="${escapeHtml(transaction._source_result_id || '')}" data-transaction-id="${escapeHtml(transaction._source_transaction_id || transaction.id || '')}">
            <button class="crx-phone-payment-edit" type="button" data-result-id="${escapeHtml(transaction._source_result_id || '')}" data-transaction-id="${escapeHtml(transaction._source_transaction_id || transaction.id || '')}" aria-label="${escapeHtml(PAYMENT_EDIT_ARIA_LABEL)}">
                <i class="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>
            </button>
            <span class="crx-phone-payment-transaction-main">
                <span class="crx-phone-payment-time">${escapeHtml(transaction.time_label || '')}</span>
                <span class="crx-phone-payment-description-original">${escapeHtml(transaction.description)}</span>
                ${translation ? `<span class="crx-phone-payment-description-translation">${escapeHtml(translation)}</span>` : ''}
                ${detailNote ? `<span class="crx-phone-payment-detail-original">${escapeHtml(detailNote)}</span>` : ''}
                ${detailNoteTranslation ? `<span class="crx-phone-payment-detail-translation">${escapeHtml(detailNoteTranslation)}</span>` : ''}
            </span>
            <span class="crx-phone-payment-amount ${negative ? 'is-negative' : 'is-positive'}"><strong>${escapeHtml(transaction.display_amount || '')}</strong> 원</span>
        </li>
    `;
        }

        function createEmptyPhoneAppData(appId = 'paymentHistory') {
            return createEmptyPaymentData(getPhoneAppPreset(appId));
        }

        function renderHomeIcon(app) {
            const themeClass = app.payment?.bank_theme === 'bankOfAmerica' ? 'is-bofa' : 'is-kb';
            const shortLabel = app.payment?.bank_theme === 'bankOfAmerica' ? PAYMENT_BANKS.bankOfAmerica.shortLabel : PAYMENT_BANKS.kbKookmin.shortLabel;
            return `
                <button class="crx-phone-app-icon" type="button" data-phone-app="${escapeHtml(app.app_id)}" aria-label="${escapeHtml(app.app_home_label)} 열기">
                    <span class="crx-phone-bank-icon ${themeClass}" aria-hidden="true"><i class="fa-solid fa-building-columns"></i><b>${escapeHtml(shortLabel)}</b></span>
                    <span>${escapeHtml(app.app_home_label)}</span>
                </button>
            `;
        }

        function mergePhonePayments(results, appId = 'paymentHistory', maxTransactions = 160) {
            const data = createEmptyPhoneAppData(appId);
            const sortedResults = sortPhoneResultsNewest(results).filter(result => result?.phone?.payment);
            const latestHome = sortedResults.find(result => result?.phone?.home)?.phone?.home;
            if (latestHome?.weather) {
                data.home = latestHome;
            }
            const latestPayment = sortedResults[0]?.phone?.payment;
            const latestCharacterName = sortedResults.map(getPaymentCharacterNameFromResult).find(Boolean);
            if (latestPayment) {
                data.payment = {
                    ...data.payment,
                    ...latestPayment,
                    transactions: [],
                };
            }
            if (latestCharacterName && !data.payment.character_name) {
                data.payment.character_name = latestCharacterName;
            }

            const seen = new Set();
            for (const result of sortedResults) {
                const transactions = Array.isArray(result.phone.payment.transactions) ? result.phone.payment.transactions : [];
                for (const transaction of transactions) {
                    const key = [
                        String(transaction.description || '').trim().toLowerCase(),
                        String(transaction.occurred_at || ''),
                        String(transaction.display_amount || transaction.amount || ''),
                    ].join('|');
                    if (!transaction?.description || seen.has(key)) {
                        continue;
                    }
                    seen.add(key);
                    data.payment.transactions.push({
                        ...transaction,
                        _source_result_id: result.id || transaction._source_result_id || '',
                        _source_transaction_id: transaction.id || transaction._source_transaction_id || '',
                    });
                    if (data.payment.transactions.length >= maxTransactions) {
                        break;
                    }
                }
                if (data.payment.transactions.length >= maxTransactions) {
                    break;
                }
            }

            data.payment.has_translation = data.payment.transactions.some(transaction => Boolean(transaction.description_translation || transaction.detail_note_translation));
            return data;
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
            return Array.isArray(app?.payment?.transactions) && app.payment.transactions.length > 0;
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
